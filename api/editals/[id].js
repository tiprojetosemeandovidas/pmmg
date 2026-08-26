'use strict';

const { allowMethods, error, handleError, json, routeId } = require('../../lib/http');
const { authenticate, rest } = require('../../lib/supabase-server');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET'])) return;
  try {
    const user = await authenticate(request);
    const id = routeId(request);
    if (!UUID.test(id || '')) return error(response, 400, 'invalid_id', 'Identificador de edital inválido.');
    const rows = await rest(`notices?id=eq.${id}&user_id=eq.${encodeURIComponent(user.id)}&select=id,file_name,status,review_status,extracted_data,extraction_confidence,validation_errors,created_at,updated_at&limit=1`);
    if (!rows.length) return error(response, 404, 'notice_not_found', 'Edital não encontrado.');
    return json(response, 200, { data: rows[0] });
  } catch (cause) {
    return handleError(response, cause, 'internal_error', 'Não foi possível consultar o edital.');
  }
};
