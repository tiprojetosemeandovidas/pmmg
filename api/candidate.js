'use strict';

const { error, handleError, json, readJson } = require('../lib/http');
const { UUID, validateAnswer } = require('../lib/candidate-schema');
const { authenticate, rest } = require('../lib/supabase-server');
const { buildRecommendations } = require('../lib/domain/adaptive-engine');
const { buildWeeklyPlan } = require('../lib/domain/adaptive-planner');

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
  const sessions = await rest(`diagnostic_sessions?id=eq.${id}&user_id=eq.${user.id}&status=eq.in_progress&select=id,question_count,answered_count,correct_count&limit=1`);
  if (!sessions.length) return error(response, 404, 'diagnostic_not_found', 'Diagnóstico não encontrado.');
  if (sessions[0].answered_count < sessions[0].question_count) return error(response, 409, 'diagnostic_incomplete', `Responda as ${sessions[0].question_count} questões antes de concluir.`);
  const answers = await rest(`user_answers?user_id=eq.${user.id}&diagnostic_session_id=eq.${id}&select=question_id`);
  const questionIds = [...new Set(answers.map(item => item.question_id))];
  const mappings = questionIds.length ? await rest(`question_topics?question_id=in.(${questionIds.join(',')})&select=topic_id`) : [];
  const topicIds = [...new Set(mappings.map(item => item.topic_id))];
  const rows = topicIds.length ? await rest(`topic_mastery?user_id=eq.${user.id}&topic_id=in.(${topicIds.join(',')})&questions_answered=gt.0&select=topic_id,mastery_score,confidence,questions_answered,topics(name,subjects(name))&order=mastery_score.asc&limit=5`) : [];
  const score = Math.round(sessions[0].correct_count * 10000 / sessions[0].answered_count) / 100;
  const priorities = rows.slice(0, 3).map(item => ({ topicId: item.topic_id, topic: item.topics && item.topics.name, subject: item.topics && item.topics.subjects && item.topics.subjects.name, score: Number(item.mastery_score) }));
  const result = { score, answeredCount: sessions[0].answered_count, correctCount: sessions[0].correct_count, priorityTopics: priorities, modelVersion: 'candidate-v1' };
  const now = new Date().toISOString();
  const updated = await rest(`diagnostic_sessions?id=eq.${id}&user_id=eq.${user.id}&select=id,status,result,completed_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'completed', result, completed_at: now, updated_at: now }) });
  return json(response, 200, { data: updated[0] });
}

async function recommendations(request, response, user) {
  const requestedLimit = Number(one((request.query || {}).limit) || 5);
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(10, requestedLimit)) : 5;
  if (request.method === 'GET') {
    const rows = await rest(`adaptive_recommendations?user_id=eq.${user.id}&status=eq.active&model_version=eq.adaptive-v1&select=topic_id,exam_id,rank,action,priority_score,reason_code,reason,factors,evidence,generated_at,topics(stable_code,name,subjects(name))&order=rank.asc&limit=${limit}`);
    const data = rows.map(row => ({ topicId: row.topic_id, examId: row.exam_id, rank: row.rank,
      action: row.action, priorityScore: Number(row.priority_score), reasonCode: row.reason_code,
      reason: row.reason, factors: row.factors, masteryScore: Number(row.evidence.masteryScore),
      confidence: Number(row.evidence.confidence), questionsAnswered: Number(row.evidence.questionsAnswered),
      topicCode: row.topics && row.topics.stable_code, topic: row.topics && row.topics.name,
      subject: row.topics && row.topics.subjects && row.topics.subjects.name }));
    return json(response, 200, { data, summary: { modelVersion: 'adaptive-v1',
      evidenceCount: data.reduce((sum, item) => sum + item.questionsAnswered, 0),
      generatedAt: rows.length ? rows[0].generated_at : null } });
  }
  if (request.method !== 'POST') return error(response, 405, 'method_not_allowed', 'Método não permitido.');
  const masteryRows = await rest(`topic_mastery?user_id=eq.${user.id}&questions_answered=gt.0&select=topic_id,mastery_score,confidence,questions_answered,correct_answers,wrong_answers,topics(stable_code,name,subjects(name))`);
  if (!masteryRows.length) return json(response, 200, { data: [], summary: { modelVersion: 'adaptive-v1', evidenceCount: 0, generatedAt: null } });
  const userExams = await rest(`user_exams?user_id=eq.${user.id}&status=in.(primary,secondary)&select=exam_id,status&order=priority.asc&limit=1`);
  const examId = userExams.length ? userExams[0].exam_id : null;
  const topicIds = masteryRows.map(row => row.topic_id);
  const mappings = examId ? await rest(`exam_topics?exam_id=eq.${examId}&topic_id=in.(${topicIds.join(',')})&select=topic_id,weight,historical_frequency`) : [];
  const relevance = new Map(mappings.map(item => [item.topic_id, item.historical_frequency == null ? (item.weight == null ? 0.5 : Math.min(1, Number(item.weight) / 100)) : Number(item.historical_frequency)]));
  const generated = buildRecommendations(masteryRows.map(row => ({ topicId: row.topic_id,
    topicCode: row.topics && row.topics.stable_code, topic: row.topics && row.topics.name,
    subject: row.topics && row.topics.subjects && row.topics.subjects.name,
    masteryScore: Number(row.mastery_score), confidence: Number(row.confidence),
    questionsAnswered: row.questions_answered, correctAnswers: row.correct_answers,
    wrongAnswers: row.wrong_answers, examId, examRelevance: relevance.get(row.topic_id) ?? 0.5 })), { limit });
  const now = new Date().toISOString();
  await rest('rpc/replace_adaptive_recommendations', { method: 'POST', body: JSON.stringify({
    p_user_id: user.id, p_items: generated.map(item => ({ ...item, evidence: {
      masteryScore: item.masteryScore, confidence: item.confidence, questionsAnswered: item.questionsAnswered
    } }))
  }) });
  return json(response, 200, { data: generated, summary: { modelVersion: 'adaptive-v1',
    evidenceCount: masteryRows.reduce((sum, row) => sum + row.questions_answered, 0), generatedAt: now } });
}

async function readCurrentPlan(user) {
  const plans = await rest(`study_plans?user_id=eq.${user.id}&status=eq.active&select=id,exam_id,week_start,weekly_minutes,status,model_version,generated_at&order=week_start.desc&limit=1`);
  if (!plans.length) return null;
  const tasks = await rest(`plan_tasks?plan_id=eq.${plans[0].id}&select=id,topic_id,task_type,scheduled_date,planned_minutes,display_order,reason,status,completed_at,topics(name,subjects(name))&order=display_order.asc`);
  return { id: plans[0].id, examId: plans[0].exam_id, weekStart: plans[0].week_start,
    weeklyMinutes: plans[0].weekly_minutes, status: plans[0].status, modelVersion: plans[0].model_version,
    generatedAt: plans[0].generated_at, tasks: tasks.map(item => ({ id: item.id, topicId: item.topic_id,
      topic: item.topics && item.topics.name, subject: item.topics && item.topics.subjects && item.topics.subjects.name,
      taskType: item.task_type, scheduledDate: item.scheduled_date, plannedMinutes: item.planned_minutes,
      displayOrder: item.display_order, reason: item.reason, status: item.status, completedAt: item.completed_at })) };
}

async function plan(request, response, user) {
  if (request.method === 'GET') return json(response, 200, { data: await readCurrentPlan(user) });
  if (request.method !== 'POST') return error(response, 405, 'method_not_allowed', 'Método não permitido.');
  const rows = await rest(`adaptive_recommendations?user_id=eq.${user.id}&status=eq.active&model_version=eq.adaptive-v1&select=id,topic_id,exam_id,action,priority_score,reason&order=rank.asc&limit=7`);
  if (!rows.length) return error(response, 409, 'recommendations_required', 'Atualize suas prioridades antes de gerar o plano.');
  const profiles = await rest(`profiles?id=eq.${user.id}&select=weekly_goal_minutes&limit=1`);
  const weeklyMinutes = profiles.length ? profiles[0].weekly_goal_minutes : 420;
  const generated = buildWeeklyPlan(rows.map(item => ({ id: item.id, topicId: item.topic_id,
    action: item.action, priorityScore: Number(item.priority_score), reason: item.reason })), { weeklyMinutes });
  await rest('rpc/replace_weekly_study_plan', { method: 'POST', body: JSON.stringify({ p_user_id: user.id,
    p_week_start: generated.weekStart, p_weekly_minutes: generated.weeklyMinutes, p_tasks: generated.tasks }) });
  return json(response, 201, { data: await readCurrentPlan(user) });
}

async function planTask(request, response, user) {
  if (request.method !== 'PATCH') return error(response, 405, 'method_not_allowed', 'Método não permitido.');
  const id = one((request.query || {}).id); const body = await readJson(request) || {};
  if (!UUID.test(id || '') || !['started', 'completed', 'skipped'].includes(body.status)) return error(response, 422, 'invalid_plan_task', 'Tarefa ou estado inválido.');
  const owned = await rest(`plan_tasks?id=eq.${id}&select=id,study_plans!inner(user_id)&study_plans.user_id=eq.${user.id}&limit=1`);
  if (!owned.length) return error(response, 404, 'plan_task_not_found', 'Tarefa não encontrada.');
  const now = new Date().toISOString();
  const updated = await rest(`plan_tasks?id=eq.${id}&select=id,status,completed_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: body.status, completed_at: body.status === 'completed' ? now : null, updated_at: now }) });
  return json(response, 200, { data: updated[0] });
}

