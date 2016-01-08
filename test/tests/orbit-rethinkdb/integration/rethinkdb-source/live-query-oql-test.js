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
});
