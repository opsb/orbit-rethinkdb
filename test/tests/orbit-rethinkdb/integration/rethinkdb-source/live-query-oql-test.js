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
  replaceHasOneOperation
} from 'orbit-common/lib/operations';
import { queryExpression as oqe } from 'orbit-common/oql/expressions';

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

  test('recordsOfType', function(assert) {
    const done = assert.async();
    const message = {id: 1, body: 'Hello'};
    const normalizedMessage = chattySchema.normalize({ type: 'message', id: message.id, attributes: { body: message.body } });

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
            debugger
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
