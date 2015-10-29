import Orbit from 'orbit/main';

Orbit.Promise = Promise;

import { on } from 'rsvp';

on('error', function(reason) {
  console.error('rsvp error', reason);
});

import {
  serializeOps,
  serializeOp,
  op,
  equalOps
} from './support/operations';

export {
  serializeOps,
  serializeOp,
  op,
  equalOps
};
