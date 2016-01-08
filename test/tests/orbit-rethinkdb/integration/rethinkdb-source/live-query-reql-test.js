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

const skip = QUnit.skip;

let source;
let conn;

module('Integration - RethinkdbSource - #liveQuery - reql', function(hooks) {
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

  test('includes add record changes', function(assert) {
    const done = assert.async();
    const message = {id: 1, body: 'Hello'};
    const normalizedMessage = chattySchema.normalize({ type: 'message', id: message.id, attributes: { body: message.body } });

    r.table('messages').insert(message).run(conn);

    source
      .liveQuery({ reql: r.table('messages'), })
      .then(liveQuery => {
        liveQuery.take(1).toArray().subscribe(operations => {
          equalOps(operations[0], addRecordOperation(normalizedMessage));

          done();
        });
      });
  });

  test('includes replace attribute changes', function(assert) {
    const done = assert.async();
    const message = {id: 1, body: 'Hello'};

    source
      .liveQuery({ reql: r.table('messages') })
      .then(liveQuery => {
        r.table('messages').get(1).update({body: 'Goodbye'}).run(conn);

        liveQuery.take(2).toArray().subscribe(operations => {
          equalOps(operations[1], replaceAttributeOperation({type: 'message', id: 1}, 'body', 'Goodbye'));

          done();
        });
      });

    r.table('messages').insert(message).run(conn);

  });

  test('includes delete record changes', function(assert) {
    const done = assert.async();
    const message = {id: 1, body: 'Hello'};

    source
      .liveQuery({ reql: r.table('messages') })
      .then(liveQuery => {
        r.table('messages').get(1).delete().run(conn);

        liveQuery.take(2).toArray().subscribe(operations => {
          equalOps(operations[1], removeRecordOperation({type: 'message', id: 1}));

          done();
        });
      });

    r.table('messages').insert(message).run(conn);
  });

  test('includes add hasOne changes', function(assert) {
    const done = assert.async();
    const message = {id: 1, body: 'Hello'};
    const chatRoom = {id: 2, name: 'The forum'};

    source
      .liveQuery({ reql: r.table('messages') })
      .then(liveQuery => {
        liveQuery.take(2).toArray().subscribe(operations => {
          equalOps(operations[1], replaceHasOneOperation({type: 'message', id: 1}, 'chatRoom', {type: 'chatRoom', id: 2}));

          done();
        });
      });

    Orbit.Promise.all([
      r.table('messages').insert(message).run(conn),
      r.table('chat_rooms').insert(chatRoom).run(conn),
    ])
    .then(() => {
      r.table('messages').get(1).update({chatRoomId: 2}).run(conn);
    });
  });
});