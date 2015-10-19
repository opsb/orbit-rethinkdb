import { equalOps } from 'tests/test-helper';
import { setupRethinkdb, teardownRethinkdb } from 'tests/support/rethinkdb-hooks';
import RethinkdbSource from 'orbit-rethinkdb/rethinkdb-source';
import RethinkdbWebsocketClient from 'npm:rethinkdb-websocket-client';
import chattySchema from 'tests/support/chatty-schema';
import {
  addRecordOperation,
  replaceAttributeOperation,
  removeRecordOperation,
  replaceRelationshipOperation
} from 'orbit-common/lib/operations';
const r = RethinkdbWebsocketClient.rethinkdb;

let source,
    conn;

module('Integration - RethinkdbSource', {
  beforeEach({async}) {
    const done = async();

    setupRethinkdb().then((_conn) => {
      conn = _conn;
      source = new RethinkdbSource({schema: chattySchema, conn});
      done();
    });
  },

  afterEach({async}) {
    const done = async();
    teardownRethinkdb().then(done);
  }
});

test('can subscribe to add record changes', function(assert) {
  const done = assert.async();
  const message = {id: 1, body: 'Hello'};

  source.subscribe('message', r.table('messages'));

  source.one('didTransform', (transform) => {
    equalOps(transform.operations[0], addRecordOperation({
      __normalized: true,
      type: 'message',
      id: message.id,
      attributes: {body: message.body},
      relationships: {
        chatRoom: {
          data: null
        }
      }
    }));
    done();
  });

  r.table('messages').insert(message).run(conn);
});

test('can subscribe to replace attribute changes', function(assert) {
  const done = assert.async();
  const message = {id: 1, body: 'Hello'};

  r.table('messages').insert(message).run(conn).then(() => {
    source.subscribe('message', r.table('messages'));

    source.one('didTransform', (transform) => {
      equalOps(transform.operations[0], replaceAttributeOperation({type: 'message', id: 1}, 'body', 'Goodbye'));
      done();
    });

    r.table('messages').get(1).update({body: 'Goodbye'}).run(conn);
  });

});

test('can subscribe to delete record changes', function(assert) {
  const done = assert.async();
  const message = {id: 1, body: 'Hello'};

  r.table('messages').insert(message).run(conn)
    .then(() => {
      return source.subscribe('message', r.table('messages'));
    })
    .then(() => {
      source.one('didTransform', (transform) => {
        equalOps(transform.operations[0], removeRecordOperation({type: 'message', id: 1}));
        done();
      });

      r.table('messages').get(1).delete().run(conn);
    });
});

test('can subscribe to add to hasOne changes', function(assert) {
  const done = assert.async();
  const message = {id: 1, body: 'Hello'};
  const chatRoom = {id: 2, name: 'The forum'};

  Promise.all([
    r.table('messages').insert(message).run(conn),
    r.table('chat_rooms').insert(chatRoom).run(conn)
  ])
  .then(() => {
    return Promise.all([
      source.subscribe('message', r.table('messages')),
      source.subscribe('chatRoom', r.table('chat_rooms')),
    ]);
  })
  .then(() => {
    source.one('didTransform', (transform) => {
      equalOps(transform.operations[0], replaceRelationshipOperation({type: 'message', id: 1}, 'chatRoom', {type: 'chatRoom', id: 2}));
      done();
    });

    r.table('messages').get(1).update({chatRoomKey: 'chatRoom:2'}).run(conn);
  });
});
