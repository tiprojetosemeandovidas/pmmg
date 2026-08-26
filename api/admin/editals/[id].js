'use strict';

const { allowMethods, error, json, readJson, routeId } = require('../../../lib/http');
const { validateEdital } = require('../../../lib/ai/edital-schema');
const { authenticateReviewer, rest } = require('../../../lib/supabase-server');
const { mapExtractedTopics } = require('../../../lib/taxonomy-normalizer');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET', 'PATCH'])) return;
  try {
    const reviewer = await authenticateReviewer(request);
    const id = routeId(request);
    if (!UUID.test(id || '')) return error(response, 400, 'invalid_id', 'Identificador de edital inválido.');
    if (request.method === 'GET') {
      const rows = await rest(`notices?id=eq.${id}&select=id,file_name,status,extracted_data,extraction_confidence,validation_errors,created_at,reviewed_at&limit=1`);
      if (!rows.length) return error(response, 404, 'notice_not_found', 'Edital não encontrado.');
      return json(response, 200, { data: rows[0] });
    }
    const body = await readJson(request);
    if (!body || !['approved', 'rejected'].includes(body.decision)) return error(response, 400, 'invalid_decision', 'A decisão deve ser approved ou rejected.');
    const notices = await rest(`notices?id=eq.${id}&select=id,extracted_data&limit=1`);
    if (!notices.length) return error(response, 404, 'notice_not_found', 'Edital não encontrado.');
    const extractedData = body.correctedData || notices[0].extracted_data;
    if (body.decision === 'approved') {
      const validation = validateEdital(extractedData);
      if (!validation.valid) return error(response, 422, 'schema_validation_failed', 'Os dados corrigidos ainda são inválidos.', validation.errors);
      const [topics, aliases] = await Promise.all([rest('topics?select=id,name,stable_code,subject_id&active=eq.true'), rest('topic_aliases?select=topic_id,alias,normalized_alias')]);
      const mappings = mapExtractedTopics(extractedData.disciplinas, topics, aliases).map(item => Object.assign({ notice_id: id }, item));
      await rest(`notice_topic_mappings?notice_id=eq.${id}`, { method: 'DELETE' });
      if (mappings.length) await rest('notice_topic_mappings', { method: 'POST', body: JSON.stringify(mappings) });
      await rest(`notice_stages?notice_id=eq.${id}`, { method: 'DELETE' });
      if (extractedData.etapas.length) await rest('notice_stages', { method: 'POST', body: JSON.stringify(extractedData.etapas.map((stage, index) => ({ notice_id: id, name: stage.nome, stage_type: stage.tipo || 'other', display_order: index, details: { description: stage.detalhes } }))) });
    }
    const rows = await rest(`notices?id=eq.${id}&select=id,status,reviewed_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: body.decision, extracted_data: extractedData, validation_errors: [], reviewed_by: reviewer.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    return json(response, 200, { data: rows[0] });
  } catch (cause) {
    return error(response, cause.status || 500, cause.code || 'review_failed', cause.status ? cause.message : 'Não foi possível revisar o edital.');
  }
};
