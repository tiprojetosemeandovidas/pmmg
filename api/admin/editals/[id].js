'use strict';

const { allowMethods, error, handleError, json, readJson, routeId } = require('../../../lib/http');
const { validateEdital } = require('../../../lib/ai/edital-schema');
const { authenticateReviewer, rest } = require('../../../lib/supabase-server');
const { persistNormalizedEdital } = require('../../../lib/edital-workflow');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET', 'PATCH'])) return;
  try {
    const reviewer = await authenticateReviewer(request);
    const id = routeId(request);
    if (!UUID.test(id || '')) return error(response, 400, 'invalid_id', 'Identificador de edital inválido.');
    if (request.method === 'GET') {
      const rows = await rest(`notices?id=eq.${id}&select=id,file_name,status,review_status,extracted_data,extraction_confidence,validation_errors,created_at,reviewed_at&limit=1`);
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
      await persistNormalizedEdital(id, extractedData);
    }
    const rows = await rest(`notices?id=eq.${id}&select=id,status,review_status,reviewed_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'completed', review_status: body.decision, extracted_data: extractedData, validation_errors: [], reviewed_by: reviewer.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    return json(response, 200, { data: rows[0] });
  } catch (cause) {
    return handleError(response, cause, 'review_failed', 'Não foi possível revisar o edital.');
  }
};
