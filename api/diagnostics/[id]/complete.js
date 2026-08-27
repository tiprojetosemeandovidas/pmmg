'use strict';

const { allowMethods, error, handleError, json, routeId } = require('../../../lib/http');
const { UUID } = require('../../../lib/candidate-schema');
const { authenticate, rest } = require('../../../lib/supabase-server');

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  try {
    const user = await authenticate(request);
    const id = routeId(request);
    if (!UUID.test(id || '')) return error(response, 400, 'invalid_id', 'Diagnóstico inválido.');
    const sessions = await rest(`diagnostic_sessions?id=eq.${id}&user_id=eq.${user.id}&status=eq.in_progress&select=id,answered_count,correct_count&limit=1`);
    if (!sessions.length) return error(response, 404, 'diagnostic_not_found', 'Diagnóstico não encontrado.');
    if (!sessions[0].answered_count) return error(response, 409, 'diagnostic_empty', 'Responda ao menos uma questão antes de concluir.');
    const mastery = await rest(`topic_mastery?user_id=eq.${user.id}&questions_answered=gt.0&select=topic_id,mastery_score,confidence,questions_answered,topics(name,subjects(name))&order=mastery_score.asc&limit=5`);
    const score = Math.round(sessions[0].correct_count * 10000 / sessions[0].answered_count) / 100;
    const priorities = mastery.slice(0, 3).map(item => ({ topicId: item.topic_id, topic: item.topics && item.topics.name, subject: item.topics && item.topics.subjects && item.topics.subjects.name, score: Number(item.mastery_score) }));
    const result = { score, answeredCount: sessions[0].answered_count, correctCount: sessions[0].correct_count, priorityTopics: priorities, modelVersion: 'candidate-v1' };
    const updated = await rest(`diagnostic_sessions?id=eq.${id}&user_id=eq.${user.id}&select=id,status,result,completed_at`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'completed', result, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    });
    return json(response, 200, { data: updated[0] });
  } catch (cause) {
    return handleError(response, cause, 'diagnostic_completion_failed', 'Não foi possível concluir o diagnóstico.');
  }
};
