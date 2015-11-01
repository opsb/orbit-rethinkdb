import Orbit from 'orbit/main';

Orbit.Promise = Promise;
Orbit.pluralize = function(original) {
  return original.match(/s$/) ? original : original + 's';
};

Orbit.singularize = function(original) {
  const match = original.match(/(.*)s$/);
  return match ? match[1] : original;
};

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
