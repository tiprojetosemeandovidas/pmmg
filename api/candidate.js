'use strict';

const { error, handleError, json, readJson } = require('../lib/http');
const { UUID, validateAnswer } = require('../lib/candidate-schema');
const { authenticate, rest } = require('../lib/supabase-server');

function one(value) { return Array.isArray(value) ? value[0] : value; }
function action(request) { return one((request.query || {}).action) || ''; }

async function answer(request, response, user) {
  if (request.method !== 'POST') return error(response, 405, 'method_not_allowed', 'Método não permitido.');
  const validation = validateAnswer(await readJson(request));
  if (!validation.valid) return error(response, 422, 'answer_validation_failed', 'Resposta inválida.', validation.errors);
  const item = validation.data;
  const rows = await rest('rpc/record_question_answer', { method: 'POST', body: JSON.stringify({
    p_user_id: user.id, p_question_id: item.questionId, p_selected_option: item.selectedOption,
    p_idempotency_key: item.idempotencyKey, p_response_time_ms: item.responseTimeMs,
    p_diagnostic_session_id: item.diagnosticSessionId
  }) });
  const result = rows[0];
  return json(response, result.already_recorded ? 200 : 201, { data: {
    answerId: result.answer_id, correct: result.correct, correctOption: result.correct_option,
    explanation: result.explanation, alreadyRecorded: result.already_recorded
  } });
}

async function mastery(request, response, user) {
  if (request.method !== 'GET') return error(response, 405, 'method_not_allowed', 'Método não permitido.');
  const rows = await rest(`topic_mastery?user_id=eq.${user.id}&select=topic_id,mastery_score,confidence,questions_answered,correct_answers,wrong_answers,last_question_at,average_response_time_seconds,streak,topics(stable_code,name,subjects(name))&order=mastery_score.asc`);
  const data = rows.map(row => ({ topicId: row.topic_id, topicCode: row.topics && row.topics.stable_code,
    topic: row.topics && row.topics.name, subject: row.topics && row.topics.subjects && row.topics.subjects.name,
    score: Number(row.mastery_score), confidence: Number(row.confidence), questionsAnswered: row.questions_answered,
    correctAnswers: row.correct_answers, wrongAnswers: row.wrong_answers,
    averageResponseTimeSeconds: row.average_response_time_seconds == null ? null : Number(row.average_response_time_seconds),
    streak: row.streak, lastQuestionAt: row.last_question_at }));
  const total = data.reduce((sum, item) => sum + item.questionsAnswered, 0);
  const weighted = total ? data.reduce((sum, item) => sum + item.score * item.questionsAnswered, 0) / total : 0;
  return json(response, 200, { data, summary: { masteryScore: Math.round(weighted * 100) / 100,
    evidenceCount: total, confidence: data.length ? Math.round(data.reduce((sum, item) => sum + item.confidence, 0) / data.length * 10000) / 10000 : 0,
    priorityTopics: data.filter(item => item.questionsAnswered > 0).slice(0, 3).map(item => ({ topicId: item.topicId, topic: item.topic, subject: item.subject, score: item.score })) } });
}

async function diagnostics(request, response, user) {
  if (request.method === 'GET') {
    const rows = await rest(`diagnostic_sessions?user_id=eq.${user.id}&select=id,exam_id,status,question_count,answered_count,correct_count,result,started_at,completed_at&order=started_at.desc&limit=20`);
    return json(response, 200, { data: rows });
  }
  if (request.method !== 'POST') return error(response, 405, 'method_not_allowed', 'Método não permitido.');
  const body = await readJson(request) || {}; const examId = body.examId || null;
  const questionCount = Number.isInteger(body.questionCount) ? body.questionCount : 20;
  if (examId && !UUID.test(examId)) return error(response, 422, 'invalid_exam', 'Concurso inválido.');
  if (questionCount < 5 || questionCount > 100) return error(response, 422, 'invalid_question_count', 'Use entre 5 e 100 questões.');
  const created = await rest('diagnostic_sessions?select=id,status,question_count,started_at', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, exam_id: examId, question_count: questionCount }) });
  return json(response, 201, { data: created[0] });
}

async function completeDiagnostic(request, response, user) {
  if (request.method !== 'POST') return error(response, 405, 'method_not_allowed', 'Método não permitido.');
  const id = one((request.query || {}).id);
  if (!UUID.test(id || '')) return error(response, 400, 'invalid_id', 'Diagnóstico inválido.');
  const sessions = await rest(`diagnostic_sessions?id=eq.${id}&user_id=eq.${user.id}&status=eq.in_progress&select=id,answered_count,correct_count&limit=1`);
  if (!sessions.length) return error(response, 404, 'diagnostic_not_found', 'Diagnóstico não encontrado.');
  if (!sessions[0].answered_count) return error(response, 409, 'diagnostic_empty', 'Responda ao menos uma questão antes de concluir.');
  const rows = await rest(`topic_mastery?user_id=eq.${user.id}&questions_answered=gt.0&select=topic_id,mastery_score,confidence,questions_answered,topics(name,subjects(name))&order=mastery_score.asc&limit=5`);
  const score = Math.round(sessions[0].correct_count * 10000 / sessions[0].answered_count) / 100;
  const priorities = rows.slice(0, 3).map(item => ({ topicId: item.topic_id, topic: item.topics && item.topics.name, subject: item.topics && item.topics.subjects && item.topics.subjects.name, score: Number(item.mastery_score) }));
  const result = { score, answeredCount: sessions[0].answered_count, correctCount: sessions[0].correct_count, priorityTopics: priorities, modelVersion: 'candidate-v1' };
  const now = new Date().toISOString();
  const updated = await rest(`diagnostic_sessions?id=eq.${id}&user_id=eq.${user.id}&select=id,status,result,completed_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'completed', result, completed_at: now, updated_at: now }) });
  return json(response, 200, { data: updated[0] });
}

module.exports = async function handler(request, response) {
  const selected = action(request);
  if (selected === 'config') return json(response, 200, { supabaseUrl: process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '' });
  try {
    const user = await authenticate(request);
    if (selected === 'answer') return await answer(request, response, user);
    if (selected === 'mastery') return await mastery(request, response, user);
    if (selected === 'diagnostics') return await diagnostics(request, response, user);
    if (selected === 'diagnostic-complete') return await completeDiagnostic(request, response, user);
    return error(response, 404, 'candidate_action_not_found', 'Ação não encontrada.');
  } catch (cause) {
    const known = { question_not_available: [404, 'Questão indisponível.'], invalid_selected_option: [422, 'Alternativa inválida.'], diagnostic_not_available: [409, 'Diagnóstico indisponível.'] };
    const match = Object.entries(known).find(([key]) => cause.message && cause.message.includes(key));
    if (match) return error(response, match[1][0], match[0], match[1][1]);
    return handleError(response, cause, 'candidate_request_failed', 'Não foi possível processar a solicitação do candidato.');
  }
};
