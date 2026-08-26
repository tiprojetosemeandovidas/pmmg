'use strict';

const { allowMethods, error, json, routeId } = require('../../../lib/http');
const { extractEdital } = require('../../../lib/ai/edital-extractor');
const { authenticate, downloadPdf, rest } = require('../../../lib/supabase-server');
const { enforceRateLimit } = require('../../../lib/rate-limit');
const { mapExtractedTopics } = require('../../../lib/taxonomy-normalizer');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function patchNotice(id, values) {
  return rest(`notices?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(Object.assign(values, { updated_at: new Date().toISOString() })) });
}

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  let runId;
  let noticeId;
  try {
    const user = await authenticate(request);
    enforceRateLimit(`edital-extract:${user.id}`, 10, 60 * 60 * 1000);
    noticeId = routeId(request);
    if (!UUID.test(noticeId || '')) return error(response, 400, 'invalid_id', 'Identificador de edital inválido.');
    const rows = await rest(`notices?id=eq.${noticeId}&user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`);
    if (!rows.length) return error(response, 404, 'notice_not_found', 'Edital não encontrado.');
    const notice = rows[0];
    if (notice.status === 'extracting') return error(response, 409, 'extraction_in_progress', 'Este edital já está sendo analisado.');
    await patchNotice(noticeId, { status: 'extracting', validation_errors: [] });
    const model = process.env.OPENAI_EDITAL_MODEL || 'gpt-4.1-mini';
    const runs = await rest('notice_extraction_runs?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ notice_id: noticeId, user_id: user.id, provider: 'openai', model }) });
    runId = runs[0].id;
    const pdf = await downloadPdf(notice.storage_path);
    const extracted = await extractEdital(pdf, user.id);
    const status = extracted.validation.valid ? 'extracted' : 'failed';
    await patchNotice(noticeId, { status, extraction_method: 'model_pdf_vision', extracted_data: extracted.data, extraction_confidence: extracted.data.confianca_geral, validation_errors: extracted.validation.errors });
    if (extracted.validation.valid && extracted.data.etapas.length) {
      await rest(`notice_stages?notice_id=eq.${noticeId}`, { method: 'DELETE' });
      await rest('notice_stages', { method: 'POST', body: JSON.stringify(extracted.data.etapas.map((stage, index) => ({ notice_id: noticeId, name: stage.nome, stage_type: stage.tipo || 'other', display_order: index, details: { description: stage.detalhes } }))) });
    }
    let normalization = { matched: 0, unmatched: 0 };
    if (extracted.validation.valid) {
      const [topics, aliases] = await Promise.all([rest('topics?select=id,name,stable_code,subject_id&active=eq.true'), rest('topic_aliases?select=topic_id,alias,normalized_alias')]);
      const mappings = mapExtractedTopics(extracted.data.disciplinas, topics, aliases).map(item => Object.assign({ notice_id: noticeId }, item));
      await rest(`notice_topic_mappings?notice_id=eq.${noticeId}`, { method: 'DELETE' });
      if (mappings.length) await rest('notice_topic_mappings', { method: 'POST', body: JSON.stringify(mappings) });
      normalization = { matched: mappings.filter(item => item.topic_id).length, unmatched: mappings.filter(item => !item.topic_id).length };
    }
    await rest(`notice_extraction_runs?id=eq.${runId}`, { method: 'PATCH', body: JSON.stringify({ status: extracted.validation.valid ? 'completed' : 'failed', provider_request_id: extracted.id, model: extracted.model, input_tokens: extracted.usage.input_tokens || null, output_tokens: extracted.usage.output_tokens || null, completed_at: new Date().toISOString(), error_code: extracted.validation.valid ? null : 'schema_validation_failed' }) });
    if (!extracted.validation.valid) return error(response, 422, 'schema_validation_failed', 'A extração precisa de revisão antes de ser usada.', extracted.validation.errors);
    return json(response, 200, { data: { id: noticeId, status, extractedData: extracted.data, confidence: extracted.data.confianca_geral, normalization, requiresReview: true } });
  } catch (cause) {
    if (noticeId) await patchNotice(noticeId, { status: 'failed', validation_errors: [cause.code || 'extraction_failed'] }).catch(() => {});
    if (runId) await rest(`notice_extraction_runs?id=eq.${runId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error_code: cause.code || 'extraction_failed', completed_at: new Date().toISOString() }) }).catch(() => {});
    return error(response, cause.status || 500, cause.code || 'extraction_failed', cause.status ? cause.message : 'Não foi possível analisar o edital.');
  }
};

module.exports.config = { maxDuration: 60 };
