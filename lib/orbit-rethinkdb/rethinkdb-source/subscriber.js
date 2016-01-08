import { Class } from 'orbit/lib/objects';
import Orbit from 'orbit/main';
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

  liveQuery(query) {
    if (!query.reql) { throw new Error('Only reql queries are supported'); }

    const type = query.reql.type;
    const reqlQuery = query.reql.query;
    const operations = new Rx.ReplaySubject();

    return new Orbit.Promise((resolve, reject) => {
      reqlQuery.changes({ squash: false, includeInitial: true, includeStates: true }).run(this._conn).then((cursor) => {
        cursor.each((err, change) => {
          if (change.state) {
            if (change.state === 'ready') {
              resolve(operations);
            }
          } else {
            this._processUpdate(type, change, operations);
          }
        });
      });
    });
  },

  _processUpdate(type, change, operations) {
    if (change['new_val'] && !change['old_val']) return this._processAddRecord(type, change, operations);
    if (change['old_val'] && change['new_val']) return this._processUpdateRecord(type, change, operations);
    if (change['old_val'] && !change['new_val']) return this._processRemoveRecord(type, change, operations);
    throw new Error('update not handled', type, change);
  },

  _processAddRecord(type, change, operations) {
    const record = this._serializer.deserialize(type, change['new_val']);
    operations.onNext(addRecordOperation(record));
  },

  _processUpdateRecord(type, change, operations) {
    const oldRecord = this._serializer.deserialize(type, change['old_val']);
    const newRecord = this._serializer.deserialize(type, change['new_val']);

    const diffOperations = diffs(oldRecord, newRecord, {basePath: `${type}/${oldRecord.id}`});

    diffOperations.forEach(operation => operations.onNext(operation));
  },

  _processRemoveRecord(type, change, operations) {
    const oldRecord = this._serializer.deserialize(type, change['old_val']);
    operations.onNext(removeRecordOperation(oldRecord));
  },
});
