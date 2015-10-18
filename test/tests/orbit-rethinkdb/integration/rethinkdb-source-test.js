import RethinkdbSource from 'orbit-rethinkdb/rethinkdb-source';
import rethinkdb from 'npm:rethinkdb';
let source;

QUnit.module('Integration - RethinkdbSource', {
  beforeEach() {
    source = new RethinkdbSource();
  }
});

QUnit.test('can emit changes from a changefeed', function(assert) {
  assert.ok(RethinkdbSource);
  assert.ok(`hello ES6`);
  assert.ok(rethinkdb);
});
