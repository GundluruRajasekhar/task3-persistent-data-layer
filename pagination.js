'use strict';

const env = require('../config/env');

function paginate(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const requested = parseInt(query.limit, 10) || 20;
  const limit = Math.min(Math.max(requested, 1), env.MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

function meta(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

module.exports = { paginate, meta };
