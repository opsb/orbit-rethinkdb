import source from 'orbit-common/source';
import { expose } from 'orbit/lib/objects';

import Serializer from './rethinkdb-source/serializer';
import Subscriber from './rethinkdb-source/subscriber';
import Transformer from './rethinkdb-source/transformer';

export default source.extend({
  init(options) {
    this._super(options);
    console.log('source opts', options);

    const serializer = new Serializer(options.schema);

    const subscriber = new Subscriber(options.conn, serializer, options.r);
    expose(this, subscriber, 'subscribe', 'liveQuery');

    this._transformer = new Transformer(options.conn, serializer, options.schema, options.r);
  },

  transform(transformation) {
    return this._transformer.transform(transformation);
  },
});
