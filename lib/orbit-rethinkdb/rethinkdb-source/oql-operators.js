var recordsOfType = {
  evaluate(context, args) {
    const r = context.evaluator.target._r;
    const serializer = context.evaluator.target._serializer;
    const type = args[0];
    const tableName = serializer.tableName(type);

    return r.table(tableName);
  },
};

export default {
  recordsOfType,
};
