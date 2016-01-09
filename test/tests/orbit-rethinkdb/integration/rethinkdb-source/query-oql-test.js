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
import Transform from 'orbit/transform';

const skip = QUnit.skip;

let source;
let conn;

function buildRecord(...args) {
  return source._serializer.deserialize(...args);
}

module('Integration - RethinkdbSource - #query - oql', function(hooks) {
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
    const message = {id: 'message1', body: 'Hello'};
    const normalizedMessage = chattySchema.normalize({ type: 'message', id: message.id, attributes: { body: message.body } });

    r.table('messages').insert(message).run(conn);

    source
      .query({ oql: oqe('recordsOfType', 'message'), })
      .then(results => {
        assert.deepEqual(results, { message1: normalizedMessage });
        done();
      });
  });

  test('filter - using predicate', function(assert) {
    const done = assert.async();
    const messageA = chattySchema.normalize({ type: 'message', attributes: { body: 'body1', author: 'jim' }, });
    const messageB = chattySchema.normalize({ type: 'message', attributes: { body: 'body2', author: 'mark' }, });
    const messageC = chattySchema.normalize({ type: 'message', attributes: { body: 'body3', author: 'june' }, });

    Orbit.Promise.all([
      source.transform(new Transform([addRecordOperation(messageA)])),
      source.transform(new Transform([addRecordOperation(messageB)])),
    ])
    .then(() => {
      const query = {
        oql:
          oqe(
            'filter',
            oqe('recordsOfType', 'message'),
            oqe('or',
              oqe('and',
                oqe('equal', oqe('get', 'attributes/body'), 'body1'),
                oqe('equal', oqe('get', 'attributes/author'), 'jim')
              ),
              oqe('and',
                oqe('equal', oqe('get', 'attributes/body'), 'body2'),
                oqe('equal', oqe('get', 'attributes/author'), 'mark'),
                oqe('equal', oqe('get', 'attributes/body'), 'body2')
              ),
              oqe('or'), // 'or' operator can accept any number of args including zero
              oqe('and') // 'and' operator can accept any number of args including zero
            )
          ),
      };

      source
        .query(query)
        .then(results => {
          assert.deepEqual(results, {
            [messageA.id]: messageA,
            [messageB.id]: messageB,
          });
          done();
        });
    });
  });

  test('record', function(assert) {
    const done = assert.async();
    const messageA = chattySchema.normalize({ type: 'message', id: 'messageA', attributes: { body: 'body1' }, });

    Orbit.Promise.all([
      source.transform(new Transform([addRecordOperation(messageA)])),
    ])
    .then(() => {
      source
        .query({ oql: oqe('record', 'message', 'messageA'), })
        .then(results => {
          assert.deepEqual(results, { [messageA.id]: messageA });
          done();
        });
    });
  });

  test('relatedRecords', function(assert) {
    const done = assert.async();
    const message = chattySchema.normalize({ type: 'message', id: 'message1', attributes: { body: 'body1' }, });
    const chatRoom = chattySchema.normalize({ type: 'chatRoom', id: 'chatRoom1', attributes: { name: 'room1' } });

    Orbit.Promise.all([
      source.transform(new Transform([addRecordOperation(message)])),
      source.transform(new Transform([addRecordOperation(chatRoom)])),
    ])
    .then(() => source.transform(new Transform([replaceHasOneOperation(message, 'chatRoom', chatRoom)])))
    .then(() => {
      Orbit.Promise.all([
        source.query({ oql: oqe('relatedRecords', 'chatRoom', 'chatRoom1', 'messages'), }),
        source.query({ oql: oqe('record', 'message', 'message1') }),
      ])
      .then(([results, expectedResults]) => {
        assert.deepEqual(results, expectedResults);
        done();
      });
    });
  });

  test('relatedRecord', function(assert) {
    const done = assert.async();
    const message = chattySchema.normalize({ type: 'message', id: 'message1', attributes: { body: 'body1' }, });
    const chatRoom = chattySchema.normalize({ type: 'chatRoom', id: 'chatRoom1', attributes: { name: 'room1' } });

    Orbit.Promise.all([
      source.transform(new Transform([addRecordOperation(message)])),
      source.transform(new Transform([addRecordOperation(chatRoom)])),
    ])
    .then(() => source.transform(new Transform([replaceHasOneOperation(message, 'chatRoom', chatRoom)])))
    .then(() => {
      Orbit.Promise.all([
        source.query({ oql: oqe('relatedRecord', 'message', 'message1', 'chatRoom'), }),
        source.query({ oql: oqe('record', 'chatRoom', 'chatRoom1') }),
      ])
      .then(([results, expectedResults]) => {
        assert.deepEqual(results, expectedResults);
        done();
      });
    });
  });
});
