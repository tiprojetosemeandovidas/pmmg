'use strict';

const { completeEditalExtraction } = require('../../../lib/ai/edital-extractor');
const { deleteResponse, retrieveResponse } = require('../../../lib/ai/client');
const { patchNotice, persistNormalizedEdital } = require('../../../lib/edital-workflow');
const { allowMethods, error, handleError, json, routeId } = require('../../../lib/http');
const { enforceRateLimit } = require('../../../lib/rate-limit');
const { authenticate, rest } = require('../../../lib/supabase-server');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINISHED = new Set(['completed', 'needs_review']);

async function failRun(runId, noticeId, code) {
  await patchNotice(noticeId, { status: 'failed', validation_errors: [code] });
  await rest(`notice_extraction_runs?id=eq.${runId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error_code: code, completed_at: new Date().toISOString() }) });
}

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET'])) return;
  let claimedNoticeId;
  let currentNoticeId;
  let currentRunId;
  let currentProviderId;
  try {
    const user = await authenticate(request);
    await enforceRateLimit(`edital-status:${user.id}`, 180, 60 * 60);
    const noticeId = routeId(request);
    if (!UUID.test(noticeId || '')) return error(response, 400, 'invalid_id', 'Identificador de edital inválido.');
    const notices = await rest(`notices?id=eq.${noticeId}&user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`);
    if (!notices.length) return error(response, 404, 'notice_not_found', 'Edital não encontrado.');
    const notice = notices[0];
    currentNoticeId = noticeId;
    if (FINISHED.has(notice.status)) return json(response, 200, { data: { id: notice.id, status: notice.status, reviewStatus: notice.review_status, extractedData: notice.extracted_data, confidence: notice.extraction_confidence } });
    if (notice.status === 'failed') return error(response, 422, 'extraction_failed', 'A análise falhou. Você pode tentar novamente.', notice.validation_errors);
    if (notice.status === 'normalizing') return json(response, 202, { data: { id: notice.id, status: notice.status } });

    const runs = await rest(`notice_extraction_runs?notice_id=eq.${noticeId}&user_id=eq.${encodeURIComponent(user.id)}&select=*&order=started_at.desc&limit=1`);
    if (!runs.length || !runs[0].provider_request_id) return json(response, 202, { data: { id: notice.id, status: notice.status } });
    const run = runs[0];
    currentRunId = run.id;
    const providerId = run.provider_request_id;
    currentProviderId = providerId;
    const provider = await retrieveResponse(providerId);
    if (['queued', 'in_progress'].includes(provider.status)) {
      const status = provider.status === 'queued' ? 'queued' : 'processing';
      await patchNotice(noticeId, { status });
      return json(response, 202, { data: { id: notice.id, status } });
    }
    if (provider.status !== 'completed') {
      await failRun(run.id, noticeId, `provider_${provider.status || 'failed'}`);
      return error(response, 422, 'ai_processing_failed', 'O serviço de interpretação não concluiu a análise.');
    }

    const claimed = await rest(`notices?id=eq.${noticeId}&status=in.(queued,extracting,processing)&select=id`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'normalizing', updated_at: new Date().toISOString() }) });
    if (!claimed.length) return json(response, 202, { data: { id: notice.id, status: 'normalizing' } });
    claimedNoticeId = noticeId;
    const extracted = completeEditalExtraction(provider);
    if (!extracted.validation.valid) {
      await patchNotice(noticeId, { status: 'failed', extracted_data: null, extraction_confidence: null, validation_errors: extracted.validation.errors });
      await rest(`notice_extraction_runs?id=eq.${run.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', provider_request_id: extracted.id, model: extracted.model, input_tokens: extracted.usage.input_tokens || null, output_tokens: extracted.usage.output_tokens || null, completed_at: new Date().toISOString(), error_code: 'schema_validation_failed' }) });
      await deleteResponse(providerId);
      currentProviderId = null;
      return error(response, 422, 'schema_validation_failed', 'A resposta automática foi rejeitada pela validação.', extracted.validation.errors);
    }
    const normalization = await persistNormalizedEdital(noticeId, extracted.data);
    await patchNotice(noticeId, { status: 'needs_review', review_status: 'pending', extraction_method: 'model_pdf_vision', extracted_data: extracted.data, extraction_confidence: extracted.data.confianca_geral, validation_errors: extracted.data.alertas_revisao });
    claimedNoticeId = null;
    await rest(`notice_extraction_runs?id=eq.${run.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', provider_request_id: extracted.id, model: extracted.model, input_tokens: extracted.usage.input_tokens || null, output_tokens: extracted.usage.output_tokens || null, completed_at: new Date().toISOString(), error_code: null }) });
    await deleteResponse(providerId);
    currentProviderId = null;
    return json(response, 200, { data: { id: noticeId, status: 'needs_review', reviewStatus: 'pending', extractedData: extracted.data, confidence: extracted.data.confianca_geral, normalization } });
  } catch (cause) {
    if (claimedNoticeId) await patchNotice(claimedNoticeId, { status: 'failed', validation_errors: [cause.code || 'normalization_failed'] }).catch(() => {});
    else if (currentNoticeId && cause.status !== 429) await patchNotice(currentNoticeId, { status: 'failed', validation_errors: [cause.code || 'status_failed'] }).catch(() => {});
    if (currentRunId) await rest(`notice_extraction_runs?id=eq.${currentRunId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error_code: cause.code || 'status_failed', completed_at: new Date().toISOString() }) }).catch(() => {});
    if (currentProviderId) await deleteResponse(currentProviderId);
    return handleError(response, cause, 'status_failed', 'Não foi possível atualizar o estado da análise.');
  }
};

module.exports.config = { maxDuration: 30 };
