'use strict';

const { allowMethods, handleError, json } = require('../../lib/http');
const { authenticate, rest } = require('../../lib/supabase-server');

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET'])) return;
  try {
    const user = await authenticate(request);
    const rows = await rest(`notices?user_id=eq.${encodeURIComponent(user.id)}&select=id,file_name,status,review_status,extracted_data,extraction_confidence,validation_errors,created_at,updated_at&order=created_at.desc&limit=50`);
    return json(response, 200, { data: rows });
  } catch (cause) {
    return handleError(response, cause, 'internal_error', 'Não foi possível listar os editais.');
  }
};
