'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mapExtractedTopics, normalizeLabel } = require('../lib/taxonomy-normalizer');

test('normaliza acentos e espaços', () => assert.equal(normalizeLabel('  Remédios  Constitucionais '), 'remedios constitucionais'));
test('prefere código estável', () => { const mappings = mapExtractedTopics([{ nome: 'Constitucional', topicos: ['CONST.ART5'] }], [{ id: '1', name: 'Artigo 5º', stable_code: 'CONST.ART5' }], []); assert.equal(mappings[0].match_method, 'stable_code'); });
test('mapeia alias conhecido', () => { const topics = [{ id: '1', name: 'Ação Direta de Inconstitucionalidade', stable_code: 'CONST.ADI' }]; const mappings = mapExtractedTopics([{ nome: 'Constitucional', topicos: ['ADI'] }], topics, [{ topic_id: '1', alias: 'ADI', normalized_alias: 'adi' }]); assert.equal(mappings[0].topic_id, '1'); });
test('preserva tópico sem correspondência para revisão', () => { const mappings = mapExtractedTopics([{ nome: 'Nova', topicos: ['Tema inédito'] }], [], []); assert.equal(mappings[0].match_method, 'unmatched'); });
