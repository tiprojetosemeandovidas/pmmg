'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateQuestion } = require('../lib/question-schema');

const valid = {
  examId: '11111111-1111-4111-8111-111111111111',
  subject: 'Direito Constitucional', topic: 'Direitos fundamentais', statement: 'Enunciado?',
  options: ['Uma', 'Duas'], correctOption: 0, difficulty: 'medium', sourceType: 'official_exam',
  sourceName: 'Prova oficial', sourceUrl: 'https://example.gov.br/prova.pdf',
  topicIds: ['22222222-2222-4222-8222-222222222222']
};

test('valida questão oficial normalizada', () => {
  const result = validateQuestion(valid);
  assert.equal(result.valid, true);
  assert.equal(result.data.options.length, 2);
});

test('rejeita questão oficial sem fonte e gabarito fora das alternativas', () => {
  const result = validateQuestion({ ...valid, sourceUrl: undefined, correctOption: 4 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(item => item.includes('sourceUrl')));
  assert.ok(result.errors.some(item => item.includes('correctOption')));
});

test('preserva identificação explícita de questão gerada por IA', () => {
  const result = validateQuestion({ ...valid, sourceType: 'ai_generated', sourceUrl: undefined });
  assert.equal(result.valid, true);
  assert.equal(result.data.sourceType, 'ai_generated');
});
