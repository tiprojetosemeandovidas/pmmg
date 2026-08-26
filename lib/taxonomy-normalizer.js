'use strict';

function normalizeLabel(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function mapExtractedTopics(disciplines, topics, aliases) {
  const byName = new Map();
  const byCode = new Map();
  const byId = new Map();
  topics.forEach(topic => { byName.set(normalizeLabel(topic.name), topic); byCode.set(String(topic.stable_code).toUpperCase(), topic); byId.set(topic.id, topic); });
  const byAlias = new Map();
  aliases.forEach(alias => { const topic = byId.get(alias.topic_id); if (topic) byAlias.set(normalizeLabel(alias.normalized_alias || alias.alias), topic); });
  const mappings = [];
  for (const discipline of disciplines || []) for (const extracted of discipline.topicos || []) {
    const normalized = normalizeLabel(extracted);
    const codeMatch = byCode.get(String(extracted).toUpperCase());
    const nameMatch = byName.get(normalized);
    const aliasMatch = byAlias.get(normalized);
    const topic = codeMatch || nameMatch || aliasMatch;
    mappings.push({ extracted_subject: discipline.nome, extracted_topic: extracted, topic_id: topic ? topic.id : null, match_method: codeMatch ? 'stable_code' : nameMatch ? 'exact_name' : aliasMatch ? 'alias' : 'unmatched', confidence: codeMatch ? 1 : nameMatch ? 0.98 : aliasMatch ? 0.95 : 0, review_status: 'pending' });
  }
  return mappings;
}

module.exports = { mapExtractedTopics, normalizeLabel };
