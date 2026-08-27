'use strict';

const { allowMethods, handleError, json } = require('../../lib/http');
const { authenticate, rest } = require('../../lib/supabase-server');

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['GET'])) return;
  try {
    const user = await authenticate(request);
    const rows = await rest(`topic_mastery?user_id=eq.${user.id}&select=topic_id,mastery_score,confidence,questions_answered,correct_answers,wrong_answers,last_question_at,average_response_time_seconds,streak,topics(stable_code,name,subjects(name))&order=mastery_score.asc`);
    const data = rows.map(row => ({
      topicId: row.topic_id,
      topicCode: row.topics && row.topics.stable_code,
      topic: row.topics && row.topics.name,
      subject: row.topics && row.topics.subjects && row.topics.subjects.name,
      score: Number(row.mastery_score),
      confidence: Number(row.confidence),
      questionsAnswered: row.questions_answered,
      correctAnswers: row.correct_answers,
      wrongAnswers: row.wrong_answers,
      averageResponseTimeSeconds: row.average_response_time_seconds == null ? null : Number(row.average_response_time_seconds),
      streak: row.streak,
      lastQuestionAt: row.last_question_at
    }));
    const total = data.reduce((sum, item) => sum + item.questionsAnswered, 0);
    const weighted = total ? data.reduce((sum, item) => sum + item.score * item.questionsAnswered, 0) / total : 0;
    return json(response, 200, { data, summary: {
      masteryScore: Math.round(weighted * 100) / 100,
      evidenceCount: total,
      confidence: data.length ? Math.round(data.reduce((sum, item) => sum + item.confidence, 0) / data.length * 10000) / 10000 : 0,
      priorityTopics: data.filter(item => item.questionsAnswered > 0).slice(0, 3).map(item => ({ topicId: item.topicId, topic: item.topic, subject: item.subject, score: item.score }))
    } });
  } catch (cause) {
    return handleError(response, cause, 'mastery_failed', 'Não foi possível carregar o domínio do candidato.');
  }
};
