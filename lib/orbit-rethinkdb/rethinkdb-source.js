import source from 'orbit-common/source';
import { expose } from 'orbit/lib/objects';

import Serializer from './rethinkdb-source/serializer';
import Subscriber from './rethinkdb-source/subscriber';

export default source.extend({
  init(options) {
    this._super(options);
    console.log('source opts', options);

    const serializer = new Serializer(options.schema);
    const subscriber = new Subscriber(options.conn, serializer, options.r);
    expose(this, subscriber, 'subscribe', 'liveQuery');
  },
});
