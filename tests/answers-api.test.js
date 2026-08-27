'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('registra resposta autenticada e retorna resultado da tentativa', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 });
    if (url.endsWith('/rest/v1/rpc/record_question_answer')) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_selected_option, 1);
      return new Response(JSON.stringify([{ answer_id: '33333333-3333-4333-8333-333333333333', correct: true, correct_option: 1, explanation: 'Fundamento', already_recorded: false }]), { status: 200 });
    }
    throw new Error(`URL inesperada: ${url}`);
  };
  try {
    const handler = require('../api/candidate');
    const res = response();
    await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, query: { action: 'answer' }, body: {
      questionId: '11111111-1111-4111-8111-111111111111', selectedOption: 1,
      idempotencyKey: '22222222-2222-4222-8222-222222222222', responseTimeMs: 9000
    } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.correct, true);
    assert.equal(res.body.data.correctOption, 1);
  } finally { global.fetch = originalFetch; }
});

test('rejeita resposta sem autenticação', async () => {
  const handler = require('../api/candidate');
  const res = response();
  await handler({ method: 'POST', headers: {}, query: { action: 'answer' }, body: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('não expõe gabarito quando a chave idempotente conflita', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => {
    if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 });
    if (url.endsWith('/rest/v1/rpc/record_question_answer')) {
      return new Response(JSON.stringify({ message: 'idempotency_conflict' }), { status: 400 });
    }
    throw new Error(`URL inesperada: ${url}`);
  };
  try {
    const handler = require('../api/candidate');
    const res = response();
    await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, query: { action: 'answer' }, body: {
      questionId: '11111111-1111-4111-8111-111111111111', selectedOption: 1,
      idempotencyKey: '22222222-2222-4222-8222-222222222222'
    } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, 'idempotency_conflict');
    assert.equal(JSON.stringify(res.body).includes('correctOption'), false);
  } finally { global.fetch = originalFetch; }
});
