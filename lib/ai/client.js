'use strict';

const DEFAULT_EDITAL_MODEL = 'gpt-4.1-mini';

function editalModel() {
  const configured = (process.env.OPENAI_EDITAL_MODEL || '').trim();
  return configured && /^[a-zA-Z0-9._-]{1,80}$/.test(configured) ? configured : DEFAULT_EDITAL_MODEL;
}

function apiKey() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) throw Object.assign(new Error('Serviço de extração não configurado.'), { status: 503, code: 'ai_unavailable' });
  return apiKey;
}

async function openai(path, options = {}) {
  const response = await fetch(`https://api.openai.com/v1${path}`, Object.assign({}, options, {
    headers: Object.assign({ Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' }, options.headers)
  }));
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error('Falha no serviço de interpretação.'), { status: 502, code: 'ai_request_failed', providerStatus: response.status, providerType: payload.error && payload.error.type });
  return payload;
}

async function startStructuredResponse({ input, instructions, schema, schemaName, safetyIdentifier }) {
  return openai('/responses', {
    method: 'POST',
    body: JSON.stringify({ model: editalModel(), instructions, input, background: true, store: true, safety_identifier: safetyIdentifier, text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } } })
  });
}

async function retrieveResponse(id) {
  return openai(`/responses/${encodeURIComponent(id)}`, { method: 'GET' });
}

async function deleteResponse(id) {
  try { await openai(`/responses/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* limpeza best effort */ }
}

function parseStructuredResponse(payload) {
  if (payload.status !== 'completed') throw Object.assign(new Error('A extração ainda não foi concluída.'), { status: 409, code: 'ai_response_incomplete' });
  const outputText = payload.output_text || (payload.output || []).flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  if (!outputText) throw Object.assign(new Error('O modelo não retornou uma extração.'), { status: 502, code: 'empty_ai_response' });
  try {
    return { data: JSON.parse(outputText), id: payload.id, model: payload.model || editalModel(), usage: payload.usage || {} };
  } catch {
    throw Object.assign(new Error('O modelo retornou JSON inválido.'), { status: 502, code: 'invalid_ai_json' });
  }
}

module.exports = { DEFAULT_EDITAL_MODEL, deleteResponse, editalModel, parseStructuredResponse, retrieveResponse, startStructuredResponse };
