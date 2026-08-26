'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEdital } = require('../lib/ai/edital-schema');

function valid(overrides = {}) {
  return Object.assign({ orgao: 'Órgão', cargo: 'Cargo', banca: null, numero_edital: '1/2026', data_prova: '2026-12-01', data_inscricao_inicio: null, data_inscricao_fim: null, numero_vagas: 10, disciplinas: [{ nome: 'Português', quantidade_questoes: 10, peso: 1, topicos: ['Interpretação'] }], criterios_aprovacao: [], criterios_eliminacao: [], etapas: [], taf: null, confianca_geral: 0.8, alertas_revisao: [] }, overrides);
}

test('aceita extração válida', () => assert.equal(validateEdital(valid()).valid, true));
test('rejeita data fora do padrão ISO', () => assert.equal(validateEdital(valid({ data_prova: '01/12/2026' })).valid, false));
test('rejeita confiança fora da escala', () => assert.equal(validateEdital(valid({ confianca_geral: 1.2 })).valid, false));
test('rejeita disciplina sem tópicos', () => assert.equal(validateEdital(valid({ disciplinas: [{ nome: 'Direito' }] })).valid, false));
test('rejeita data impossível', () => assert.equal(validateEdital(valid({ data_prova: '2026-02-31' })).valid, false));
test('rejeita campo inesperado na revisão manual', () => assert.equal(validateEdital(valid({ campo_inventado: true })).valid, false));
test('aceita campos desconhecidos como null e encaminha baixa confiança para revisão', () => assert.equal(validateEdital(valid({ orgao: null, cargo: null, banca: null, numero_edital: null, data_prova: null, numero_vagas: null, disciplinas: [], confianca_geral: 0, alertas_revisao: ['PDF sem texto suficiente'] })).valid, true));
test('rejeita baixa confiança sem justificativa', () => assert.equal(validateEdital(valid({ confianca_geral: 0.2, alertas_revisao: [] })).valid, false));
test('rejeita período de inscrição invertido', () => assert.equal(validateEdital(valid({ data_inscricao_inicio: '2026-05-10', data_inscricao_fim: '2026-05-01' })).valid, false));
