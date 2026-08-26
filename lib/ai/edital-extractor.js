'use strict';

const crypto = require('crypto');
const { parseStructuredResponse, startStructuredResponse } = require('./client');
const { editalSchema, validateEdital } = require('./edital-schema');

async function startEditalExtraction(pdfBytes, userId) {
  return startStructuredResponse({
    schema: editalSchema,
    schemaName: 'edital_publico',
    safetyIdentifier: crypto.createHash('sha256').update(userId).digest('hex').slice(0, 32),
    instructions: 'Extraia somente informações explícitas deste edital brasileiro. Use datas ISO YYYY-MM-DD. Use null quando não houver evidência. Preserve a hierarquia dos tópicos como texto. Não invente pesos, vagas, etapas ou requisitos. Adicione em alertas_revisao tudo que estiver ambíguo, ilegível ou contraditório.',
    input: [{ role: 'user', content: [
      { type: 'input_file', filename: 'edital.pdf', file_data: `data:application/pdf;base64,${pdfBytes.toString('base64')}` },
      { type: 'input_text', text: 'Analise o edital anexado e devolva a estrutura solicitada.' }
    ] }]
  });
}

function completeEditalExtraction(payload) {
  const result = parseStructuredResponse(payload);
  const validation = validateEdital(result.data);
  return Object.assign(result, { validation });
}

module.exports = { completeEditalExtraction, startEditalExtraction };
