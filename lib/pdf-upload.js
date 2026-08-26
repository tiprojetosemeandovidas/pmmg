'use strict';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function safePdfName(value) {
  const baseName = String(value || '').split(/[\\/]/).pop() || '';
  const normalized = baseName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[.-]+/, '').slice(-120);
  return normalized && normalized.toLowerCase().endsWith('.pdf') ? normalized : 'edital.pdf';
}

function validatePdfMetadata(body) {
  if (!body || body.mimeType !== 'application/pdf' || typeof body.fileName !== 'string' || !body.fileName.toLowerCase().endsWith('.pdf') || !Number.isInteger(body.size) || body.size < 1 || body.size > MAX_PDF_BYTES) {
    throw Object.assign(new Error('Envie um arquivo PDF de até 10 MB.'), { status: 400, code: 'invalid_file' });
  }
}

function validatePdfBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_PDF_BYTES) throw Object.assign(new Error('O PDF deve ter no máximo 10 MB.'), { status: 413, code: 'file_too_large' });
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw Object.assign(new Error('A assinatura do arquivo não corresponde a PDF.'), { status: 400, code: 'invalid_pdf_signature' });
  if (!bytes.subarray(Math.max(0, bytes.length - 2048)).includes(Buffer.from('%%EOF'))) throw Object.assign(new Error('O arquivo PDF está incompleto ou corrompido.'), { status: 400, code: 'invalid_pdf_structure' });
}

function validateStoragePath(path, userId) {
  const parts = typeof path === 'string' ? path.split('/') : [];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (parts.length !== 3 || parts[0] !== userId || !uuid.test(parts[1]) || parts[2] !== safePdfName(parts[2])) {
    throw Object.assign(new Error('Referência de upload inválida.'), { status: 400, code: 'invalid_upload_reference' });
  }
}

module.exports = { MAX_PDF_BYTES, safePdfName, validatePdfBytes, validatePdfMetadata, validateStoragePath };
