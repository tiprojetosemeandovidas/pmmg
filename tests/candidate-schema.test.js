'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAnswer } = require('../lib/candidate-schema');

const answer = {
  questionId: '11111111-1111-4111-8111-111111111111',
  selectedOption: 2,
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  responseTimeMs: 12000
};

test('valida uma resposta candidata', () => {
  const result = validateAnswer(answer);
  assert.equal(result.valid, true);
  assert.equal(result.data.selectedOption, 2);
  assert.equal(result.data.diagnosticSessionId, null);
});

test('rejeita alternativa, UUID e tempo inválidos', () => {
  const result = validateAnswer({ ...answer, questionId: 'x', selectedOption: 40, responseTimeMs: -1 });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3);
});
