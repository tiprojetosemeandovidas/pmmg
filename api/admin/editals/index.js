'use strict';

const { allowMethods, handleError, json } = require('../../../lib/http');
const { authenticateReviewer, rest } = require('../../../lib/supabase-server');

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET'])) return;
  try {
    await authenticateReviewer(request);
    const rows = await rest('notices?select=id,file_name,status,review_status,extraction_confidence,created_at,reviewed_at&order=created_at.desc&limit=100');
    return json(response, 200, { data: rows });
  } catch (cause) {
    return handleError(response, cause, 'internal_error', 'Não foi possível abrir a fila de revisão.');
  }
};
