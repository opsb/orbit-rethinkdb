import { setupRethinkdb, teardownRethinkdb } from 'tests/support/rethinkdb-hooks';

import Transformer from 'orbit-rethinkdb/rethinkdb-source/transformer';
import Serializer from 'orbit-rethinkdb/rethinkdb-source/serializer';
import Finder from 'orbit-rethinkdb/rethinkdb-source/finder';

import {
  addRecordOperation,
  replaceAttributeOperation,
  removeRecordOperation,
  replaceRelationshipOperation,
  operationType
} from 'orbit-common/lib/operations';
import Transform from 'orbit/transform';
import chattySchema from 'tests/support/chatty-schema';
import RethinkdbWebsocketClient from 'npm:rethinkdb-websocket-client';
const r = RethinkdbWebsocketClient.rethinkdb;

let conn,
    serializer,
    finder;


module('Integration - RethinkdbSource - Finder', function(hooks) {
  hooks.beforeEach(function({async}) {
    const done = async();
    serializer = new Serializer(chattySchema);

    setupRethinkdb().then((_conn) => {
      conn = _conn;
      finder = new Finder(conn, serializer, r);
      done();
    });
  });

  hooks.afterEach(function({async}) {
    const done = async();
    teardownRethinkdb().then(done);
  });

  test('can find records', function(assert) {
    const done = assert.async();
    const expectedMessage = {
      __normalized: true,
      id: '123',
      type: 'message',
      attributes: {
        body: 'Hello'
      },
      relationships: {
        chatRoom: {
          data: null
        }
      }
    };

    r.table('messages')
      .insert({id: '123', body: 'Hello'}).run(conn)
      .then(() => {
        return finder.find('message', (r) => {
          return r.table('messages').filter({body: 'Hello'});
        });
      })
      .then(messages => assert.deepEqual(messages, [expectedMessage]))
      .then(done);

  });
});
