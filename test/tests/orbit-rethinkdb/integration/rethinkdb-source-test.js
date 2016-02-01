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

module('Integration - RethinkdbSource', function(hooks) {
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
});
