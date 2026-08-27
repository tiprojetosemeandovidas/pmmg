'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = [
  'public/index.html', 'public/analisar-edital.html', 'public/admin.html',
  'api/editals/index.js', 'api/editals/upload-url.js', 'api/editals/upload.js',
  'api/editals/[id].js', 'api/editals/[id]/extract.js', 'api/editals/[id]/status.js',
  'api/admin/editals/index.js', 'api/admin/editals/[id].js',
  'api/questions/index.js', 'api/admin/questions/index.js', 'api/admin/questions/[id].js',
  'api/candidate.js',
  'supabase/migrations/001_multi_exam_foundation.sql', 'supabase/migrations/002_edital_engine.sql',
  'supabase/migrations/003_question_engine.sql', 'supabase/verify/003_question_engine_check.sql',
  'supabase/migrations/004_candidate_model.sql', 'supabase/verify/004_candidate_model_check.sql',
  'supabase/migrations/005_candidate_model_hardening.sql', 'supabase/verify/005_candidate_model_hardening_check.sql',
  'supabase/migrations/006_adaptive_engine.sql', 'supabase/verify/006_adaptive_engine_check.sql',
  'supabase/migrations/007_adaptive_engine_hardening.sql', 'supabase/verify/007_adaptive_engine_hardening_check.sql',
  'supabase/migrations/008_adaptive_planner.sql', 'supabase/verify/008_adaptive_planner_check.sql'
];

for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `Arquivo obrigatório ausente: ${file}`);
JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
for (const secret of ['SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']) {
  for (const file of fs.readdirSync(path.join(root, 'public')).filter(name => name.endsWith('.js'))) {
    assert.ok(!fs.readFileSync(path.join(root, 'public', file), 'utf8').includes(secret), `${secret} referenciado no frontend`);
  }
}
console.log(`Build estático validado: ${required.length} arquivos obrigatórios, configuração Vercel e isolamento de secrets.`);
