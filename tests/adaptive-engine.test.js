'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRecommendations } = require('../lib/domain/adaptive-engine');

const topic = overrides => ({ topicId: crypto.randomUUID(), topicCode: 'DIREITO.TESTE', topic: 'Tópico',
  subject: 'Direito', masteryScore: 50, confidence: 0.5, questionsAnswered: 10,
  correctAnswers: 5, wrongAnswers: 5, examRelevance: 0.5, ...overrides });

test('prioriza maior lacuna e explica os fatores usados', () => {
  const result = buildRecommendations([
    topic({ topic: 'Domínio baixo', masteryScore: 30, confidence: 0.5, wrongAnswers: 7 }),
    topic({ topic: 'Domínio alto', masteryScore: 85, confidence: 0.8, wrongAnswers: 1 })
  ]);
  assert.equal(result[0].topic, 'Domínio baixo');
  assert.equal(result[0].rank, 1);
  assert.equal(result[0].action, 'learn');
  assert.match(result[0].reason, /domínio de 30%/);
  assert.ok(result[0].factors.masteryGap > result[1].factors.masteryGap);
});

test('é determinístico, limitado e mantém scores entre zero e cem', () => {
  const input = Array.from({ length: 25 }, (_, index) => topic({ topic: `Tópico ${index}`, masteryScore: index * 5 - 10 }));
  assert.deepEqual(buildRecommendations(input, { limit: 3 }), buildRecommendations(input, { limit: 3 }));
  assert.equal(buildRecommendations(input, { limit: 3 }).length, 3);
  assert.ok(buildRecommendations(input).every(item => item.priorityScore >= 0 && item.priorityScore <= 100));
});

test('recomenda revisão quando há domínio e evidência suficientes', () => {
  const [result] = buildRecommendations([topic({ masteryScore: 90, confidence: 0.9, questionsAnswered: 20,
    correctAnswers: 19, wrongAnswers: 1 })]);
  assert.equal(result.action, 'review');
  assert.equal(result.reasonCode, 'adaptive_v1.review');
});

test('preserva relevância zero sem aplicar o fallback médio', () => {
  const [result] = buildRecommendations([topic({ examRelevance: 0 })]);
  assert.equal(result.factors.examRelevance, 0);
});
