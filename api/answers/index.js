'use strict';

const { allowMethods, error, handleError, json, readJson } = require('../../lib/http');
const { validateAnswer } = require('../../lib/candidate-schema');
const { authenticate, rest } = require('../../lib/supabase-server');

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  try {
    const user = await authenticate(request);
    const validation = validateAnswer(await readJson(request));
    if (!validation.valid) return error(response, 422, 'answer_validation_failed', 'Resposta inválida.', validation.errors);
    const item = validation.data;
    const rows = await rest('rpc/record_question_answer', {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: user.id,
        p_question_id: item.questionId,
        p_selected_option: item.selectedOption,
        p_idempotency_key: item.idempotencyKey,
        p_response_time_ms: item.responseTimeMs,
        p_diagnostic_session_id: item.diagnosticSessionId
      })
    });
    const result = rows[0];
    return json(response, result.already_recorded ? 200 : 201, { data: {
      answerId: result.answer_id,
      correct: result.correct,
      correctOption: result.correct_option,
      explanation: result.explanation,
      alreadyRecorded: result.already_recorded
    } });
  } catch (cause) {
    const known = {
      question_not_available: ['question_not_available', 'Questão indisponível.', 404],
      invalid_selected_option: ['invalid_selected_option', 'Alternativa inválida.', 422],
      diagnostic_not_available: ['diagnostic_not_available', 'Diagnóstico indisponível.', 409]
    };
    const match = Object.entries(known).find(([key]) => cause.message && cause.message.includes(key));
    if (match) return error(response, match[1][2], match[1][0], match[1][1]);
    return handleError(response, cause, 'answer_failed', 'Não foi possível registrar a resposta.');
  }
};
