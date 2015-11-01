import Orbit from 'orbit/main';
import {Class} from 'orbit/lib/objects';
import { operationType } from 'orbit-common/lib/operations';
import { parseIdentifier } from 'orbit-common/lib/identifiers';

const singularize = Orbit.singularize;

export default Class.extend({
  init(conn, serializer, schema, r) {
    this._conn = conn;
    this._serializer = serializer;
    this._r = r;
    this._schema = schema;
  },

  transform(transform) {
    return Orbit.Promise.all(transform.operations.map((operation) => {
      return this._transformOperation(operation);
    }));
  },

  _transformOperation(operation) {
    const type = operationType(operation);
    const handler = this[`_${type}`];

    if(!handler) throw new Error(`no handler for ${type}`);

    return handler.call(this, operation);
  },

  _addRecord(operation) {
    const [model, recordId] = operation.path;
    const record = operation.value;
    const tableName = this._serializer.tableName(operation.path[0]);
    const serialized = this._serializer.serialize(record);
    const modelDefinition = this._schema.modelDefinition(model);

    return this._r.table(tableName).insert(serialized).run(this._conn)
      .then(() => Orbit.Promise.all(
        Object.keys(modelDefinition.relationships).map((relationship) => {
          const relatedTableName = this._serializer.tableName(relationship);
          const relationshipDefinition = this._schema.relationshipDefinition(model, relationship);
          const refs = record.relationships[relationship].data;

          if(relationshipDefinition.type === 'hasMany' && refs) {
            const ids = Object.keys(refs).map((ref) => parseInt(parseIdentifier(ref).id));
            const fieldName = this._serializer.fieldName(relationshipDefinition.model, relationshipDefinition.inverse);
            return this._r.table(relatedTableName).getAll(this._r.args(ids)).update({[fieldName]: recordId}).run(this._conn);
          }
        })
      ));
  },

  _removeRecord(operation) {
    const [model, recordId] = operation.path;
    const tableName = this._serializer.tableName(model);
    return this._r.table(tableName).get(recordId).delete().run(this._conn);
  },

  _addRelationship(operation) {
    const [model,,, relationship] = operation.path;
    const relationshipType = this._schema.relationshipDefinition(model, relationship).type;

    if(relationshipType !== 'hasOne') throw new Error(`Add ${relationshipType} not supported`);
    return this._addHasOne(operation);
  },

  _replaceRelationship(operation) {
    const [model,,, relationship] = operation.path;
    const relationshipType = this._schema.relationshipDefinition(model, relationship).type;

    if(relationshipType === 'hasOne') return this._replaceHasOne(operation);
    if(relationshipType === 'hasMany') return this._replaceHasMany(operation);
    throw new Error(`Relationship type not supported: ${relationshipType}`);
  },

  _addHasOne(operation) {
    const [model, recordId,, relationship] = operation.path;

    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(model, relationship);
    const fieldValue = this._serializer.idFromRef(operation.value);

    return this._r.table(tableName).get(recordId).update({[fieldName]: fieldValue}).run(this._conn);
  },

  _replaceHasOne(operation) {
    return this._addHasOne(operation);
  },

  _replaceHasMany(operation) {
    const [model, recordId,, relationship] = operation.path;
    const refs = Object.keys(operation.value);
    const ids = refs.map((ref) => this._serializer.idFromRef(ref));
    const tableName = this._serializer.tableName(relationship);
    const fieldName = this._serializer.fieldName(singularize(relationship), model);

    return Orbit.Promise.resolve()
      .then(() => {
        return this._r.table(tableName).filter({[fieldName]: recordId}).update({[fieldName]: null}).run(this._conn);
      })
      .then(() => {
        return this._r.table(tableName).getAll(this._r.args(ids)).update({[fieldName]: recordId}).run(this._conn);
      });
  },

  _addToRelationship(operation) {
    return this._addToHasMany(operation);
  },

  _addToHasMany(operation) {
    const [model, recordId,, relationship,, ref] = operation.path;

    const tableName = this._serializer.tableName(relationship);
    const relatedRecordId = this._serializer.idFromRef(ref);
    const fieldName = this._serializer.fieldName(singularize(relationship), model);
    const fieldValue = recordId;

    return this._r.table(tableName).get(relatedRecordId).update({[fieldName]: fieldValue}).run(this._conn);
  },

  _removeRelationship(operation) {
    return this._removeHasOne(operation);
  },

  _removeHasOne(operation) {
    const [model, recordId,, relationship, ref] = operation.path;
    const tableName = this._serializer.tableName(model);
    const relatedRecordId = this._serializer.idFromRef(ref);
    const fieldName = this._serializer.fieldName(model, relationship);

    return this._r.table(tableName).get(recordId).update({[fieldName]: null}).run(this._conn);
  },

  _removeFromRelationship(operation) {
    return this._removeFromHasMany(operation);
  },

  _removeFromHasMany(operation) {
    const [model, recordId,, relationship,, ref] = operation.path;

    const tableName = this._serializer.tableName(relationship);
    const relatedRecordId = this._serializer.idFromRef(ref);
    const fieldName = this._serializer.fieldName(singularize(relationship), model);

    return this._r.table(tableName).get(relatedRecordId).update({[fieldName]: null}).run(this._conn);
  }
});
