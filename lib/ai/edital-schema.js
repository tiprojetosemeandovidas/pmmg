'use strict';

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };

const editalSchema = {
  type: 'object', additionalProperties: false,
  required: ['orgao', 'cargo', 'banca', 'numero_edital', 'data_prova', 'data_inscricao_inicio', 'data_inscricao_fim', 'numero_vagas', 'disciplinas', 'criterios_aprovacao', 'criterios_eliminacao', 'etapas', 'taf', 'confianca_geral', 'alertas_revisao'],
  properties: {
    orgao: nullableString, cargo: nullableString, banca: nullableString, numero_edital: nullableString,
    data_prova: nullableString, data_inscricao_inicio: nullableString, data_inscricao_fim: nullableString,
    numero_vagas: { type: ['integer', 'null'], minimum: 0 },
    disciplinas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'quantidade_questoes', 'peso', 'topicos'], properties: {
      nome: { type: 'string' }, quantidade_questoes: { type: ['integer', 'null'], minimum: 0 }, peso: nullableNumber,
      topicos: { type: 'array', items: { type: 'string' } }
    } } },
    criterios_aprovacao: { type: 'array', items: { type: 'string' } },
    criterios_eliminacao: { type: 'array', items: { type: 'string' } },
    etapas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'tipo', 'detalhes'], properties: { nome: { type: 'string' }, tipo: { type: 'string' }, detalhes: nullableString } } },
    taf: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['existe', 'testes'], properties: { existe: { type: 'boolean' }, testes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tipo', 'requisito', 'unidade'], properties: { tipo: { type: 'string' }, requisito: nullableString, unidade: nullableString } } } } }] },
    confianca_geral: { type: 'number', minimum: 0, maximum: 1 },
    alertas_revisao: { type: 'array', items: { type: 'string' } }
  }
};

function validDate(value) {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateEdital(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { valid: false, errors: ['A extração não é um objeto.'] };
  const allowed = new Set(['orgao', 'cargo', 'banca', 'numero_edital', 'data_prova', 'data_inscricao_inicio', 'data_inscricao_fim', 'numero_vagas', 'disciplinas', 'criterios_aprovacao', 'criterios_eliminacao', 'etapas', 'taf', 'confianca_geral', 'alertas_revisao']);
  for (const field of allowed) if (!(field in data)) errors.push(`Campo ausente: ${field}.`);
  for (const field of Object.keys(data)) if (!allowed.has(field)) errors.push(`Campo não permitido: ${field}.`);
  for (const field of ['orgao', 'cargo', 'banca', 'numero_edital']) if (data[field] !== null && typeof data[field] !== 'string') errors.push(`${field} deve ser texto ou null.`);
  for (const field of ['data_prova', 'data_inscricao_inicio', 'data_inscricao_fim']) if (!validDate(data[field])) errors.push(`${field} deve usar YYYY-MM-DD ou null.`);
  if (data.numero_vagas !== null && (!Number.isInteger(data.numero_vagas) || data.numero_vagas < 0)) errors.push('numero_vagas deve ser inteiro positivo ou null.');
  for (const field of ['criterios_aprovacao', 'criterios_eliminacao', 'alertas_revisao']) if (!Array.isArray(data[field]) || data[field].some(item => typeof item !== 'string')) errors.push(`${field} deve ser uma lista de textos.`);
  if (!Array.isArray(data.etapas)) errors.push('etapas deve ser uma lista.');
  else data.etapas.forEach((stage, index) => { if (!stage || typeof stage.nome !== 'string' || typeof stage.tipo !== 'string' || (stage.detalhes !== null && typeof stage.detalhes !== 'string')) errors.push(`Etapa ${index + 1} inválida.`); });
  if (!Array.isArray(data.disciplinas)) errors.push('disciplinas deve ser uma lista.');
  else data.disciplinas.forEach((subject, index) => {
    if (!subject || typeof subject.nome !== 'string' || !subject.nome.trim()) errors.push(`Disciplina ${index + 1} sem nome.`);
    if (!Array.isArray(subject && subject.topicos)) errors.push(`Disciplina ${index + 1} sem lista de tópicos.`);
    else if (subject.topicos.some(topic => typeof topic !== 'string' || !topic.trim())) errors.push(`Disciplina ${index + 1} possui tópico inválido.`);
    if (subject && subject.quantidade_questoes !== null && (!Number.isInteger(subject.quantidade_questoes) || subject.quantidade_questoes < 0)) errors.push(`Disciplina ${index + 1} possui quantidade inválida.`);
    if (subject && subject.peso !== null && (typeof subject.peso !== 'number' || subject.peso < 0)) errors.push(`Disciplina ${index + 1} possui peso inválido.`);
  });
  if (data.taf !== null && (!data.taf || typeof data.taf !== 'object' || typeof data.taf.existe !== 'boolean' || !Array.isArray(data.taf.testes))) errors.push('taf deve ser null ou uma estrutura válida.');
  if (typeof data.confianca_geral !== 'number' || data.confianca_geral < 0 || data.confianca_geral > 1) errors.push('confianca_geral deve estar entre 0 e 1.');
  return { valid: errors.length === 0, errors };
}

module.exports = { editalSchema, validateEdital };
