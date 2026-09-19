'use strict';

const ApiError = require('../utils/ApiError');

// Layer 1 of validation: shape/type checking at the edge with Zod.
// Layer 2 is the database itself (NOT NULL, UNIQUE, enums, FKs, CHECKs).
// The API layer gives friendly messages; the DB layer is the guarantee.
const validate = (schemas) => (req, res, next) => {
  for (const key of ['body', 'query', 'params']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || key,
        message: i.message,
      }));
      return next(ApiError.unprocessable('Validation failed', details));
    }
    // Zod strips unknown keys and coerces types - use the parsed value so
    // controllers never see raw client input.
    if (key === 'query') {
      req.validatedQuery = result.data;
    } else {
      req[key] = result.data;
    }
  }
  return next();
};

module.exports = validate;
