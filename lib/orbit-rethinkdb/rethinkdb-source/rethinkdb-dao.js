import { Class } from 'orbit/lib/objects';

export default Class.extend({
  init(conn, serializer, r) {
    this._conn = conn;
    this._serializer = serializer;
    this._r = r;
  },

  fetchRelationship(model, recordId, relationship) {
    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`relationships/${relationship}`);
    const query = this._r.table(tableName).get(recordId);

    return query.run(this._conn).then(result => result[fieldName]);
  },

  replaceHasOne(model, recordId, relationship, relatedRecordId) {
    const inverseTableName = this._serializer.tableName(model);
    const inverseFieldName = this._serializer.fieldName(`relationships/${relationship}`);

    return this._r.table(inverseTableName).get(recordId).update({[inverseFieldName]: relatedRecordId}).run(this._conn);
  },

  addToHasMany(model, recordId, relationship, relatedRecordId) {
    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`relationships/${relationship}`);

    return this._r.table(tableName).get(recordId).update({[fieldName]: {[relatedRecordId]: true}}).run(this._conn);
  },

  removeFromHasMany(model, recordId, relationship, relatedRecordId) {
    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`relationships/${relationship}`);

    const without = {[fieldName]: {[relatedRecordId]: true}};
    return this._r.table(tableName).get(recordId).replace(this._r.row.without(without)).run(this._conn);
  },

  clearHasOnesMatching(model, relationship, relatedRecordId) {
    const r = this._r;
    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`relationships/${relationship}`);

    return r.table(tableName).filter({[fieldName]: relatedRecordId}).update({[fieldName]: null}).run(this._conn);
  },

  removeFromHasManysMatching(model, relationship, relatedRecordId) {
    const r = this._r;
    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`relationships/${relationship}`);

    const without = {[fieldName]: {[relatedRecordId]: true}};
    return r.table(tableName).filter({[fieldName]: { [relatedRecordId]: true }}).replace(this._r.row.without(without)).run(this._conn);
  },

  replaceHasMany(model, recordId, relationship, relatedRecordIds) {
    const r = this._r;
    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`relationships/${relationship}`);
    const value = this._buildHash(relatedRecordIds, true);

    return r.table(tableName).get(recordId).update({ [fieldName]: r.literal(value) }).run(this._conn);
  },

  replaceHasOnes(model, recordIds, relationship, relatedRecordId) {
    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`relationships/${relationship}`);
    return this._r.table(tableName).getAll(this._r.args(recordIds)).update({[fieldName]: relatedRecordId}).run(this._conn);
  },

  addToHasManys(model, recordIds, relationship, relatedRecordId) {
    const r = this._r;
    const tableName = this._serializer.tableName(model);
    const fieldName = this._serializer.fieldName(`relationships/${relationship}`);

    return r.table(tableName)
      .getAll(r.args(recordIds))
      .update({[fieldName]: {[relatedRecordId]: true}})
      .run(this._conn);
  },

  _buildHash(keys, value) {
    return keys.reduce((hash, key) => {
      hash[key] = value;
      return hash;
    }, {});
  },
});
