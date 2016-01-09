// jscs:disable requireSpaceAfterComma
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

    if (!handler) throw new Error(`no handler for ${type}`);

    return handler.call(this, operation);
  },

  _addRecord(operation) {
    const [model, recordId] = operation.path;
    const record = operation.value;
    const tableName = this._serializer.tableName(operation.path[0]);
    const serialized = this._serializer.serialize(record);

    return this._r.table(tableName).insert(serialized).run(this._conn)
      .then(() => {
        const addHasManys = this._mapRelationships(model, (name, definition) => {
          const refs = record.relationships[name].data;

          if (definition.type === 'hasMany' && refs) {
            const relatedTableName = this._serializer.tableName(name);
            const ids = Object.keys(refs).map((ref) => parseInt(parseIdentifier(ref).id));

            if (ids.length > 0) {
              const fieldName = this._serializer.fieldName(`relationships/${definition.inverse}`);
              return this._r.table(relatedTableName).getAll(this._r.args(ids)).update({[fieldName]: recordId}).run(this._conn);
            }
          }
        });

        return Orbit.Promise.all(addHasManys);
      });
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

  _replaceHasOne(operation) {
    const [model, recordId,, relationship] = operation.path;

    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`relationships/${relationship}`);
    const fieldValue = this._serializer.idFromRef(operation.value);

    return this._r.table(tableName).get(recordId).update({[fieldName]: fieldValue}).run(this._conn);
  },

  _replaceHasMany(operation) {
    const [model, recordId,, relationship] = operation.path;
    const refs = Object.keys(operation.value);
    const ids = refs.map((ref) => this._serializer.idFromRef(ref));
    const modelDefinition = this._schema.modelDefinition(model);
    const inverseRelationship = modelDefinition.relationships[relationship].inverse;

    const tableName = this._serializer.tableName(relationship);
    const fieldName = this._serializer.fieldName(`relationships/${inverseRelationship}`);

    return Orbit.Promise.resolve()
      .then(() => {
        return this._r.table(tableName).filter({[fieldName]: recordId}).update({[fieldName]: null}).run(this._conn);
      })
      .then(() => {
        return this._r.table(tableName).getAll(this._r.args(ids)).update({[fieldName]: recordId}).run(this._conn);
      });
  },

  _addToHasMany(operation) {
    const [model, recordId,, relationship,, ref] = operation.path;

    const tableName = this._serializer.tableName(relationship);
    const relatedRecordId = this._serializer.idFromRef(ref);
    const modelDefinition = this._schema.modelDefinition(model);
    const inverseRelationship = modelDefinition.relationships[operation.path[3]].inverse;
    const fieldName = this._serializer.fieldName(`relationships/${inverseRelationship}`);
    const fieldValue = recordId;

    return this._r.table(tableName).get(relatedRecordId).update({[fieldName]: fieldValue}).run(this._conn);
  },

  _removeFromHasMany(operation) {
    const [model, recordId,, relationship,, ref] = operation.path;

    const tableName = this._serializer.tableName(relationship);
    const relatedRecordId = this._serializer.idFromRef(ref);
    const modelDefinition = this._schema.modelDefinition(model);
    const inverseRelationship = modelDefinition.relationships[operation.path[3]].inverse;
    const fieldName = this._serializer.fieldName(`relationships/${inverseRelationship}`);

    return this._r.table(tableName).get(relatedRecordId).update({[fieldName]: null}).run(this._conn);
  },
});

// jscs:enable requireSpaceAfterComma
