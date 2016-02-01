// jscs:disable requireSpaceAfterComma
import Orbit from 'orbit/main';
import { Class } from 'orbit/lib/objects';
import { operationType } from 'orbit-common/lib/operations';
import { parseIdentifier } from 'orbit-common/lib/identifiers';
import RethinkdbDao from './rethinkdb-dao';

const singularize = Orbit.singularize;

export default Class.extend({
  init(conn, serializer, schema, r) {
    this._conn = conn;
    this._serializer = serializer;
    this._r = r;
    this._schema = schema;
    this._rethinkdbDao = new RethinkdbDao(conn, serializer, r);
  },

  transform(transform) {
    return Orbit.Promise.all(transform.operations.map((operation) => {
      return this._transformOperation(operation);
    }));
  },

  _transformOperation(operation) {
    const type = operationType(operation);
    const handler = this[`_${type}`];

    if (!handler) throw new Error(`no handler for ${type}`);

    return handler.call(this, operation);
  },

  _addRecord(operation) {
    const [model, recordId] = operation.path;
    const record = operation.value;
    const tableName = this._serializer.tableName(operation.path[0]);
    const serialized = this._serializer.serialize(record);

    return this._r.table(tableName)
      .insert(serialized).run(this._conn)
      .then(() => this._addInverses(model, record));
  },

  _addInverses(model, record) {
    const addInverses = this._mapRelationships(model, (name, definition) => {
      const data = record.relationships[name].data;

      if (data) {
        const relatedRecordIds = definition.type === 'hasOne' ? [parseIdentifier(data).id] : Object.keys(data).map(ref => parseIdentifier(ref).id);
        const inverseRelationship = this._schema.relationshipDefinition(definition.model, definition.inverse);
        if (relatedRecordIds.length === 0) { return; }

        if (inverseRelationship.type === 'hasOne') {
          return this._rethinkdbDao.replaceHasOnes(name, relatedRecordIds, definition.inverse, record.id);
        } else if (inverseRelationship.type === 'hasMany') {
          return this._rethinkdbDao.addToHasManys(name, relatedRecordIds, definition.inverse, record.id);
        }
      }
    });

    return Orbit.Promise.all(addInverses);
  },

  _mapRelationships(model, callback) {
    const modelDefinition = this._schema.modelDefinition(model);
    const relationshipNames = Object.keys(modelDefinition.relationships);

    return relationshipNames.map((name) => {
      const definition = this._schema.relationshipDefinition(model, name);
      return callback(name, definition);
    });
  },

  _removeRecord(operation) {
    const [model, recordId] = operation.path;
    const tableName = this._serializer.tableName(model);
    return this._r.table(tableName).get(recordId).delete().run(this._conn);
  },

  _replaceAttribute(operation) {
    const [model, recordId,, attribute] = operation.path;

    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`attributes/${attribute}`);
    const fieldValue = operation.value;

    return this._r.table(tableName).get(recordId).update({[fieldName]: fieldValue}).run(this._conn);
  },

  _replaceHasOne(operation) {
    const [model, recordId,, relationship] = operation.path;

    const relatedRecordId = this._serializer.idFromRef(operation.value);

    const modelDefinition = this._schema.modelDefinition(model);
    const relationshipDefinition = modelDefinition.relationships[relationship];
    const inverseRelationship = relationshipDefinition.inverse;
    const inverseRelationshipDefinition = this._schema.relationshipDefinition(relationshipDefinition.model, relationshipDefinition.inverse);
    const inverseModel = modelDefinition.relationships[relationship].model;

    if (relatedRecordId) {
      const updateTarget = this._rethinkdbDao.replaceHasOne(model, recordId, relationship, relatedRecordId);

      let updateInverse;
      if (inverseRelationshipDefinition.type === 'hasMany') {
        updateInverse = this._rethinkdbDao.addToHasMany(inverseModel, relatedRecordId, inverseRelationship, recordId);
      } else {
        updateInverse = this._rethinkdbDao.replaceHasOne(inverseModel, relatedRecordId, inverseRelationship, recordId);
      }

      return Orbit.Promise.all([updateTarget, updateInverse]);
    } else {
      return this._rethinkdbDao.fetchRelationship(model, recordId, relationship)
        .then((removedChatRoomId) => {
          const updateTarget = this._rethinkdbDao.replaceHasOne(model, recordId, relationship, relatedRecordId);

          let updateInverse;
          if (inverseRelationshipDefinition.type === 'hasMany') {
            updateInverse = this._rethinkdbDao.removeFromHasMany(inverseModel, removedChatRoomId, inverseRelationship, recordId);
          } else {
            updateInverse = this._rethinkdbDao.replaceHasOne(inverseModel, removedChatRoomId, inverseRelationship, null);
          }

          return Orbit.Promise.all([updateTarget, updateInverse]);
        });
    }
  },

  _replaceHasMany(operation) {
    const [model, recordId,, relationship] = operation.path;
    const refs = Object.keys(operation.value);
    const ids = refs.map((ref) => this._serializer.idFromRef(ref));
    const modelDefinition = this._schema.modelDefinition(model);
    const relationshipDefinition = modelDefinition.relationships[relationship];
    const inverseRelationship = relationshipDefinition.inverse;
    const inverseRelationshipDefinition = this._schema.relationshipDefinition(relationshipDefinition.model, relationshipDefinition.inverse);

    const tableName = this._serializer.tableName(relationship);
    const fieldName = this._serializer.fieldName(`relationships/${inverseRelationship}`);

    const replaceHasMany = this._rethinkdbDao.replaceHasMany(model, recordId, relationship, ids);

    let updateInverse;

    if (inverseRelationshipDefinition.type === 'hasOne') {
      updateInverse = this._rethinkdbDao
        .clearHasOnesMatching(relationship, inverseRelationship, recordId)
        .then(() => {
          if (ids.length === 0) { return; }

          return this._rethinkdbDao.replaceHasOnes(relationship, ids, inverseRelationship, recordId);
        });
    } else {
      updateInverse = this._rethinkdbDao
        .removeFromHasManysMatching(relationship, inverseRelationship, recordId)
        .then(() => {
          if (ids.length === 0) { return; }

          return this._rethinkdbDao.addToHasManys(relationship, ids, inverseRelationship, recordId);
        });
    }

    return Orbit.Promise.all([replaceHasMany, updateInverse]);
  },

  _addToHasMany(operation) {
    const [model, recordId,, relationship,, ref] = operation.path;

    const inverseRecordId = this._serializer.idFromRef(ref);

    const modelDefinition = this._schema.modelDefinition(model);
    const relationshipDefinition = modelDefinition.relationships[operation.path[3]];
    const inverseRelationship = relationshipDefinition.inverse;
    const inverseRelationshipDefinition = this._schema.relationshipDefinition(relationshipDefinition.model, relationshipDefinition.inverse);

    const addToTarget = this._rethinkdbDao.addToHasMany(model, recordId, relationship, inverseRecordId);

    let addToInverse;
    if (inverseRelationshipDefinition.type === 'hasOne') {
      addToInverse = this._rethinkdbDao.replaceHasOne(relationship, inverseRecordId, inverseRelationship, recordId);
    } else {
      addToInverse = this._rethinkdbDao.addToHasMany(relationship, inverseRecordId, inverseRelationship, recordId);
    }

    return Orbit.Promise.all([addToTarget, addToInverse]);
  },

  _removeFromHasMany(operation) {
    const [model, recordId,, relationship,, ref] = operation.path;

    const inverseRecordId = this._serializer.idFromRef(ref);
    const modelDefinition = this._schema.modelDefinition(model);
    const relationshipDefinition = modelDefinition.relationships[operation.path[3]];
    const inverseRelationship = relationshipDefinition.inverse;
    const inverseRelationshipDefinition = this._schema.relationshipDefinition(relationshipDefinition.model, relationshipDefinition.inverse);

    const removeFromTarget = this._rethinkdbDao.removeFromHasMany(model, recordId, relationship, inverseRecordId);

    let removeFromInverse;
    if (inverseRelationshipDefinition.type === 'hasOne') {
      removeFromInverse = this._rethinkdbDao.replaceHasOne(relationship, inverseRecordId, inverseRelationship, null);
    } else {
      removeFromInverse = this._rethinkdbDao.removeFromHasMany(relationship, inverseRecordId, inverseRelationship, recordId);
    }

    return Orbit.Promise.all([removeFromTarget, removeFromInverse]);
  },
});

// jscs:enable requireSpaceAfterComma
