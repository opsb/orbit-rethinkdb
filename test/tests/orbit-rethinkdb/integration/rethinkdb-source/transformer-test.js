import 'tests/test-helper';
import { setupRethinkdb, teardownRethinkdb } from 'tests/support/rethinkdb-hooks';
import { mapSeries } from 'tests/utils/promise';

import Transformer from 'orbit-rethinkdb/rethinkdb-source/transformer';
import Serializer from 'orbit-rethinkdb/rethinkdb-source/serializer';
import Finder from 'orbit-rethinkdb/rethinkdb-source/finder';
import Orbit from 'orbit/main';
import { toOperation } from 'orbit/lib/operations';
import { toIdentifier } from 'orbit-common/lib/identifiers';

import {
  addRecordOperation,
  replaceAttributeOperation,
  removeRecordOperation,
  replaceHasOneOperation,
  operationType,
  addToHasManyOperation,
  removeFromHasManyOperation,
  replaceHasManyOperation,
} from 'orbit-common/lib/operations';
import Transform from 'orbit/transform';
import chattySchema from 'tests/support/chatty-schema';
import RethinkdbWebsocketClient from 'npm:rethinkdb-websocket-client';

const r = RethinkdbWebsocketClient.rethinkdb;

const {skip} = QUnit;

let conn;
let transformer;
let serializer;
let finder;

function buildRecord(...args) {
  return serializer.deserialize(...args);
}

function fetchTable(table) {
  return r
    .table(table)
    .run(conn)
    .then(cursor => cursor.toArray());
}

function fetchTables(...tables) {
  return Orbit.Promise
    .all(tables.map(table => fetchTable(table)))
    .then(loadedTables => {
      return tables.reduce((hash, table, index) => {
        hash[table] = loadedTables[index];
        return hash;
      }, {});
    });
}

function fetchRecordsFromTable(table) {
  return r
    .table(table)
    .run(conn)
    .then(cursor => cursor.toArray())
    .then(records => records.reduce((hash, record) => {
      hash[record.id] = record;
      return hash;
    }, {}));
}

function fetchRecordsFromTables(...tables) {
  return Orbit.Promise.all(tables.map(table => fetchRecordsFromTable(table))).then(loadedTables => {
    return loadedTables.reduce((hash, records) => {
      console.log(records);
      Object.keys(records).forEach(recordId => hash[recordId] = records[recordId]);
      return hash;
    }, {});
  });
}

function transform(...operations) {
  return operations.reduce((chain, operation) => {
    return chain.then(() => transformer.transform(new Transform([operation])));
  }, Orbit.Promise.resolve());
}

