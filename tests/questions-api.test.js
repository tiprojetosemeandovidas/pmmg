'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('API autenticada retorna alternativas sem gabarito', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => {
    if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 });
    if (url.includes('/questions?')) return new Response(JSON.stringify([{ id: '11111111-1111-4111-8111-111111111111', exam_id: '22222222-2222-4222-8222-222222222222', subject: 'Direito', topic: 'Constitucional', statement: 'Texto', difficulty: 'medium', source_type: 'official_exam' }]), { status: 200 });
    if (url.includes('/question_options?')) return new Response(JSON.stringify([{ question_id: '11111111-1111-4111-8111-111111111111', option_index: 0, label: 'A', content: 'Alternativa' }]), { status: 200 });
    if (url.includes('/question_topics?')) return new Response('[]', { status: 200 });
    if (url.includes('/question_sources?')) return new Response('[]', { status: 200 });
    throw new Error(`URL inesperada: ${url}`);
  };
  try {
    const handler = require('../api/questions/index');
    const res = response();
    await handler({ method: 'GET', headers: { authorization: 'Bearer token' }, query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data[0].options[0].content, 'Alternativa');
    assert.equal(JSON.stringify(res.body).includes('correct'), false);
  } finally { global.fetch = originalFetch; }
});
