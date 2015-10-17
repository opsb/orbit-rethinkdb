import RethinkdbSource from 'orbit-rethinkdb/rethinkdb-source';
import rethinkdb from 'npm:rethinkdb';
let source;

module('Integration - RethinkdbSource', {
  setup() {
    source = new RethinkdbSource();
  }
});

test('can emit changes from a changefeed', function() {
  ok(RethinkdbSource);
  ok(`hello ES6`);
  ok(rethinkdb);
});
