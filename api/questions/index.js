'use strict';

const { allowMethods, error, handleError, json } = require('../../lib/http');
const { authenticate, rest } = require('../../lib/supabase-server');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function one(value) { return Array.isArray(value) ? value[0] : value; }
function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(one(value), 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET'])) return;
  try {
    await authenticate(request);
    const query = request.query || {};
    const limit = integer(query.limit, 20, 1, 100);
    const offset = integer(query.offset, 0, 0, 10000);
    const filters = ['status=eq.published', 'validation_status=eq.validated'];
    const examId = one(query.examId);
    const topicId = one(query.topicId);
    const difficulty = one(query.difficulty);
    const sourceType = one(query.sourceType);
    if (examId && !UUID.test(examId)) return error(response, 400, 'invalid_exam', 'Concurso inválido.');
    if (topicId && !UUID.test(topicId)) return error(response, 400, 'invalid_topic', 'Tópico inválido.');
    if (examId) filters.push(`exam_id=eq.${examId}`);
    if (topicId) {
      const mapped = await rest(`question_topics?topic_id=eq.${topicId}&select=question_id&order=relevance.desc&limit=1000`);
      if (!mapped.length) return json(response, 200, { data: [], pagination: { limit, offset, returned: 0 } });
      filters.push(`id=in.(${mapped.map(item => item.question_id).join(',')})`);
    }
    if (['easy', 'medium', 'hard'].includes(difficulty)) filters.push(`difficulty=eq.${difficulty}`);
    if (['official_exam', 'licensed', 'public_source', 'ai_generated', 'manually_created'].includes(sourceType)) filters.push(`source_type=eq.${sourceType}`);
    const rows = await rest(`questions?select=id,exam_id,subject,topic,statement,difficulty,source_type,question_axes(name)&${filters.join('&')}&order=created_at.desc&limit=${limit}&offset=${offset}`);
    const ids = rows.map(row => row.id);
    if (!ids.length) return json(response, 200, { data: [], pagination: { limit, offset, returned: 0 } });
    const inFilter = `in.(${ids.join(',')})`;
    const [options, topics, sources] = await Promise.all([
      rest(`question_options?question_id=${inFilter}&select=question_id,option_index,label,content&order=option_index.asc`),
      rest(`question_topics?question_id=${inFilter}&select=question_id,topic_id,relevance,is_primary,classification_method`),
      rest(`question_sources?question_id=${inFilter}&select=question_id,source_type,source_name,source_url,source_page,official`)
    ]);
    const data = rows.map(row => ({
      id: row.id, examId: row.exam_id, axis: row.question_axes && row.question_axes.name, subject: row.subject, topic: row.topic,
      statement: row.statement, difficulty: row.difficulty, sourceType: row.source_type,
      options: options.filter(item => item.question_id === row.id).map(item => ({ index: item.option_index, label: item.label, content: item.content })),
      topics: topics.filter(item => item.question_id === row.id).map(item => ({ id: item.topic_id, relevance: item.relevance, primary: item.is_primary, method: item.classification_method })),
      sources: sources.filter(item => item.question_id === row.id).map(item => ({ type: item.source_type, name: item.source_name, url: item.source_url, page: item.source_page, official: item.official }))
    }));
    return json(response, 200, { data, pagination: { limit, offset, returned: data.length } });
  } catch (cause) {
    return handleError(response, cause, 'questions_failed', 'Não foi possível carregar as questões.');
  }
};
