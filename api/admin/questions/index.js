'use strict';

const crypto = require('node:crypto');
const { allowMethods, error, handleError, json, readJson } = require('../../../lib/http');
const { validateQuestion } = require('../../../lib/question-schema');
const { authenticateReviewer, rest } = require('../../../lib/supabase-server');

async function createQuestion(input, reviewerId) {
  const validation = validateQuestion(input);
  if (!validation.valid) throw Object.assign(new Error('Questão inválida.'), { status: 422, code: 'question_validation_failed', details: validation.errors });
  const item = validation.data;
  const contentHash = crypto.createHash('sha256').update(`${item.examId}:${item.statement}:${item.options.join('\n')}`).digest('hex');
  const payload = {
    exam_id: item.examId, axis_id: input.axisId, subject: item.subject, topic: item.topic || null,
    statement: item.statement, options: item.options, correct_option: item.correctOption,
    explanation: item.explanation || null, difficulty: item.difficulty || null,
    source_page: item.sourcePage || null, content_hash: contentHash, status: 'review',
    source_type: item.sourceType, validation_status: 'pending'
  };
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(payload.axis_id || '')) throw Object.assign(new Error('axisId deve ser um UUID válido.'), { status: 422, code: 'question_validation_failed' });
  const created = await rest('questions?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  const questionId = created[0].id;
  try {
    await rest('question_options', { method: 'POST', body: JSON.stringify(item.options.map((content, index) => ({ question_id: questionId, option_index: index, label: String.fromCharCode(65 + index), content }))) });
    await rest('question_sources', { method: 'POST', body: JSON.stringify({ question_id: questionId, source_type: item.sourceType, source_name: item.sourceName, source_url: item.sourceUrl || null, authorization_reference: item.authorizationReference || null, source_page: item.sourcePage || null, official: item.sourceType === 'official_exam', metadata: { imported_by: reviewerId } }) });
    if (item.topicIds.length) await rest('question_topics', { method: 'POST', body: JSON.stringify(item.topicIds.map((topicId, index) => ({ question_id: questionId, topic_id: topicId, relevance: 1, is_primary: index === 0, classification_method: 'manual', classified_by: reviewerId }))) });
  } catch (cause) {
    await rest(`questions?id=eq.${questionId}`, { method: 'DELETE' }).catch(() => {});
    throw cause;
  }
  return questionId;
}

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET', 'POST'])) return;
  try {
    const reviewer = await authenticateReviewer(request);
    if (request.method === 'GET') {
      const rows = await rest('questions?validation_status=eq.pending&select=id,exam_id,subject,topic,statement,difficulty,source_type,created_at&order=created_at.asc&limit=100');
      return json(response, 200, { data: rows });
    }
    const body = await readJson(request);
    const items = Array.isArray(body && body.questions) ? body.questions : [body];
    if (!items.length || items.length > 25) return error(response, 400, 'invalid_batch', 'Envie entre 1 e 25 questões por lote.');
    const ids = [];
    for (const item of items) ids.push(await createQuestion(item, reviewer.id));
    return json(response, 201, { data: ids.map(id => ({ id, validationStatus: 'pending' })) });
  } catch (cause) {
    return handleError(response, cause, 'question_import_failed', 'Não foi possível importar as questões.');
  }
};
