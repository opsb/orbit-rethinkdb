function prependKeys(hash, prefix) {
  const done = Object.keys(hash).reduce((prefixed, key) => {
    prefixed[`${prefix}${key}`] = hash[key];
    return prefixed;
  }, {});

  return done;
}

export { prependKeys };
