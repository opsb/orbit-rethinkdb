import { Class } from 'orbit/lib/objects';
import { lookupTransformation } from './transformations';
import { underscore, dasherize } from 'orbit/lib/strings';
import Orbit from 'orbit/main';

const { pluralize, singularize } = Orbit;

export default Class.extend({
  init(schema) {
    this._schema = schema;
  },

  tableName(type) {
    return underscore(pluralize(type));
  },

  typeFromTableName(tableName) {
    return singularize(dasherize(tableName));
  },

  fieldName(model, relationship) {
    const relationshipType = this._schema.relationshipDefinition(model, relationship).type;

    return relationshipType === 'hasMany' ? `${relationship}Ids` : `${relationship}Id`;
  },

  idFromRef(ref) {
    return ref ? parseInt(ref.split(':')[1]) : null;
  },

  serialize(record) {
    const type = record.type;

    const json = {};

    this.serializeKeys(type, record, json);
    this.serializeAttributes(type, record, json);
    this.serializeRelationships(type, record, json);

    return json;
  },

  serializeKeys(type, record, json) {
    json.id = record.id;
  },

  serializeAttributes(type, record, json) {
    const modelSchema = this._schema.modelDefinition(type);

    Object.keys(modelSchema.attributes).forEach((attr) => {
      this.serializeAttribute(type, record, attr, json);
    }, this);
  },

  serializeAttribute(type, record, attr, json) {
    const attrType = this._schema.modelDefinition(type).attributes[attr].type;
    const transformation = lookupTransformation(attrType);
    const value = record.attributes[attr];
    const serialized = transformation.serialize(value);

    json[attr] = serialized;
  },

  serializeRelationships(type, record, json) {
    const modelSchema = this._schema.modelDefinition(type);
    const relationships = modelSchema.relationships;

    Object.keys(relationships).forEach((relationshipName) => {
      const relationship = relationships[relationshipName];

      if (relationship.type === 'hasOne') {
        const value = record.relationships[relationshipName].data;
        json[`${relationshipName}Id`] = this.idFromRef(value);
      }
    });
  },

  deserialize(type, record) {
    record = record || {};
    const data = {type};

    this.deserializeKeys(type, record, data);
    this.deserializeAttributes(type, record, data);
    this.deserializeRelationships(type, record, data);
    return this._schema.normalize(data);
  },

  deserializeKeys(type, record, data) {
    data.id = record.id;
  },

  deserializeAttributes(type, record, data) {
    const modelDefinition = this._schema.modelDefinition(type);

    data.attributes = {};
    Object.keys(modelDefinition.attributes).forEach((attr) => {
      this.deserializeAttribute(type, record, attr, data);
    }, this);
  },

  deserializeAttribute(type, record, attr, data) {
    const attrType = this._schema.modelDefinition(type).attributes[attr].type;
    const transformation = lookupTransformation(attrType);
    const serialized = record[attr];
    const deserialized = transformation.deserialize(serialized);

    data.attributes[attr] = deserialized || null;
  },

  deserializeRelationships(type, record, data) {
    const modelDefinition = this._schema.modelDefinition(type);
    data.relationships = {};

    Object.keys(modelDefinition.relationships).forEach((relationshipName) => {
      const relationship = modelDefinition.relationships[relationshipName];

      if (relationship.type === 'hasOne') {
        const id = record[`${relationshipName}Id`];
        const ref = id && `${relationship.model}:${id}`;

        data.relationships[relationshipName] = {
          data: ref || null,
        };
      } else if (relationship.type === 'hasMany') {
        data.relationships[relationshipName] = {
          data: null,
        };
      } else {
        console.error(`no serializer for relationship type: '${relationship.type}'`);
      }
    });
  },
});
