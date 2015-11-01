var transformations = {
  date: {
    serialize: function(value) {
      return value && value.getTime();
    },

    deserialize: function(serialized) {
      return serialized && new Date(serialized);
    },
  },

  defaultTransformation: {
    serialize: function(value) {
      return value;
    },

    deserialize: function(serialized) {
      return serialized;
    },
  },
};

function lookupTransformation(attrType) {
  return transformations[attrType] || transformations.defaultTransformation;
}

export { lookupTransformation };
