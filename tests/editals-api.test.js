'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const uploadUrlHandler = require('../api/editals/upload-url');
const listHandler = require('../api/editals');
const extractHandler = require('../api/editals/[id]/extract');
const detailHandler = require('../api/editals/[id]');
const adminListHandler = require('../api/admin/editals');

const USER_ID = '123e4567-e89b-42d3-a456-426614174000';
const NOTICE_ID = '123e4567-e89b-42d3-a456-426614174001';

function responseMock() {
  return { statusCode: null, headers: {}, body: null, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function env() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
}

function authOrRpcFetch(url) {
  if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: USER_ID }), { status: 200 });
  if (url.includes('/rpc/consume_rate_limit')) return new Response(JSON.stringify([{ allowed: true, remaining: 2, retry_after_seconds: 0 }]), { status: 200 });
  throw new Error(`URL inesperada: ${url}`);
}

test('endpoint de upload exige autenticação', async () => {
  env();
  const response = responseMock();
  await uploadUrlHandler({ method: 'POST', headers: {}, body: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, 'authentication_required');
});

test('endpoint rejeita extensão falsa mesmo com MIME PDF', async t => {
  env();
  t.mock.method(global, 'fetch', async url => authOrRpcFetch(url));
  const response = responseMock();
  await uploadUrlHandler({ method: 'POST', headers: { authorization: 'Bearer user-token' }, body: { fileName: 'virus.exe', mimeType: 'application/pdf', size: 100 } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, 'invalid_file');
});

test('endpoint rejeita PDF acima de 10 MB', async t => {
  env();
  t.mock.method(global, 'fetch', async url => authOrRpcFetch(url));
  const response = responseMock();
  await uploadUrlHandler({ method: 'POST', headers: { authorization: 'Bearer user-token' }, body: { fileName: 'grande.pdf', mimeType: 'application/pdf', size: 10 * 1024 * 1024 + 1 } }, response);
  assert.equal(response.statusCode, 400);
});

test('reutiliza extração existente sem nova chamada de IA', async t => {
  env();
  let calls = 0;
  t.mock.method(global, 'fetch', async url => {
    calls += 1;
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: USER_ID }), { status: 200 });
    if (url.includes('/rest/v1/notices?')) return new Response(JSON.stringify([{ id: NOTICE_ID, status: 'needs_review', review_status: 'pending', extracted_data: { orgao: 'PMMG' } }]), { status: 200 });
    throw new Error(`URL inesperada: ${url}`);
  });
  const response = responseMock();
  await extractHandler({ method: 'POST', query: { id: NOTICE_ID }, headers: { authorization: 'Bearer user-token' }, body: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.reused, true);
  assert.equal(calls, 2);
});

test('erro interno do Supabase não vaza detalhes ao cliente', async t => {
  env();
  t.mock.method(global, 'fetch', async url => {
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: USER_ID }), { status: 200 });
    return new Response(JSON.stringify({ message: 'detalhe interno da tabela' }), { status: 500 });
  });
  const response = responseMock();
  await listHandler({ method: 'GET', headers: { authorization: 'Bearer user-token' } }, response);
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error.message, 'Não foi possível listar os editais.');
});

test('usuário não consulta edital privado de outro usuário', async t => {
  env();
  t.mock.method(global, 'fetch', async url => {
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: USER_ID }), { status: 200 });
    assert.match(url, new RegExp(`user_id=eq\\.${USER_ID}`));
    return new Response('[]', { status: 200 });
  });
  const response = responseMock();
  await detailHandler({ method: 'GET', query: { id: NOTICE_ID }, headers: { authorization: 'Bearer user-token' } }, response);
  assert.equal(response.statusCode, 404);
});

test('usuário comum não acessa fila administrativa', async t => {
  env();
  t.mock.method(global, 'fetch', async url => {
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: USER_ID }), { status: 200 });
    if (url.includes('/rest/v1/user_roles?')) return new Response('[]', { status: 200 });
    throw new Error(`URL inesperada: ${url}`);
  });
  const response = responseMock();
  await adminListHandler({ method: 'GET', headers: { authorization: 'Bearer user-token' } }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, 'forbidden');
});

test('rate limit retorna 429 e Retry-After', async t => {
  env();
  t.mock.method(global, 'fetch', async url => {
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: USER_ID }), { status: 200 });
    if (url.includes('/rpc/consume_rate_limit')) return new Response(JSON.stringify([{ allowed: false, remaining: 0, retry_after_seconds: 60 }]), { status: 200 });
    throw new Error(`URL inesperada: ${url}`);
  });
  const response = responseMock();
  await uploadUrlHandler({ method: 'POST', headers: { authorization: 'Bearer user-token' }, body: { fileName: 'edital.pdf', mimeType: 'application/pdf', size: 100 } }, response);
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['Retry-After'], '60');
});
