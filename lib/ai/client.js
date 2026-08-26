'use strict';

async function createStructuredResponse({ input, instructions, schema, schemaName, safetyIdentifier }) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) throw Object.assign(new Error('Serviço de extração não configurado.'), { status: 503, code: 'ai_unavailable' });
  const model = process.env.OPENAI_EDITAL_MODEL || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, instructions, input, store: false, safety_identifier: safetyIdentifier, text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } } })
  });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error('Falha ao interpretar o edital.'), { status: 502, code: 'ai_request_failed', details: { status: response.status, type: payload.error && payload.error.type } });
  const outputText = payload.output_text || (payload.output || []).flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  if (!outputText) throw Object.assign(new Error('O modelo não retornou uma extração.'), { status: 502, code: 'empty_ai_response' });
  return { data: JSON.parse(outputText), id: payload.id, model: payload.model || model, usage: payload.usage || {} };
}

module.exports = { createStructuredResponse };