module('Integration - RethinkdbSource - Transformer', function(hooks) {
  hooks.beforeEach(function({async}) {
    const done = async();
    serializer = new Serializer(chattySchema);

    setupRethinkdb().then((_conn) => {
      conn = _conn;
      transformer = new Transformer(conn, serializer, chattySchema, r);
      finder = new Finder(conn, serializer, r);
      done();
    });
  });

  hooks.afterEach(function({async}) {
    const done = async();
    teardownRethinkdb().then(done);
  });

  test('can add record', function(assert) {
    const done = assert.async();
    const user = buildRecord('user', {id: 'user1', name: 'Jim'});
    const addRecordTransform = new Transform([addRecordOperation(user)]);

    transform(
      addRecordOperation(user)
    )
    .then(() => finder.findByType('user'))
    .then((users) => {
      assert.deepEqual(users[0], user);
    })
    .finally(done);
  });

  test('can add record with hasOne to hasMany', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room2'});
    const message = buildRecord('message', {id: 'message1', body: 'hello', chatRoomId: 'chatRoom1'});

    transform(
      addRecordOperation(chatRoom),
      addRecordOperation(message)
    )
    .then(() => fetchRecordsFromTables('messages', 'chat_rooms'))
    .then(({message1, chatRoom1}) => {
      assert.equal(message1.chatRoomId, 'chatRoom1');
      assert.deepEqual(chatRoom1.messageIds, { message1: true });
    })
    .finally(done);
  });

  test('can add record with hasMany to hasOne', function(assert) {
    const done = assert.async();
    const message = buildRecord('message', {id: 'message1', body: 'hello'});

    // todo - buildRecord doesn't handle hasManys
    const chatRoom = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room2'});
    chatRoom.relationships.messages.data = {'message:message1': true};

    transform(
      addRecordOperation(message),
      addRecordOperation(chatRoom)
    )
    .then(() => fetchRecordsFromTables('messages', 'chat_rooms'))
    .then(({message1, chatRoom1}) => {
      assert.equal(message1.chatRoomId, 'chatRoom1', 'updated hasOne');
      assert.deepEqual(chatRoom1.messageIds, { message1: true }, 'updated hasMany');
    })
    .finally(done);
  });

  test('can remove record', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});

    transform(
      addRecordOperation(chatRoom),
      removeRecordOperation(chatRoom)
    )
    .then(() => finder.findByType('chatRoom'))
    .then(chatRooms => {
      assert.equal(Object.keys(chatRooms).length, 0);
    })
    .finally(done);
  });

  module('hasOne to hasMany', function(hooks) {
    let chatRoom;
    let message;

    hooks.beforeEach(function() {
      chatRoom = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room2'});
      message = buildRecord('message', {id: 'message1', body: 'hello'});
    });

    test('replace', function(assert) {
      const done = assert.async();

      transform(
        addRecordOperation(chatRoom),
        addRecordOperation(message),
        replaceHasOneOperation(message, 'chatRoom', chatRoom)
      )
      .then(() => fetchRecordsFromTables('messages', 'chat_rooms'))
      .then(({message1, chatRoom1}) => {
        assert.equal(message1.chatRoomId, chatRoom.id);
        assert.deepEqual(chatRoom1.messageIds, {[message.id]: true});
      })
      .finally(done);
    });

    test('remove', function(assert) {
      const done = assert.async();

      transform(
        addRecordOperation(chatRoom),
        addRecordOperation(message),
        replaceHasOneOperation(message, 'chatRoom', chatRoom),
        replaceHasOneOperation(message, 'chatRoom', null)
      )
      .then(() => fetchRecordsFromTables('messages', 'chat_rooms'))
      .then(({message1, chatRoom1}) => {
        assert.equal(message1.chatRoomId, null);
        assert.deepEqual(chatRoom1.messageIds, {});
      })
      .finally(done);
    });
  });

  module('hasMany to hasOne', function() {
    test('add to', function(assert) {
      const done = assert.async();
      const chatRoom = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room2'});
      const message = buildRecord('message', {id: 'message1', body: 'hello2'});

      transform(
        addRecordOperation(chatRoom),
        addRecordOperation(message),
        addToHasManyOperation(chatRoom, 'messages', message)
      )
      .then(() => fetchRecordsFromTables('messages', 'chat_rooms'))
      .then(({chatRoom1, message1}) => {
        assert.deepEqual(chatRoom1.messageIds, {[message.id]: true}, 'added to target field');
        assert.equal(message1.chatRoomId, chatRoom.id, 'added to inverse field');
      })
      .finally(done);
    });

    test('replace', function(assert) {
      const done = assert.async();
      const chatRoom = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room2'});
      const message1 = buildRecord('message', {id: 'message1', body: 'hello', chatRoomId: 'chatRoom1'});
      const message2 = buildRecord('message', {id: 'message2', body: 'hola', chatRoomId: 'chatRoom1'});
      const message3 = buildRecord('message', {id: 'message3', body: 'bienvenidos'});

      transform(
        addRecordOperation(chatRoom),
        addRecordOperation(message1),
        addRecordOperation(message2),
        addRecordOperation(message3),
        replaceHasManyOperation(chatRoom, 'messages', [message2, message3])
      )
      .then(() => fetchRecordsFromTables('messages', 'chat_rooms'))
      .then(({chatRoom1, message1, message2, message3}) => {
        assert.deepEqual(chatRoom1.messageIds, { message2: true, message3: true });
        assert.equal(message1.chatRoomId, null);
        assert.equal(message2.chatRoomId, 'chatRoom1');
        assert.equal(message3.chatRoomId, 'chatRoom1');
      })
      .finally(done);
    });

    test('replace with empty array', function(assert) {
      const done = assert.async();
      const chatRoom = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room2'});
      const message1 = buildRecord('message', {id: 'message1', body: 'hello', chatRoomId: 'chatRoom1'});
      const message2 = buildRecord('message', {id: 'message2', body: 'hola', chatRoomId: 'chatRoom1'});
      const message3 = buildRecord('message', {id: 'message3', body: 'bienvenidos'});

      transform(
        addRecordOperation(chatRoom),
        addRecordOperation(message1),
        addRecordOperation(message2),
        addRecordOperation(message3),
        replaceHasManyOperation(chatRoom, 'messages', [message2, message3]),
        replaceHasManyOperation(chatRoom, 'messages', [])
      )
      .then(() => fetchRecordsFromTables('messages', 'chat_rooms'))
      .then(({chatRoom1, message1, message2, message3}) => {
        assert.deepEqual(chatRoom1.messageIds, {});
        assert.equal(message1.chatRoomId, null);
        assert.equal(message2.chatRoomId, null);
        assert.equal(message3.chatRoomId, null);
      })
      .finally(done);
    });

    test('remove from', function(assert) {
      const done = assert.async();
      const chatRoom = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room2'});
      const message = buildRecord('message', {id: 'message1', body: 'hello'});

      transform(
        addRecordOperation(chatRoom),
        addRecordOperation(message),
        addToHasManyOperation(chatRoom, 'messages', message),
        removeFromHasManyOperation(chatRoom, 'messages', message)
      )
      .then(() => fetchRecordsFromTables('messages', 'chat_rooms'))
      .then(({message1, chatRoom1}) => {
        assert.equal(message1.chatRoomId, null);
        assert.deepEqual(chatRoom1.messageIds, {});
      })
      .finally(done);
    });
  });

  module('hasMany to hasMany', function() {
    test('add to', function(assert) {
      const done = assert.async();
      const user = buildRecord('user', {id: 'user1', name: 'Jim'});
      const chatRoom = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room2'});

      transform(
        addRecordOperation(user),
        addRecordOperation(chatRoom),
        addToHasManyOperation(user, 'chatRooms', chatRoom)
      )
      .then(() => fetchRecordsFromTables('users', 'chat_rooms'))
      .then(({user1, chatRoom1}) => {
        assert.deepEqual(user1.chatRoomIds, {chatRoom1: true}, 'add to hasMany');
        assert.deepEqual(chatRoom1.userIds, {user1: true}, 'add to inverse hasMany');
      })
      .finally(done);
    });

    test('remove from', function(assert) {
      const done = assert.async();
      const user = buildRecord('user', {id: 'user1', name: 'Jim'});
      const chatRoom = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room2'});

      transform(
        addRecordOperation(user),
        addRecordOperation(chatRoom),
        addToHasManyOperation(user, 'chatRooms', chatRoom),
        removeFromHasManyOperation(user, 'chatRooms', chatRoom)
      )
      .then(() => fetchRecordsFromTables('users', 'chat_rooms'))
      .then(({user1, chatRoom1}) => {
        assert.deepEqual(user1.chatRoomIds, {}, 'removed from hasMany');
        assert.deepEqual(chatRoom1.userIds, {}, 'removed from inverse hasMany');
      })
      .finally(done);
    });

    test('replace', function(assert) {
      const done = assert.async();
      const user1 = buildRecord('user', {id: 'user1', name: 'Jim'});
      const user2 = buildRecord('user', {id: 'user2', name: 'Mark'});
      const chatRoom1 = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room1'});
      const chatRoom2 = buildRecord('chatRoom', {id: 'chatRoom2', name: 'room2'});
      const chatRoom3 = buildRecord('chatRoom', {id: 'chatRoom3', name: 'room3'});

      transform(
        addRecordOperation(user1),
        addRecordOperation(user2),
        addRecordOperation(chatRoom1),
        addRecordOperation(chatRoom2),
        addRecordOperation(chatRoom3),
        addToHasManyOperation(user1, 'chatRooms', chatRoom1),
        addToHasManyOperation(user2, 'chatRooms', chatRoom2),
        replaceHasManyOperation(user1, 'chatRooms', [chatRoom2, chatRoom3])
      )
      .then(() => fetchRecordsFromTables('users', 'chat_rooms'))
      .then(({user1, user2, chatRoom1, chatRoom2, chatRoom3}) => {
        assert.deepEqual(user1.chatRoomIds, {chatRoom2: true, chatRoom3: true}, 'replaced hasMany');
        assert.deepEqual(chatRoom1.userIds, {}, 'removed from chatRoom1');
        assert.deepEqual(chatRoom2.userIds, {user1: true, user2: true}, 'user1 added to chatRoom2');
        assert.deepEqual(chatRoom3.userIds, {user1: true}, 'add user1 to chatRoom3');
      })
      .finally(done);
    });

    test('replace with an empty array', function(assert) {
      const done = assert.async();
      const user1 = buildRecord('user', {id: 'user1', name: 'Jim'});
      const user2 = buildRecord('user', {id: 'user2', name: 'Mark'});
      const chatRoom1 = buildRecord('chatRoom', {id: 'chatRoom1', name: 'room1'});
      const chatRoom2 = buildRecord('chatRoom', {id: 'chatRoom2', name: 'room2'});
      const chatRoom3 = buildRecord('chatRoom', {id: 'chatRoom3', name: 'room3'});

      transform(
        addRecordOperation(user1),
        addRecordOperation(user2),
        addRecordOperation(chatRoom1),
        addRecordOperation(chatRoom2),
        addRecordOperation(chatRoom3),
        addToHasManyOperation(user1, 'chatRooms', chatRoom1),
        addToHasManyOperation(user2, 'chatRooms', chatRoom2),
        replaceHasManyOperation(user1, 'chatRooms', [chatRoom2, chatRoom3]),
        replaceHasManyOperation(user1, 'chatRooms', [])
      )
      .then(() => fetchRecordsFromTables('users', 'chat_rooms'))
      .then(({user1, user2, chatRoom1, chatRoom2, chatRoom3}) => {
        assert.deepEqual(user1.chatRoomIds, {}, 'cleared user\'s chatRooms');
        assert.deepEqual(chatRoom1.userIds, {}, 'removed user from chatRoom1');
        assert.deepEqual(chatRoom2.userIds, {user2: true}, 'removed user from chatRoom2');
        assert.deepEqual(chatRoom3.userIds, {}, 'removed user from chatRoom3');
      })
      .finally(done);
    });
  });

  module('hasOne to hasOne', function() {
    test('replace', function(assert) {
      const done = assert.async();
      const user1 = buildRecord('user', {id: 'user1', name: 'Clark Kent'});
      const alterEgo1 = buildRecord('alterEgo', {id: 'alterEgo1', name: 'Superman'});

      transform(
        addRecordOperation(user1),
        addRecordOperation(alterEgo1),
        replaceHasOneOperation(user1, 'alterEgo', alterEgo1)
      )
      .then(() => fetchRecordsFromTables('users', 'alter_egos'))
      .then(({user1, alterEgo1}) => {
        assert.equal(user1.alterEgoId, 'alterEgo1', 'updated hasOne');
        assert.equal(alterEgo1.userId, 'user1', 'updated inverse hasOne');
      })
      .finally(done);
    });

    test('remove', function(assert) {
      const done = assert.async();
      const user1 = buildRecord('user', {id: 'user1', name: 'Clark Kent'});
      const alterEgo1 = buildRecord('alterEgo', {id: 'alterEgo1', name: 'Superman'});

      transform(
        addRecordOperation(user1),
        addRecordOperation(alterEgo1),
        replaceHasOneOperation(user1, 'alterEgo', alterEgo1),
        replaceHasOneOperation(user1, 'alterEgo', null)
      )
      .then(() => fetchRecordsFromTables('users', 'alter_egos'))
      .then(({user1, alterEgo1}) => {
        assert.equal(user1.alterEgoId, null, 'updated hasOne');
        assert.equal(alterEgo1.userId, null, 'updated inverse hasOne');
      })
      .finally(done);
    });
  });
});
