'use strict';

const crypto = require('crypto');
const { allowMethods, error, json, readJson } = require('../../lib/http');
const { enforceRateLimit } = require('../../lib/rate-limit');
const { authenticate, createSignedUpload } = require('../../lib/supabase-server');

function safeName(value) {
  return String(value || 'edital.pdf').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-120);
}

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  try {
    const user = await authenticate(request);
    enforceRateLimit(`edital-upload-url:${user.id}`, 8, 60 * 60 * 1000);
    const body = await readJson(request);
    if (!body || body.mimeType !== 'application/pdf' || !Number.isInteger(body.size) || body.size < 1 || body.size > 10 * 1024 * 1024) return error(response, 400, 'invalid_file', 'Envie um PDF de até 10 MB.');
    const path = `${user.id}/${crypto.randomUUID()}/${safeName(body.fileName)}`;
    const signed = await createSignedUpload(path);
    return json(response, 200, { data: { path, token: signed.token } });
  } catch (cause) {
    return error(response, cause.status || 500, cause.code || 'upload_url_failed', cause.status ? cause.message : 'Não foi possível preparar o upload.');
  }
};
