import { Class } from 'orbit/lib/objects';
import Evented from 'orbit/evented';
import {
  addRecordOperation,
  removeRecordOperation
} from 'orbit-common/lib/operations';
import { diffs } from 'orbit/lib/diffs';
import Transform from 'orbit/transform';

export default Class.extend({
  init(conn, serializer) {
    this._serializer = serializer;
    this._conn = conn;

    Evented.extend(this);
  },

  subscribe(type, query) {
    return new Promise((resolve, reject) => {
      return query.changes({includeStates: true, squash: false}).run(this._conn).then((cursor) => {
        cursor.each((err, change) => {
          if(change.state === 'ready') return resolve();

          if(!change.state) {
            this._processUpdate(type, change);
          }
        });
      });
    });

  },

  _processUpdate(type, change) {
    if(change['new_val'] && !change['old_val']) return this._processAddRecord(type, change);
    if(change['old_val'] && change['new_val']) return this._processUpdateRecord(type, change);
    if(change['old_val'] && !change['new_val']) return this._processRemoveRecord(type, change);
    throw new Error('update not handled', type, change);
  },

  _processAddRecord(type, change) {
    const record = this._serializer.deserialize(type, change['new_val']);
    const operations = [addRecordOperation(record)];

    this.emit('didTransform', new Transform(operations));
  },

  _processUpdateRecord(type, change) {
    const oldRecord = this._serializer.deserialize(type, change['old_val']);
    const newRecord = this._serializer.deserialize(type, change['new_val']);

    const operations = diffs(oldRecord, newRecord, {basePath: `${type}/${oldRecord.id}`});

    this.emit('didTransform', new Transform(operations));
  },

  _processRemoveRecord(type, change) {
    const oldRecord = this._serializer.deserialize(type, change['old_val']);
    const operations = [removeRecordOperation(oldRecord)];

    this.emit('didTransform', new Transform(operations));
  }
});
