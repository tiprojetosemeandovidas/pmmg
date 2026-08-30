'use strict';

const clamp = value => Math.max(0, Math.min(100, value));
const round = value => Math.round(value * 100) / 100;

function actionFor(item) {
  if (item.questionsAnswered < 3 || item.masteryScore < 50) return 'learn';
  if (item.wrongAnswers >= item.correctAnswers || item.masteryScore < 75) return 'practice';
  return 'review';
}

function buildReason(item, factors, action) {
  const actionLabel = { learn: 'Estude a base', practice: 'Resolva questões', review: 'Faça uma revisão' }[action];
  const evidence = item.questionsAnswered === 1 ? '1 resposta registrada' : `${item.questionsAnswered} respostas registradas`;
  return `${actionLabel}: domínio de ${round(item.masteryScore)}%, confiança de ${Math.round(item.confidence * 100)}% e ${evidence}. ` +
    `A lacuna de domínio contribuiu ${factors.masteryGap} pontos para a prioridade.`;
}

function buildRecommendations(items, options = {}) {
  const limit = Math.max(1, Math.min(20, options.limit || 5));
  return items.map(item => {
    const masteryScore = clamp(Number(item.masteryScore) || 0);
    const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
    const answered = Math.max(0, Number(item.questionsAnswered) || 0);
    const wrong = Math.max(0, Number(item.wrongAnswers) || 0);
    const masteryGap = round((100 - masteryScore) * 0.55);
    const uncertainty = round((1 - confidence) * 15);
    const errorPressure = round((answered ? wrong / answered : 1) * 20);
    const rawRelevance = item.examRelevance == null ? 0.5 : Number(item.examRelevance);
    const normalizedRelevance = Number.isFinite(rawRelevance) ? rawRelevance : 0.5;
    const examRelevance = round(Math.max(0, Math.min(1, normalizedRelevance)) * 10);
    const factors = { masteryGap, uncertainty, errorPressure, examRelevance };
    const priorityScore = round(clamp(Object.values(factors).reduce((sum, value) => sum + value, 0)));
    const action = actionFor({ ...item, masteryScore, questionsAnswered: answered, wrongAnswers: wrong });
    return { topicId: item.topicId, topicCode: item.topicCode, topic: item.topic, subject: item.subject,
      examId: item.examId || null, action, priorityScore, masteryScore, confidence, questionsAnswered: answered,
      factors, reasonCode: `adaptive_v1.${action}`, reason: buildReason({ ...item, masteryScore, confidence, questionsAnswered: answered }, factors, action) };
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.topic.localeCompare(b.topic, 'pt-BR')).slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

module.exports = { buildRecommendations };
