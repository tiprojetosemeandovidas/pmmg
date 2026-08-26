#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateQuestion } = require('../lib/question-schema');

function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); field = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (quoted) throw new Error('CSV possui aspas não fechadas.');
  return rows;
}

function prepare(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (rows.length < 2) throw new Error('CSV não contém questões.');
  const headers = rows[0].map(value => value.trim());
  return rows.slice(1).map((values, index) => {
    const row = Object.fromEntries(headers.map((header, column) => [header, (values[column] || '').trim()]));
    const input = {
      examId: row.exam_id, axisId: row.axis_id, subject: row.subject, topic: row.topic,
      statement: row.statement, options: [row.option_a, row.option_b, row.option_c, row.option_d, row.option_e].filter(Boolean),
      correctOption: Number(row.correct_option), difficulty: row.difficulty || undefined,
      sourceType: row.source_type, sourceName: row.source_name, sourceUrl: row.source_url || undefined,
      authorizationReference: row.authorization_reference || undefined,
      sourcePage: row.source_page ? Number(row.source_page) : undefined,
      topicIds: row.topic_ids ? row.topic_ids.split('|').map(value => value.trim()).filter(Boolean) : []
    };
    const validation = validateQuestion(input);
    const errors = validation.errors || [];
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.axisId)) errors.push('axisId inválido.');
    if (errors.length) throw new Error(`Linha ${index + 2}: ${errors.join(' ')}`);
    return input;
  });
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Uso: node scripts/prepare_questions_import.js arquivo.csv'); process.exitCode = 1; }
  else {
    try { process.stdout.write(`${JSON.stringify({ questions: prepare(path.resolve(file)) }, null, 2)}\n`); }
    catch (cause) { console.error(cause.message); process.exitCode = 1; }
  }
}

module.exports = { parseCsv, prepare };
