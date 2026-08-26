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
