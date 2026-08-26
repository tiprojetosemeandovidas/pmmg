'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_EDITAL_MODEL, editalModel, parseStructuredResponse, startStructuredResponse } = require('../lib/ai/client');

test('usa fallback central quando OPENAI_EDITAL_MODEL está ausente', () => {
  const previous = process.env.OPENAI_EDITAL_MODEL;
  delete process.env.OPENAI_EDITAL_MODEL;
  assert.equal(editalModel(), DEFAULT_EDITAL_MODEL);
  if (previous !== undefined) process.env.OPENAI_EDITAL_MODEL = previous;
});

test('ignora identificador de modelo inválido', () => {
  const previous = process.env.OPENAI_EDITAL_MODEL;
  process.env.OPENAI_EDITAL_MODEL = 'modelo inválido com espaços';
  assert.equal(editalModel(), DEFAULT_EDITAL_MODEL);
  if (previous === undefined) delete process.env.OPENAI_EDITAL_MODEL; else process.env.OPENAI_EDITAL_MODEL = previous;
});

test('inicia Responses API em background com Structured Output', async t => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  /** @type {any} */
  let requestBody;
  t.mock.method(global, 'fetch', async (_url, options) => { requestBody = JSON.parse(options.body); return new Response(JSON.stringify({ id: 'resp_test', status: 'queued', model: 'test-model' }), { status: 200 }); });
  const result = await startStructuredResponse({ input: [], instructions: 'teste', schema: { type: 'object' }, schemaName: 'teste', safetyIdentifier: 'hash' });
  assert.equal(result.status, 'queued');
  assert.equal(requestBody.background, true);
  assert.equal(requestBody.text.format.type, 'json_schema');
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
});

test('trata erro da OpenAI sem expor mensagem do provedor', async t => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  t.mock.method(global, 'fetch', async () => new Response(JSON.stringify({ error: { type: 'server_error', message: 'detalhe sensível' } }), { status: 500 }));
  await assert.rejects(() => startStructuredResponse({ input: [], instructions: '', schema: {}, schemaName: 'teste', safetyIdentifier: 'hash' }), error => /** @type {any} */ (error).code === 'ai_request_failed' && !/** @type {any} */ (error).message.includes('detalhe sensível'));
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
});

test('rejeita JSON inválido do modelo', () => {
  assert.throws(() => parseStructuredResponse({ status: 'completed', output_text: '{invalido', model: 'teste' }), { code: 'invalid_ai_json' });
});
