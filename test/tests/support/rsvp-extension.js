import { Promise } from 'rsvp';

Promise.prototype.tap = function(callback) {
  return this.then(function(result) {
    return Promise.resolve(callback(result)).then(() => result);
  });
};

