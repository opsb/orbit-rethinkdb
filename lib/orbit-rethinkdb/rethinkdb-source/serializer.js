import { Class } from 'orbit/lib/objects';
import { lookupTransformation } from './transformations';
import { underscore, dasherize, camelize } from 'orbit/lib/strings';
import Orbit from 'orbit/main';
import { parseIdentifier } from 'orbit-common/lib/identifiers';
import { prependKeys } from './utils/collection';

const { pluralize, singularize } = Orbit;

export default Class.extend({
  init(schema) {
    this._schema = schema;
  },

  tableName(type) {
    return underscore(pluralize(type));
  },

  typeFromTableName(tableName) {
    return camelize(singularize(tableName));
  },

  fieldName(path) {
    const [type, field] = path.split('/');

    switch (type) {
      case 'relationships': return this._relationshipType(field) === 'hasMany' ? field.replace(/s$/, 'Ids') : `${field}Id`;
      case 'attributes': return field;
      default: throw new Error('path not recognised: ' + path);
    }
  },

  _relationshipType(relationshipName) {
    return relationshipName.match(/s$/) ? 'hasMany' : 'hasOne';
  },

  idFromRef(ref) {
    return ref ? ref.split(':')[1] : null;
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
      } else if (relationship.type === 'hasMany') {
        const value = record.relationships[relationshipName].data;

        if (value) {
          const recordIds = Object.keys(value).reduce((hash, ref) => {
            const recordId = parseIdentifier(ref).id;
            hash[recordId] = true;
            return hash;
          }, {});

          json[`${relationshipName.replace(/s$/, '')}Ids`] = recordIds;
        }
      }
    });
  },

  deserializeAll(type, documents) {
    const records = documents.map(document => this.deserialize(type, document));

    const recordsById = records.reduce((reduced, record) => {
      reduced[record.id] = record;
      return reduced;
    }, {});

    return recordsById;
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
        this._deserializeHasOne(record, relationshipName, relationship.model, data);
      } else if (relationship.type === 'hasMany') {
        this._deserializeHasMany(record, relationshipName, relationship.model, data);
      } else {
        console.error(`no serializer for relationship type: '${relationship.type}'`);
      }
    });
  },

  _deserializeHasOne(record, relationshipName, relationshipModel, data) {
    const id = record[`${relationshipName}Id`];
    const ref = id && `${relationshipModel}:${id}`;

    data.relationships[relationshipName] = {
      data: ref || null,
    };
  },

  _deserializeHasMany(record, relationshipName, relationshipModel, data) {
    const fieldName = this.fieldName(`relationships/${relationshipName}`);
    const value = record[fieldName] || {};
    const refs = prependKeys(value, `${relationshipModel}:`);

    data.relationships[relationshipName] = {
      data: refs,
    };
  },
});
