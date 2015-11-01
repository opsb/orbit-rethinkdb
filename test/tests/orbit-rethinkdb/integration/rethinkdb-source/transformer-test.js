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
  replaceRelationshipOperation,
  operationType,
  addToRelationshipOperation,
  removeFromRelationshipOperation
} from 'orbit-common/lib/operations';
import Transform from 'orbit/transform';
import chattySchema from 'tests/support/chatty-schema';
import RethinkdbWebsocketClient from 'npm:rethinkdb-websocket-client';

function addHasOneOperation(record, relationship, value) {
  return toOperation(
    'add',
    [record.type, record.id, 'relationships', relationship, 'data'],
    toIdentifier(value.type, value.id)
  );
}

function replaceHasOneOperation(record, relationship, value) {
  return toOperation(
    'replace',
    [record.type, record.id, 'relationships', relationship, 'data'],
    toIdentifier(value.type, value.id)
  );
}

function removeHasOneOperation(record, relationship) {
  return toOperation(
    'remove',
    [record.type, record.id, 'relationships', relationship]
  );
}

const r = RethinkdbWebsocketClient.rethinkdb;

const {skip} = QUnit;

let conn;
let transformer;
let serializer;
let finder;

function buildRecord(...args) {
  return serializer.deserialize(...args);
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
    const message = buildRecord('message', {id: 1, body: 'hello'});
    const addRecordTransform = new Transform([addRecordOperation(message)]);

    transformer.transform(addRecordTransform)
      .then(() => finder.findByType('message'))
      .then((messages) => {
        assert.deepEqual(messages[0], message);
      })
      .then(done);
  });

  test('can add record with has one', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});
    const addChatRoomTransform = new Transform([addRecordOperation(chatRoom)]);
    const message = buildRecord('message', {id: 1, body: 'hello', chatRoomId: 1});
    const addMessageTransform = new Transform([addRecordOperation(message)]);

    transformer.transform(addChatRoomTransform)
      .then(() => transformer.transform(addMessageTransform))
      .then(() => finder.findByType('message'))
      .then((messages) => {
        assert.equal(messages[0].relationships.chatRoom.data, 'chatRoom:1');
      })
      .then(done);

  });

  test('can add record with hasMany', function(assert) {
    const done = assert.async();
    const message = buildRecord('message', {id: 1, body: 'hello'});

    // todo - buildRecord doesn't handle hasManys
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});
    chatRoom.relationships.messages.data = {'message:1': true};

    Orbit.Promise.resolve()
      .then(() => transformer.transform(new Transform(addRecordOperation(message))))
      .then(() => transformer.transform(new Transform(addRecordOperation(chatRoom))))
      .then(() => finder.findByType('message'))
      .then(messages => {
        assert.deepEqual(messages[0].relationships.chatRoom.data, 'chatRoom:1');
      })
      .then(done);
  });

  test('can remove record', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});

    Orbit.Promise.resolve()
      .then(() => transformer.transform(new Transform(addRecordOperation(chatRoom))))
      .then(() => transformer.transform(new Transform(removeRecordOperation(chatRoom))))
      .then(() => finder.findByType('chatRoom'))
      .then(chatRooms => {
        assert.equal(chatRooms.length, 0);
      })
      .then(done);
  });

  test('can add hasOne', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});
    const message = buildRecord('message', {id: 1, body: 'hello'});

    mapSeries(
      [
        addRecordOperation(chatRoom),
        addRecordOperation(message),
        addHasOneOperation(message, 'chatRoom', chatRoom),
      ],
      operation => transformer.transform(new Transform([operation]))
    )
    .then(() => finder.findByType('message'))
    .then(messages => {
      assert.equal(messages[0].relationships.chatRoom.data, `chatRoom:${chatRoom.id}`);
    })
    .then(done);
  });

  test('can replace hasOne', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});
    const message = buildRecord('message', {id: 1, body: 'hello'});

    mapSeries(
      [
        addRecordOperation(chatRoom),
        addRecordOperation(message),
        replaceHasOneOperation(message, 'chatRoom', chatRoom),
      ],
      operation => transformer.transform(new Transform([operation]))
    )
    .then(() => finder.findByType('message'))
    .then(messages => {
      assert.equal(messages[0].relationships.chatRoom.data, `chatRoom:${chatRoom.id}`);
    })
    .then(done);
  });

  test('can remove hasOne', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});
    const message = buildRecord('message', {id: 1, body: 'hello'});

    mapSeries(
      [
        addRecordOperation(chatRoom),
        addRecordOperation(message),
        addHasOneOperation(message, 'chatRoom', chatRoom),
        removeHasOneOperation(message, 'chatRoom'),
      ],
      operation => transformer.transform(new Transform([operation]))
    )
    .then(() => finder.findByType('message'))
    .then(messages => {
      assert.equal(messages[0].relationships.chatRoom.data, null);
    })
    .then(done);
  });

  test('can add to hasMany', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});
    const message = buildRecord('message', {id: 1, body: 'hello'});

    mapSeries(
      [
        addRecordOperation(chatRoom),
        addRecordOperation(message),
        addToRelationshipOperation(chatRoom, 'messages', message),
      ],
      operation => transformer.transform(new Transform([operation]))
    )
    .then(() => finder.findByType('message'))
    .then(messages => {
      assert.equal(messages[0].relationships.chatRoom.data, `chatRoom:${chatRoom.id}`);
    })
    .then(done);
  });

  test('can replace hasMany', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});
    const message1 = buildRecord('message', {id: 1, body: 'hello', chatRoomId: 1});
    const message2 = buildRecord('message', {id: 2, body: 'hola', chatRoomId: 1});
    const message3 = buildRecord('message', {id: 3, body: 'bienvenidos'});

    mapSeries(
      [
        addRecordOperation(chatRoom),
        addRecordOperation(message1),
        addRecordOperation(message2),
        addRecordOperation(message3),
        replaceRelationshipOperation(chatRoom, 'messages', [message2, message3]),
      ],
      operation => transformer.transform(new Transform([operation]))
    )
    .then(() => finder.findByType('message'))
    .then(messages => {

      const messagesById = {};
      messages.forEach((message) => messagesById[message.id] = message);

      assert.equal(messagesById[1].relationships.chatRoom.data, null);
      assert.equal(messagesById[2].relationships.chatRoom.data, 'chatRoom:1');
      assert.equal(messagesById[3].relationships.chatRoom.data, 'chatRoom:1');
    })
    .then(done);
  });

  test('can remove from hasMany', function(assert) {
    const done = assert.async();
    const chatRoom = buildRecord('chatRoom', {id: 1, name: 'room2'});
    const message = buildRecord('message', {id: 1, body: 'hello'});

    mapSeries(
      [
        addRecordOperation(chatRoom),
        addRecordOperation(message),
        addToRelationshipOperation(chatRoom, 'messages', message),
        removeFromRelationshipOperation(chatRoom, 'messages', message),
      ],
      operation => transformer.transform(new Transform([operation]))
    )
    .then(() => finder.findByType('message'))
    .then(messages => {
      assert.equal(messages[0].relationships.chatRoom.data, null);
    })
    .then(done);
  });
});
