'use strict';

const crypto = require('crypto');
const { allowMethods, error, json, readJson } = require('../../lib/http');
const { authenticate, downloadPdf, removePdf, rest } = require('../../lib/supabase-server');
const { enforceRateLimit } = require('../../lib/rate-limit');

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function safeName(value) {
  return String(value || 'edital.pdf').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-120);
}

function validatePdf(bytes) {
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw Object.assign(new Error('O PDF deve ter no máximo 10 MB.'), { status: 413, code: 'file_too_large' });
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw Object.assign(new Error('A assinatura do arquivo não corresponde a PDF.'), { status: 400, code: 'invalid_pdf_signature' });
}

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  let storagePath;
  try {
    const user = await authenticate(request);
    enforceRateLimit(`edital-upload:${user.id}`, 5, 60 * 60 * 1000);
    const body = await readJson(request);
    if (!body || typeof body.storagePath !== 'string' || !body.storagePath.startsWith(`${user.id}/`) || body.mimeType !== 'application/pdf') throw Object.assign(new Error('Referência de upload inválida.'), { status: 400, code: 'invalid_upload_reference' });
    storagePath = body.storagePath;
    const bytes = await downloadPdf(storagePath);
    validatePdf(bytes);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const duplicate = await rest(`notices?user_id=eq.${encodeURIComponent(user.id)}&content_sha256=eq.${hash}&select=id,file_name,status&limit=1`);
    if (duplicate.length) {
      await removePdf(storagePath).catch(() => {});
      storagePath = null;
      return json(response, 200, { data: duplicate[0], duplicate: true });
    }
    const id = crypto.randomUUID();
    const fileName = safeName(body.fileName);
    const rows = await rest('notices?select=id,file_name,status,created_at', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ id, user_id: user.id, file_name: fileName, mime_type: 'application/pdf', file_size_bytes: bytes.length, content_sha256: hash, storage_path: storagePath })
    });
    return json(response, 201, { data: rows[0] });
  } catch (cause) {
    if (storagePath) await removePdf(storagePath).catch(() => {});
    return error(response, cause.status || 500, cause.code || 'upload_failed', cause.status ? cause.message : 'Não foi possível enviar o edital.');
  }
};
