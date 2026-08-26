'use strict';

const MAX_JSON_BYTES = 64 * 1024;

function json(response, status, body) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  return response.status(status).json(body);
}

function error(response, status, code, message, details) {
  if (status === 429 && details && details.retryAfter) response.setHeader('Retry-After', String(details.retryAfter));
  const body = { error: { code, message } };
  if (details) body.error.details = details;
  return json(response, status, body);
}

function handleError(response, cause, fallbackCode, fallbackMessage) {
  const status = Number.isInteger(cause.status) ? cause.status : 500;
  const details = status === 429 ? { retryAfter: cause.retryAfter } : undefined;
  return error(response, status, cause.code || fallbackCode, status < 500 ? cause.message : fallbackMessage, details);
}

function allowMethods(request, response, methods) {
  if (methods.includes(request.method)) return true;
  response.setHeader('Allow', methods.join(', '));
  error(response, 405, 'method_not_allowed', 'Método não permitido.');
  return false;
}

async function readJson(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw Object.assign(new Error('Payload excede o limite.'), { status: 413, code: 'payload_too_large' });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON inválido.'), { status: 400, code: 'invalid_json' });
  }
}

function routeId(request) {
  const value = request.query && request.query.id;
  return Array.isArray(value) ? value[0] : value;
}

module.exports = { allowMethods, error, handleError, json, readJson, routeId };
