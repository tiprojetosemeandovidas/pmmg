'use strict';

const { rest } = require('./supabase-server');
const { mapExtractedTopics } = require('./taxonomy-normalizer');

async function patchNotice(id, values) {
  const rows = await rest(`notices?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(Object.assign({}, values, { updated_at: new Date().toISOString() })) });
  return rows && rows[0];
}

async function persistNormalizedEdital(noticeId, data) {
  const [topics, aliases] = await Promise.all([
    rest('topics?select=id,name,stable_code,subject_id&active=eq.true'),
    rest('topic_aliases?select=topic_id,alias,normalized_alias')
  ]);
  const mappings = mapExtractedTopics(data.disciplinas, topics, aliases).map(item => Object.assign({ notice_id: noticeId }, item));
  await rest(`notice_topic_mappings?notice_id=eq.${noticeId}`, { method: 'DELETE' });
  if (mappings.length) await rest('notice_topic_mappings', { method: 'POST', body: JSON.stringify(mappings) });
  await rest(`notice_stages?notice_id=eq.${noticeId}`, { method: 'DELETE' });
  if (data.etapas.length) {
    await rest('notice_stages', { method: 'POST', body: JSON.stringify(data.etapas.map((stage, index) => ({ notice_id: noticeId, name: stage.nome, stage_type: stage.tipo || 'other', display_order: index, details: { description: stage.detalhes } }))) });
  }
  return { matched: mappings.filter(item => item.topic_id).length, unmatched: mappings.filter(item => !item.topic_id).length };
}

module.exports = { patchNotice, persistNormalizedEdital };
