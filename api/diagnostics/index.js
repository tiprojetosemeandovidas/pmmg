'use strict';

const { allowMethods, error, handleError, json, readJson } = require('../../lib/http');
const { UUID } = require('../../lib/candidate-schema');
const { authenticate, rest } = require('../../lib/supabase-server');

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET', 'POST'])) return;
  try {
    const user = await authenticate(request);
    if (request.method === 'GET') {
      const rows = await rest(`diagnostic_sessions?user_id=eq.${user.id}&select=id,exam_id,status,question_count,answered_count,correct_count,result,started_at,completed_at&order=started_at.desc&limit=20`);
      return json(response, 200, { data: rows });
    }
    const body = await readJson(request) || {};
    const examId = body.examId || null;
    const questionCount = Number.isInteger(body.questionCount) ? body.questionCount : 20;
    if (examId && !UUID.test(examId)) return error(response, 422, 'invalid_exam', 'Concurso inválido.');
    if (questionCount < 5 || questionCount > 100) return error(response, 422, 'invalid_question_count', 'Use entre 5 e 100 questões.');
    const created = await rest('diagnostic_sessions?select=id,status,question_count,started_at', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: user.id, exam_id: examId, question_count: questionCount })
    });
    return json(response, 201, { data: created[0] });
  } catch (cause) {
    return handleError(response, cause, 'diagnostic_failed', 'Não foi possível processar o diagnóstico.');
  }
};
