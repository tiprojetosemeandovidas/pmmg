'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWeeklyPlan } = require('../lib/domain/adaptive-planner');

const recommendations = [
  { topicId: '11111111-1111-4111-8111-111111111111', priorityScore: 80, action: 'learn', reason: 'Lacuna alta' },
  { topicId: '22222222-2222-4222-8222-222222222222', priorityScore: 40, action: 'practice', reason: 'Erros recentes' }
];

test('distribui a meta semanal a partir da segunda-feira', () => {
  const plan = buildWeeklyPlan(recommendations, { weeklyMinutes: 300, startDate: new Date('2026-08-27T12:00:00Z') });
  assert.equal(plan.weekStart, '2026-08-24');
  assert.equal(plan.tasks.reduce((sum, task) => sum + task.plannedMinutes, 0), plan.weeklyMinutes);
  assert.equal(plan.tasks[0].scheduledDate, '2026-08-24');
  assert.equal(plan.tasks[0].topicId, recommendations[0].topicId);
});

test('gera plano vazio sem recomendações', () => {
  const plan = buildWeeklyPlan([], { weeklyMinutes: 420, startDate: new Date('2026-08-27T12:00:00Z') });
  assert.deepEqual(plan.tasks, []);
});

test('limita quantidade de tarefas e preserva razões', () => {
  const plan = buildWeeklyPlan(recommendations, { weeklyMinutes: 900, startDate: new Date('2026-08-27T12:00:00Z') });
  assert.ok(plan.tasks.length <= 7);
  assert.ok(plan.tasks.every(task => task.reason));
});
