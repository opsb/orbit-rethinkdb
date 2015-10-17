import RethinkdbSource from 'orbit-rethinkdb/rethinkdb-source';

module('Integration - RethinkdbSource', {

});

test('can emit changes from a changefeed', function() {
  ok(RethinkdbSource);
  console.log(`hello ES6 ${RethinkdbSource}`);
});
