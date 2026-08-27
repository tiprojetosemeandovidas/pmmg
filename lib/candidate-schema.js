'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateAnswer(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['Resposta inválida.'] };
  if (!UUID.test(input.questionId || '')) errors.push('questionId deve ser um UUID válido.');
  if (!UUID.test(input.idempotencyKey || '')) errors.push('idempotencyKey deve ser um UUID válido.');
  if (input.diagnosticSessionId != null && !UUID.test(input.diagnosticSessionId)) errors.push('diagnosticSessionId deve ser um UUID válido.');
  if (!Number.isInteger(input.selectedOption) || input.selectedOption < 0 || input.selectedOption > 25) errors.push('selectedOption deve estar entre 0 e 25.');
  if (input.responseTimeMs != null && (!Number.isInteger(input.responseTimeMs) || input.responseTimeMs < 0 || input.responseTimeMs > 3600000)) errors.push('responseTimeMs inválido.');
  return errors.length ? { valid: false, errors } : { valid: true, data: {
    questionId: input.questionId,
    selectedOption: input.selectedOption,
    idempotencyKey: input.idempotencyKey,
    responseTimeMs: input.responseTimeMs == null ? null : input.responseTimeMs,
    diagnosticSessionId: input.diagnosticSessionId || null
  } };
}

module.exports = { UUID, validateAnswer };
