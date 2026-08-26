'use strict';

const SOURCE_TYPES = new Set(['official_exam', 'licensed', 'public_source', 'ai_generated', 'manually_created']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value, max, required = false) {
  if (value == null) return required ? null : undefined;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if ((required && !text) || text.length > max) return null;
  return text || undefined;
}

function validateQuestion(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['Questão inválida.'] };
  const statement = cleanText(input.statement, 20000, true);
  const subject = cleanText(input.subject, 300, true);
  const topic = cleanText(input.topic, 500);
  const explanation = cleanText(input.explanation, 10000);
  const sourceName = cleanText(input.sourceName, 500, true);
  if (!statement) errors.push('statement é obrigatório e deve ter até 20.000 caracteres.');
  if (!subject) errors.push('subject é obrigatório e deve ter até 300 caracteres.');
  if (!sourceName) errors.push('sourceName é obrigatório e deve ter até 500 caracteres.');
  if (!UUID.test(input.examId || '')) errors.push('examId deve ser um UUID válido.');
  if (!SOURCE_TYPES.has(input.sourceType)) errors.push('sourceType inválido.');
  if (input.difficulty != null && !DIFFICULTIES.has(input.difficulty)) errors.push('difficulty inválida.');
  if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 26) errors.push('options deve conter entre 2 e 26 alternativas.');
  const options = Array.isArray(input.options) ? input.options.map((option, index) => {
    const content = cleanText(option, 5000, true);
    if (!content) errors.push(`options[${index}] é inválida.`);
    return content;
  }) : [];
  const correctOption = input.correctOption;
  if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) errors.push('correctOption deve apontar para uma alternativa existente.');
  const sourceUrl = cleanText(input.sourceUrl, 2000);
  if (sourceUrl) {
    try { const url = new URL(sourceUrl); if (!['http:', 'https:'].includes(url.protocol)) errors.push('sourceUrl deve usar HTTP ou HTTPS.'); } catch { errors.push('sourceUrl inválida.'); }
  }
  const topicIds = input.topicIds == null ? [] : input.topicIds;
  if (!Array.isArray(topicIds) || topicIds.some(id => !UUID.test(id))) errors.push('topicIds deve conter somente UUIDs válidos.');
  if (input.sourceType === 'official_exam' && !sourceUrl) errors.push('Questão oficial exige sourceUrl.');
  if (errors.length) return { valid: false, errors };
  return { valid: true, data: {
    examId: input.examId, subject, topic, statement, options, correctOption, explanation,
    difficulty: input.difficulty, sourceType: input.sourceType, sourceName, sourceUrl,
    authorizationReference: cleanText(input.authorizationReference, 1000),
    sourcePage: Number.isInteger(input.sourcePage) && input.sourcePage > 0 ? input.sourcePage : undefined,
    topicIds: [...new Set(topicIds)]
  } };
}

module.exports = { DIFFICULTIES, SOURCE_TYPES, validateQuestion };
