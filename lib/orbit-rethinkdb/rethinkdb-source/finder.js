import { Class } from 'orbit/lib/objects';
import Orbit from 'orbit/main';

export default Class.extend({

  init(conn, serializer, r) {
    this._conn = conn;
    this._serializer = serializer;
    this._r = r;
  },

  findByType(type) {
    const tableName = this._serializer.tableName(type);

    return this.find(type, r => r.table(tableName));
  },

  find(type, queryBuilder) {
    const conn = this._conn;
    const serializer = this._serializer;

    return queryBuilder(this._r)
      .run(conn)
      .then(iterator => iterator.toArray())
      .then((array) => array.map(item => serializer.deserialize(type, item)));
  }
});
