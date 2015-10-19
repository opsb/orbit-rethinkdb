import { Class } from 'orbit/lib/objects';
import { lookupTransformation } from './transformations';

export default Class.extend({
  init(schema) {
    this._schema = schema;
  },

  deserialize: function(type, record){
    record = record || {};
    var data = {type};

    this.deserializeKeys(type, record, data);
    this.deserializeAttributes(type, record, data);
    this.deserializeRelationships(type, record, data);

    return this._schema.normalize(data);
  },

  deserializeKeys: function(type, record, data){
    data.id = record.id;
  },

  deserializeAttributes: function(type, record, data){
    var modelSchema = this._schema.models[type];

    data.attributes = {};
    Object.keys(modelSchema.attributes).forEach(function(attr) {
      this.deserializeAttribute(type, record, attr, data);
    }, this);
  },

  deserializeAttribute: function(type, record, attr, data){
    var attrType = this._schema.models[type].attributes[attr].type;
    var transformation = lookupTransformation(attrType);
    var serialized = record[attr];
    var deserialized = transformation.deserialize(serialized);

    data.attributes[attr] = deserialized || null;
  },

  deserializeRelationships: function(type, record, data) {
    var modelSchema = this._schema.models[type];
    data.relationships = {};

    Object.keys(modelSchema.relationships).forEach((relationshipName) => {
      const relationship = modelSchema.relationships[relationshipName];

      if(relationship.type === 'hasOne') {
        data.relationships[relationshipName] = {
          data: record[`${relationshipName}Key`] || null
        };
      }
    });
  }
});
