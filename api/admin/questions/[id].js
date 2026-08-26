'use strict';

const { allowMethods, error, handleError, json, readJson, routeId } = require('../../../lib/http');
const { authenticateReviewer, rest } = require('../../../lib/supabase-server');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['PATCH'])) return;
  try {
    const reviewer = await authenticateReviewer(request);
    const id = routeId(request);
    if (!UUID.test(id || '')) return error(response, 400, 'invalid_id', 'Identificador de questão inválido.');
    const body = await readJson(request);
    if (!body || !['validated', 'rejected'].includes(body.decision)) return error(response, 400, 'invalid_decision', 'A decisão deve ser validated ou rejected.');
    const questions = await rest(`questions?id=eq.${id}&select=id,correct_option,source_type&limit=1`);
    if (!questions.length) return error(response, 404, 'question_not_found', 'Questão não encontrada.');
    if (body.decision === 'validated') {
      const options = await rest(`question_options?question_id=eq.${id}&select=option_index`);
      const sources = await rest(`question_sources?question_id=eq.${id}&select=id,source_url,official`);
      if (!options.some(option => option.option_index === questions[0].correct_option)) return error(response, 422, 'missing_answer', 'O gabarito não corresponde às alternativas normalizadas.');
      if (!sources.length || (questions[0].source_type === 'official_exam' && !sources.some(source => source.official && source.source_url))) return error(response, 422, 'missing_source', 'Questão oficial exige fonte oficial identificável.');
    }
    const now = new Date().toISOString();
    const update = body.decision === 'validated'
      ? { status: 'published', validation_status: 'validated', validation_notes: body.notes || null, reviewed_by: reviewer.id, reviewed_at: now, validated_by: reviewer.id, validated_at: now, updated_at: now }
      : { status: 'rejected', validation_status: 'rejected', validation_notes: body.notes || null, reviewed_by: reviewer.id, reviewed_at: now, updated_at: now };
    const rows = await rest(`questions?id=eq.${id}&select=id,status,validation_status,validated_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(update) });
    return json(response, 200, { data: rows[0] });
  } catch (cause) {
    return handleError(response, cause, 'question_review_failed', 'Não foi possível revisar a questão.');
  }
};
