import source from 'orbit-common/source';
import TransformResult from 'orbit/transform-result';
import { expose } from 'orbit/lib/objects';

import Serializer from './rethinkdb-source/serializer';
import Subscriber from './rethinkdb-source/subscriber';

export default source.extend({
  init(options) {
    this._super(options);

    const serializer = new Serializer(options.schema);
    this._setupSubscriber(options.conn, serializer);
  },

  _setupSubscriber(conn, serializer) {
    const subscriber = new Subscriber(conn, serializer);

    subscriber.on('didTransform', (transform) => {
      const transformResult = new TransformResult(transform.operations, []);
      this.transformed(transformResult);
    });

    expose(this, subscriber, 'subscribe');
  },
});