async function reviews(request, response, user) {
  if (request.method !== 'GET') return error(response, 405, 'method_not_allowed', 'Método não permitido.');
  const rows = await rest(`review_queue?user_id=eq.${user.id}&status=eq.scheduled&select=id,question_id,interval_step,due_at,status,questions(statement,subject,topic)&order=due_at.asc&limit=50`);
  return json(response, 200, { data: rows.map(item => ({ id: item.id, questionId: item.question_id,
    intervalStep: item.interval_step, dueAt: item.due_at, status: item.status,
    statement: item.questions && item.questions.statement, subject: item.questions && item.questions.subject,
    topic: item.questions && item.questions.topic, due: new Date(item.due_at) <= new Date() })) });
}

async function advanceReview(request, response, user) {
  if (request.method !== 'POST') return error(response, 405, 'method_not_allowed', 'Método não permitido.');
  const id = one((request.query || {}).id);
  if (!UUID.test(id || '')) return error(response, 422, 'invalid_review', 'Revisão inválida.');
  const rows = await rest('rpc/advance_review_item', { method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_review_id: id }) });
  return json(response, 200, { data: rows[0] });
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
    if (selected === 'recommendations') return await recommendations(request, response, user);
    if (selected === 'plan') return await plan(request, response, user);
    if (selected === 'plan-task') return await planTask(request, response, user);
    if (selected === 'reviews') return await reviews(request, response, user);
    if (selected === 'review-advance') return await advanceReview(request, response, user);
    return error(response, 404, 'candidate_action_not_found', 'Ação não encontrada.');
  } catch (cause) {
    const known = { question_not_available: [404, 'Questão indisponível.'], invalid_selected_option: [422, 'Alternativa inválida.'], diagnostic_not_available: [409, 'Diagnóstico indisponível.'], diagnostic_full: [409, 'O diagnóstico já recebeu todas as respostas.'], diagnostic_question_already_answered: [409, 'Esta questão já foi respondida neste diagnóstico.'], idempotency_conflict: [409, 'A chave da tentativa já foi usada com outro conteúdo.'], review_not_available: [404, 'Revisão indisponível.'], invalid_plan: [422, 'Não foi possível montar um plano válido.'], invalid_recommendations: [422, 'Recomendações inválidas.'] };
    const match = Object.entries(known).find(([key]) => cause.message && cause.message.includes(key));
    if (match) return error(response, match[1][0], match[0], match[1][1]);
    return handleError(response, cause, 'candidate_request_failed', 'Não foi possível processar a solicitação do candidato.');
  }
};
