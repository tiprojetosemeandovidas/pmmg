'use strict';

const { startEditalExtraction } = require('../../../lib/ai/edital-extractor');
const { deleteResponse, editalModel } = require('../../../lib/ai/client');
const { patchNotice } = require('../../../lib/edital-workflow');
const { allowMethods, error, handleError, json, routeId } = require('../../../lib/http');
const { enforceRateLimit } = require('../../../lib/rate-limit');
const { authenticate, downloadPdf, rest } = require('../../../lib/supabase-server');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE = new Set(['queued', 'extracting', 'processing', 'normalizing']);
const REUSABLE = new Set(['completed', 'needs_review']);

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  let runId;
  let noticeId;
  let providerId;
  try {
    const user = await authenticate(request);
    noticeId = routeId(request);
    if (!UUID.test(noticeId || '')) return error(response, 400, 'invalid_id', 'Identificador de edital inválido.');
    const rows = await rest(`notices?id=eq.${noticeId}&user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`);
    if (!rows.length) return error(response, 404, 'notice_not_found', 'Edital não encontrado.');
    const notice = rows[0];
    if (REUSABLE.has(notice.status) || notice.review_status === 'approved') {
      return json(response, 200, { data: { id: notice.id, status: notice.status, reviewStatus: notice.review_status, extractedData: notice.extracted_data, reused: true } });
    }
    if (ACTIVE.has(notice.status)) return json(response, 202, { data: { id: notice.id, status: notice.status } });

    await enforceRateLimit(`edital-extract:${user.id}`, 3, 60 * 60);
    await patchNotice(noticeId, { status: 'queued', validation_errors: [] });
    const model = editalModel();
    const runs = await rest('notice_extraction_runs?select=id', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ notice_id: noticeId, user_id: user.id, provider: 'openai', model, status: 'queued' })
    });
    runId = runs[0].id;
    const pdf = await downloadPdf(notice.storage_path);
    const provider = await startEditalExtraction(pdf, user.id);
    providerId = provider.id;
    const status = provider.status === 'completed' ? 'processing' : 'extracting';
    await patchNotice(noticeId, { status });
    await rest(`notice_extraction_runs?id=eq.${runId}`, { method: 'PATCH', body: JSON.stringify({ status: provider.status === 'completed' ? 'processing' : 'queued', provider_request_id: provider.id, model: provider.model || model }) });
    providerId = null;
    return json(response, 202, { data: { id: noticeId, status } });
  } catch (cause) {
    if (noticeId) await patchNotice(noticeId, { status: 'failed', validation_errors: [cause.code || 'extraction_failed'] }).catch(() => {});
    if (runId) await rest(`notice_extraction_runs?id=eq.${runId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error_code: cause.code || 'extraction_failed', completed_at: new Date().toISOString() }) }).catch(() => {});
    if (providerId) await deleteResponse(providerId);
    return handleError(response, cause, 'extraction_failed', 'Não foi possível iniciar a análise do edital.');
  }
};

module.exports.config = { maxDuration: 30 };
