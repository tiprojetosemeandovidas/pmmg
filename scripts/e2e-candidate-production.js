const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const appUrl = process.env.E2E_APP_URL || 'https://rota-pmmg.vercel.app';
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !serviceKey || !anonKey) throw new Error('Credenciais Supabase ausentes.');

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function main() {
  const email = `e2e-${crypto.randomUUID()}@rota-pmmg.internal`;
  const password = crypto.randomBytes(24).toString('base64url');
  let userId;
  try {
    const created = await json(`${supabaseUrl}/auth/v1/admin/users`, { method: 'POST', headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json'
    }, body: JSON.stringify({ email, password, email_confirm: true }) });
    assert.equal(created.status, 200);
    userId = created.body.id;

    const login = await json(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: 'POST', headers: {
      apikey: anonKey, 'Content-Type': 'application/json'
    }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200);
    const auth = { Authorization: `Bearer ${login.body.access_token}`, 'Content-Type': 'application/json' };

    const questions = await json(`${appUrl}/api/questions?limit=10`, { headers: auth });
    assert.equal(questions.status, 200);
    assert.ok(questions.body.data.length >= 5);
    const pool = questions.body.data.slice(0, 5);

    const diagnostic = await json(`${appUrl}/api/diagnostics`, { method: 'POST', headers: auth,
      body: JSON.stringify({ questionCount: 5 }) });
    assert.equal(diagnostic.status, 201);
    const sessionId = diagnostic.body.data.id;

    const incomplete = await json(`${appUrl}/api/diagnostics/${sessionId}/complete`, { method: 'POST', headers: auth });
    assert.equal(incomplete.status, 409);
    assert.equal(incomplete.body.error.code, 'diagnostic_incomplete');

    const firstKey = crypto.randomUUID();
    const submit = (question, key) => json(`${appUrl}/api/answers`, { method: 'POST', headers: auth, body: JSON.stringify({
      questionId: question.id, selectedOption: 0, idempotencyKey: key,
      responseTimeMs: 1000, diagnosticSessionId: sessionId
    }) });
    const first = await submit(pool[0], firstKey);
    assert.equal(first.status, 201);
    const retry = await submit(pool[0], firstKey);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.data.alreadyRecorded, true);
    const conflict = await submit(pool[1], firstKey);
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, 'idempotency_conflict');
    assert.equal(JSON.stringify(conflict.body).includes('correctOption'), false);

    const duplicate = await submit(pool[0], crypto.randomUUID());
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'diagnostic_question_already_answered');
    for (const question of pool.slice(1)) assert.equal((await submit(question, crypto.randomUUID())).status, 201);

    const mastery = await json(`${appUrl}/api/candidate/mastery`, { headers: auth });
    assert.equal(mastery.status, 200);
    assert.equal(mastery.body.summary.evidenceCount, 5);
    const completed = await json(`${appUrl}/api/diagnostics/${sessionId}/complete`, { method: 'POST', headers: auth });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.result.answeredCount, 5);
    process.stdout.write('E2E produção aprovado: catálogo, diagnóstico, idempotência, domínio e conclusão.\n');
  } finally {
    if (userId) await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`
    } });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
