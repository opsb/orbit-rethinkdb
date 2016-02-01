import Orbit from 'orbit/main';
import './support/rsvp-extension';
import { Promise as RSVPPromise } from 'rsvp';

QUnit.config.testTimeout = 10000;

Orbit.Promise = RSVPPromise;
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
