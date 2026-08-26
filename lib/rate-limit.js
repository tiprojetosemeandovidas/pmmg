'use strict';

const windows = new Map();

function enforceRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw Object.assign(new Error('Muitas solicitações. Aguarde antes de tentar novamente.'), { status: 429, code: 'rate_limit_exceeded' });
  current.count += 1;
  if (windows.size > 10000) for (const [itemKey, value] of windows) if (value.resetAt <= now) windows.delete(itemKey);
}

module.exports = { enforceRateLimit };
