'use strict';

// Wraps async route handlers so a rejected promise reaches the central error
// handler instead of hanging the request.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
