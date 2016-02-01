export default {
  recordsOfType: {
    evaluate(context, args) {
      const r = context.evaluator.target._r;
      const serializer = context.evaluator.target._serializer;
      const type = args[0];
      const tableName = serializer.tableName(type);

      return r.table(tableName);
    },
  },

  filter: {
    evaluate(context, args) {
      const recordsExpression = context.evaluate(args[0]);
      const predicateFunction = context.evaluate(args[1]);

      return recordsExpression.filter(predicateFunction);
    },
  },

  equal: {
    evaluate(context, args) {
      const a = context.evaluate(args[0]);
      const b = context.evaluate(args[1]);

      return a.eq(b);
    },
  },

  and: {
    evaluate(context, args) {
      const r = context.evaluator.target._r;

      return args.reduce((chain, arg) => {
        return chain.and(context.evaluate(arg));
      }, r.expr(true));
    },
  },

  or: {
    evaluate(context, args) {
      const r = context.evaluator.target._r;

      return args.reduce((chain, arg) => {
        return chain.or(context.evaluate(arg));
      }, r.expr(true));
    },
  },

  get: {
    evaluate(context, args) {
      const r = context.evaluator.target._r;
      const serializer = context.evaluator.target._serializer;
      const field = serializer.fieldName(args[0]);

      return r.row(field);
    },
  },

  record: {
    evaluate(context, args) {
      const r = context.evaluator.target._r;
      const serializer = context.evaluator.target._serializer;
      const [model, recordId] = args;
      const tableName = serializer.tableName(model);

      return r.table(tableName).get(recordId);
    },
  },

  relatedRecord: {
    evaluate(context, args) {
      const r = context.evaluator.target._r;
      const schema = context.evaluator.target._schema;
      const serializer = context.evaluator.target._serializer;

      const [model, recordId, relationshipName] = args;
      const relationship = schema.modelDefinition(model).relationships[relationshipName];
      const inverseTableName = serializer.tableName(relationship.model);
      const inverseFieldName = serializer.fieldName(`relationships/${relationship.inverse}`);

      return r.table(inverseTableName).filter({[inverseFieldName]: {[recordId]: true}});
    },
  },

  relatedRecords: {
    evaluate(context, args) {
      const r = context.evaluator.target._r;
      const schema = context.evaluator.target._schema;
      const serializer = context.evaluator.target._serializer;
      const [model, recordId, relationshipName] = args;
      const relationship = schema.modelDefinition(model).relationships[relationshipName];

      const inverseTableName = serializer.tableName(relationship.model);
      const inverseRelationship = serializer.fieldName(`relationships/${relationship.inverse}`);

      return r.table(inverseTableName).filter({[inverseRelationship]: recordId});
    },
  },
};
