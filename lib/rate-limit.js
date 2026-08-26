'use strict';

const crypto = require('crypto');
const { rest } = require('./supabase-server');

async function enforceRateLimit(key, limit, windowSeconds) {
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const rows = await rest('rpc/consume_rate_limit', {
    method: 'POST',
    body: JSON.stringify({ p_key_hash: keyHash, p_limit: limit, p_window_seconds: windowSeconds })
  });
  const result = Array.isArray(rows) ? rows[0] : rows;
  if (!result || result.allowed !== true) {
    throw Object.assign(new Error('Muitas solicitações. Aguarde antes de tentar novamente.'), {
      status: 429,
      code: 'rate_limit_exceeded',
      retryAfter: result && result.retry_after_seconds || windowSeconds
    });
  }
  return result;
}

module.exports = { enforceRateLimit };
