'use strict';

const crypto = require('crypto');
const { allowMethods, error, handleError, json, readJson } = require('../../lib/http');
const { enforceRateLimit } = require('../../lib/rate-limit');
const { authenticate, createSignedUpload } = require('../../lib/supabase-server');
const { safePdfName, validatePdfMetadata } = require('../../lib/pdf-upload');

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  try {
    const user = await authenticate(request);
    await enforceRateLimit(`edital-upload-url:${user.id}`, 8, 60 * 60);
    const body = await readJson(request);
    try { validatePdfMetadata(body); } catch (cause) { return error(response, cause.status, cause.code, cause.message); }
    const path = `${user.id}/${crypto.randomUUID()}/${safePdfName(body.fileName)}`;
    const signed = await createSignedUpload(path);
    return json(response, 200, { data: { path, token: signed.token } });
  } catch (cause) {
    return handleError(response, cause, 'upload_url_failed', 'Não foi possível preparar o upload.');
  }
};
