'use strict';

const crypto = require('crypto');
const { allowMethods, handleError, json, readJson } = require('../../lib/http');
const { authenticate, downloadPdf, removePdf, rest } = require('../../lib/supabase-server');
const { enforceRateLimit } = require('../../lib/rate-limit');
const { safePdfName, validatePdfBytes, validatePdfMetadata, validateStoragePath } = require('../../lib/pdf-upload');

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  let storagePath;
  try {
    const user = await authenticate(request);
    await enforceRateLimit(`edital-upload:${user.id}`, 5, 60 * 60);
    const body = await readJson(request);
    validatePdfMetadata(body);
    validateStoragePath(body.storagePath, user.id);
    storagePath = body.storagePath;
    const bytes = await downloadPdf(storagePath);
    validatePdfBytes(bytes);
    if (bytes.length !== body.size) throw Object.assign(new Error('O tamanho armazenado não corresponde ao upload informado.'), { status: 400, code: 'file_size_mismatch' });
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const duplicate = await rest(`notices?user_id=eq.${encodeURIComponent(user.id)}&content_sha256=eq.${hash}&select=id,file_name,status&limit=1`);
    if (duplicate.length) {
      await removePdf(storagePath).catch(() => {});
      storagePath = null;
      return json(response, 200, { data: duplicate[0], duplicate: true });
    }
    const id = crypto.randomUUID();
    const fileName = safePdfName(body.fileName);
    const rows = await rest('notices?select=id,file_name,status,created_at', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ id, user_id: user.id, file_name: fileName, mime_type: 'application/pdf', file_size_bytes: bytes.length, content_sha256: hash, storage_path: storagePath })
    });
    return json(response, 201, { data: rows[0] });
  } catch (cause) {
    if (storagePath) await removePdf(storagePath).catch(() => {});
    return handleError(response, cause, 'upload_failed', 'Não foi possível enviar o edital.');
  }
};
