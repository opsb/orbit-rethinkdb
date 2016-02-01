import { equalOps } from 'tests/test-helper';
import Orbit from 'orbit/main';
import { setupRethinkdb, teardownRethinkdb } from 'tests/support/rethinkdb-hooks';
import RethinkdbSource from 'orbit-rethinkdb/rethinkdb-source';
import RethinkdbWebsocketClient from 'npm:rethinkdb-websocket-client';
const r = RethinkdbWebsocketClient.rethinkdb;
import chattySchema from 'tests/support/chatty-schema';
import {
  addRecordOperation,
  replaceAttributeOperation,
  removeRecordOperation,
  replaceHasOneOperation,
  operationType,
} from 'orbit-common/lib/operations';
import { queryExpression as oqe } from 'orbit/query/expression';
import Transform from 'orbit/transform';

const skip = QUnit.skip;

let source;
let conn;

module('Integration - RethinkdbSource - #liveQuery - oql', function(hooks) {
  hooks.beforeEach(function({async}) {
    const done = async();

    setupRethinkdb().then((_conn) => {
      conn = _conn;
      source = new RethinkdbSource({ schema: chattySchema, conn, r });
      done();
    });
  });

  hooks.afterEach(function({async}) {
    const done = async();
    source = null;
    teardownRethinkdb().then(done);
  });

  module('recordsOfType', function() {
    const message = {id: 1, body: 'Hello'};
    const normalizedMessage = chattySchema.normalize({ type: 'message', id: message.id, attributes: { body: message.body } });

    test('include initial records', function(assert) {
      const done = assert.async();

      r.table('messages').insert(message).run(conn);

      source
        .liveQuery({ oql: oqe('recordsOfType', 'message'), })
        .then(liveQuery => {
          liveQuery.take(1).toArray().subscribe(operations => {
            equalOps(operations[0], addRecordOperation(normalizedMessage));

            done();
          });
        });
    });

    test('include initial records with populated hasOne and hasMany', function(assert) {
      const done = assert.async();
      const user = {id: 'user1', name: 'Jim', chatRoomIds: {chatRoom1: true}, alterEgoId: 'alterEgo1'};
      const chatRoom = {id: 'chatRoom1', name: 'room1', userIds: {user1: true}};
      const alterEgo = {id: 'alterEgo1', name: 'Secret Jim', userId: 'user1'};

      Orbit.Promise.all([
        r.table('users').insert(user).run(conn),
        r.table('alter_egos').insert(alterEgo).run(conn),
        r.table('chat_rooms').insert(chatRoom).run(conn),
      ])
      .then(() => {
        source
          .liveQuery({ oql: oqe('recordsOfType', 'users'), })
          .then(liveQuery => {
            liveQuery.take(1).toArray().subscribe(operations => {
              assert.deepEqual(operations[0].value.relationships.chatRooms.data, {'chatRoom:chatRoom1': true});
              assert.equal(operations[0].value.relationships.alterEgo.data, 'alterEgo:alterEgo1');

              done();
            });
          });
      });

    });

    test('include records added after live query', function(assert) {
      const done = assert.async();

      source
        .liveQuery({ oql: oqe('recordsOfType', 'message'), })
        .then(liveQuery => {
          r.table('messages').insert(message).run(conn);

          liveQuery.take(1).toArray().subscribe(operations => {
            equalOps(operations[0], addRecordOperation(normalizedMessage));

            done();
          });
        });
    });

    test('include records removed after live query', function(assert) {
      const done = assert.async();

      r.table('messages').insert(message).run(conn);

      source
        .liveQuery({ oql: oqe('recordsOfType', 'message'), })
        .then(liveQuery => {
          r.table('messages').get(message.id).delete().run(conn);

          liveQuery.take(2).toArray().subscribe(operations => {
            equalOps(operations[1], removeRecordOperation(normalizedMessage));

            done();
          });
        });
    });
  });

  module('filter', function() {
    test('includes added records', function(assert) {
      const done = assert.async();
      const message = {id: 1, body: 'Hello'};
      const normalizedMessage = chattySchema.normalize({ type: 'message', id: message.id, attributes: { body: message.body } });

      source
        .liveQuery({
          oql:
            oqe('filter',
              oqe('recordsOfType', 'message'),
              oqe('equal',
                oqe('get', 'attributes/body'),
                'Hello')), })

        .then(liveQuery => {
          r.table('messages').insert(message).run(conn);

          liveQuery.take(1).toArray().subscribe(operations => {
            equalOps(operations[0], addRecordOperation(normalizedMessage));

            done();
          });
        });
    });

    test('adds records that become a match', function(assert) {
      const done = assert.async();
      const message = {id: 1, body: 'Hello'};
      const normalizedMessage = chattySchema.normalize({ type: 'message', id: message.id, attributes: { body: message.body } });

      r.table('messages').insert(message).run(conn);

      source
        .liveQuery({
          oql:
            oqe('filter',
              oqe('recordsOfType', 'message'),
              oqe('equal',
                oqe('get', 'attributes/body'),
                'Goodbye')), })

        .then(liveQuery => {
          r.table('messages').get(message.id).update({body: 'Goodbye'}).run(conn);

          liveQuery.take(1).toArray().subscribe(operations => {
            assert.equal(operationType(operations[0]), 'addRecord');
            assert.equal(operations[0].value.id, normalizedMessage.id);

            done();
          });
        });
    });

    test('removes records that no longer match', function(assert) {
      const done = assert.async();
      const message = {id: 1, body: 'Hello'};
      const normalizedMessage = chattySchema.normalize({ type: 'message', id: message.id, attributes: { body: message.body } });

      r.table('messages').insert(message).run(conn);

      source
        .liveQuery({
          oql:
            oqe('filter',
              oqe('recordsOfType', 'message'),
              oqe('equal',
                oqe('get', 'attributes/body'),
                'Hello')), })

        .then(liveQuery => {
          r.table('messages').get(message.id).update({body: 'Goodbye'}).run(conn);

          liveQuery.take(2).toArray().subscribe(operations => {
            equalOps(operations[1], removeRecordOperation(normalizedMessage));

            done();
          });
        });
    });
  });

  module('relatedRecords', function() {
    test('includes existing members', function(assert) {
      const done = assert.async();
      const message = chattySchema.normalize({ type: 'message', id: 'message1', attributes: { body: 'body1' }, });
      const chatRoom = chattySchema.normalize({ type: 'chatRoom', id: 'chatRoom1', attributes: { name: 'room1' } });
      Orbit.Promise.all([
        source.transform(new Transform([addRecordOperation(message)])),
        source.transform(new Transform([addRecordOperation(chatRoom)])),
      ])
      .then(() => {
        return source.transform(new Transform([replaceHasOneOperation(message, 'chatRoom', chatRoom)]));
      })
      .then(() => {
        source
          .liveQuery({ oql: oqe('relatedRecords', 'chatRoom', 'chatRoom1', 'messages'), })
          .then(liveQuery => {
            liveQuery.take(1).toArray().subscribe(operations => {
              assert.equal(operationType(operations[0]), 'addRecord');
              assert.equal(operations[0].value.id, message.id);

              done();
            });
          });
      });
    });

    test('adds new members', function(assert) {
      const done = assert.async();
      const message = chattySchema.normalize({ type: 'message', id: 'message1', attributes: { body: 'body1' }, });
      const chatRoom = chattySchema.normalize({ type: 'chatRoom', id: 'chatRoom1', attributes: { name: 'room1' } });

      Orbit.Promise.all([
        source.transform(new Transform([addRecordOperation(message)])),
        source.transform(new Transform([addRecordOperation(chatRoom)])),
      ])
      .then(() => {
        source
          .liveQuery({ oql: oqe('relatedRecords', 'chatRoom', 'chatRoom1', 'messages'), })
          .tap(() => source.transform(new Transform([replaceHasOneOperation(message, 'chatRoom', chatRoom)])))
          .then(liveQuery => {
            liveQuery.take(1).toArray().subscribe(operations => {
              assert.equal(operationType(operations[0]), 'addRecord');
              assert.equal(operations[0].value.id, message.id);

              done();
            });
          });
      });
    });

    test('removes disassociated members', function(assert) {
      const done = assert.async();
      const message = chattySchema.normalize({ type: 'message', id: 'message1', attributes: { body: 'body1' }, });
      const chatRoom = chattySchema.normalize({ type: 'chatRoom', id: 'chatRoom1', attributes: { name: 'room1' } });

      Orbit.Promise.all([
        source.transform(new Transform([addRecordOperation(message)])),
        source.transform(new Transform([addRecordOperation(chatRoom)])),
      ])
      .then(() =>
        source.transform(new Transform([replaceHasOneOperation(message, 'chatRoom', chatRoom)]))
      )
      .then(() => {
        source
          .liveQuery({ oql: oqe('relatedRecords', 'chatRoom', 'chatRoom1', 'messages'), })
          .tap(() => source.transform(new Transform([replaceHasOneOperation(message, 'chatRoom', null)])))
          .then(liveQuery => {
            liveQuery.take(2).toArray().subscribe(operations => {
              assert.equal(operationType(operations[1]), 'removeRecord');
              assert.deepEqual(operations[1].path, ['message', message.id]);

              done();
            });
          });
      });
    });

    test('includes updates to members', function(assert) {
      const done = assert.async();
      const message = chattySchema.normalize({ type: 'message', id: 'message1', attributes: { body: 'body1' }, });
      const chatRoom = chattySchema.normalize({ type: 'chatRoom', id: 'chatRoom1', attributes: { name: 'room1' } });

      Orbit.Promise.all([
        source.transform(new Transform([addRecordOperation(message)])),
        source.transform(new Transform([addRecordOperation(chatRoom)])),
      ])
      .then(() =>
        source.transform(new Transform([replaceHasOneOperation(message, 'chatRoom', chatRoom)]))
      )
      .then(() => {
        source
          .liveQuery({ oql: oqe('relatedRecords', 'chatRoom', 'chatRoom1', 'messages'), })
          .tap(() => source.transform(new Transform([replaceAttributeOperation(message, 'body', 'body2')])))
          .then(liveQuery => {
            liveQuery.take(2).toArray().subscribe(operations => {
              equalOps(operations[1], replaceAttributeOperation(message, 'body', 'body2'));

              done();
            });
          });
      });
    });
  });

  module('relatedRecord', function() {
    test('includes existing member', function(assert) {
      const done = assert.async();
      const message = chattySchema.normalize({ type: 'message', id: 'message1', attributes: { body: 'body1' }, });
      const chatRoom = chattySchema.normalize({ type: 'chatRoom', id: 'chatRoom1', attributes: { name: 'room1' } });

      Orbit.Promise.all([
        source.transform(new Transform([addRecordOperation(message)])),
        source.transform(new Transform([addRecordOperation(chatRoom)])),
      ])
      .then(() =>
        source.transform(new Transform([replaceHasOneOperation(message, 'chatRoom', chatRoom)]))
      )
      .then(() => {
        source
          .liveQuery({ oql: oqe('relatedRecord', 'message', 'message1', 'chatRoom'), })
          .then(liveQuery => {
            liveQuery.take(1).toArray().subscribe(operations => {
              assert.equal(operationType(operations[0]), 'addRecord');
              assert.equal(operations[0].value.id, chatRoom.id);

              done();
            });
          });
      });
    });

    test('adds new member', function(assert) {
      const done = assert.async();
      const message = chattySchema.normalize({ type: 'message', id: 'message1', attributes: { body: 'body1' }, });
      const chatRoom = chattySchema.normalize({ type: 'chatRoom', id: 'chatRoom1', attributes: { name: 'room1' } });

      Orbit.Promise.all([
        source.transform(new Transform([addRecordOperation(message)])),
        source.transform(new Transform([addRecordOperation(chatRoom)])),
      ])
      .then(() => {
        source
          .liveQuery({ oql: oqe('relatedRecord', 'message', 'message1', 'chatRoom'), })
          .tap(() => source.transform(new Transform([replaceHasOneOperation(message, 'chatRoom', chatRoom)])))
          .then(liveQuery => {
            liveQuery.take(1).toArray().subscribe(operations => {
              assert.equal(operationType(operations[0]), 'addRecord');
              assert.equal(operations[0].value.id, chatRoom.id);
              done();
            });
          });
      });
    });
  });
});
