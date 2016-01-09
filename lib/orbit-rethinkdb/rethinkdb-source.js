import source from 'orbit-common/source';
import { expose } from 'orbit/lib/objects';

import Serializer from './rethinkdb-source/serializer';
import Subscriber from './rethinkdb-source/subscriber';
import Transformer from './rethinkdb-source/transformer';

export default source.extend({
  init(options) {
    this._super(options);
    this._serializer = new Serializer(options.schema);

    this._subscriber = new Subscriber(options.conn, this._serializer, options.r, options.schema);
    expose(this, this._subscriber, 'subscribe', 'liveQuery');

    this._transformer = new Transformer(options.conn, this._serializer, options.schema, options.r);
  },

  transform(transformation) {
    return this._transformer.transform(transformation);
  },

  _query(query) {
    return this._subscriber.query(query);
  },
});
