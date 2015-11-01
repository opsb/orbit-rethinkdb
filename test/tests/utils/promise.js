import Orbit from 'orbit/main';

function mapSeries(array, callback) {
  return array.reduce((chain, item, index) => {
    return chain.then(resolved => {
      return callback(item, index, array).then(result => [...resolved, result]);
    });
  }, Orbit.Promise.resolve([]));
}

export { mapSeries };
