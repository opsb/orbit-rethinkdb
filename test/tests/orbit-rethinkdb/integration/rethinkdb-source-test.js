import { setupRethinkdb, teardownRethinkdb, connection } from 'tests/support/rethinkdb-hooks';
import RethinkdbSource from 'orbit-rethinkdb/rethinkdb-source';
import RethinkdbWebsocketClient from 'npm:rethinkdb-websocket-client';
const r = RethinkdbWebsocketClient.rethinkdb;

let source,
    conn;

QUnit.module('Integration - RethinkdbSource', {
  beforeEach({async}) {
    const done = async();

    setupRethinkdb()
      .then(() => { return connection(); })
      .then((_conn) => { conn = _conn; })
      .then(done);
  },

  afterEach({async}) {
    const done = async();
    teardownRethinkdb().then(done);
  }
});

QUnit.test('can emit changes from a changefeed', function(assert) {
  const done = assert.async();

  assert.ok(RethinkdbSource);
  assert.ok(`hello ES6`);
  assert.ok(r);

  r.tableList().run(conn).then((tables) => {
    assert.ok(tables);
    done();
  });
});
