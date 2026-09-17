'use strict';

// Errors thrown deliberately by the app, carrying the status code the client
// should see. Anything else that reaches the error handler is treated as a 500.
class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg); }
  static conflict(msg, details) { return new ApiError(409, msg, details); }
  static unprocessable(msg, details) { return new ApiError(422, msg, details); }
}

module.exports = ApiError;
