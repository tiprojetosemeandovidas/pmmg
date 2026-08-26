'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { enforceRateLimit } = require('../lib/rate-limit');

test('usa RPC atômica e bloqueia acima do limite', async t => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
  let calledUrl;
  t.mock.method(global, 'fetch', async (url) => { calledUrl = url; return new Response(JSON.stringify([{ allowed: false, remaining: 0, retry_after_seconds: 42 }]), { status: 200 }); });
  await assert.rejects(() => enforceRateLimit('user:action', 3, 3600), error => /** @type {any} */ (error).status === 429 && /** @type {any} */ (error).retryAfter === 42);
  assert.match(calledUrl, /\/rest\/v1\/rpc\/consume_rate_limit$/);
  if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
});
