'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_PDF_BYTES, safePdfName, validatePdfBytes, validatePdfMetadata, validateStoragePath } = require('../lib/pdf-upload');

test('aceita PDF com assinatura e EOF', () => assert.doesNotThrow(() => validatePdfBytes(Buffer.from('%PDF-1.7\nconteudo\n%%EOF'))));
test('rejeita conteúdo que não é PDF', () => assert.throws(() => validatePdfBytes(Buffer.from('arquivo de texto')), { code: 'invalid_pdf_signature' }));
test('rejeita PDF incompleto', () => assert.throws(() => validatePdfBytes(Buffer.from('%PDF-1.7\nsem final')), { code: 'invalid_pdf_structure' }));
test('rejeita tamanho acima de 10 MB antes do upload', () => assert.throws(() => validatePdfMetadata({ fileName: 'edital.pdf', mimeType: 'application/pdf', size: MAX_PDF_BYTES + 1 }), { code: 'invalid_file' }));
test('rejeita extensão diferente mesmo com MIME PDF', () => assert.throws(() => validatePdfMetadata({ fileName: 'edital.exe', mimeType: 'application/pdf', size: 100 }), { code: 'invalid_file' }));
test('sanitiza nome e impede travessia de diretório', () => assert.equal(safePdfName('../../Edital PMMG.pdf'), 'Edital-PMMG.pdf'));
test('aceita somente caminho assinado pertencente ao usuário', () => {
  const user = '123e4567-e89b-42d3-a456-426614174000';
  assert.doesNotThrow(() => validateStoragePath(`${user}/123e4567-e89b-42d3-a456-426614174001/edital.pdf`, user));
  assert.throws(() => validateStoragePath(`outro/123e4567-e89b-42d3-a456-426614174001/edital.pdf`, user), { code: 'invalid_upload_reference' });
});
