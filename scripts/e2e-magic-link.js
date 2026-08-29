'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('Credenciais Supabase ausentes.');
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

async function main() {
  const email = `magic-${crypto.randomUUID()}@rota-pmmg.internal`;
  let userId;
  try {
    const created = await fetch(`${supabaseUrl}/auth/v1/admin/users`, { method: 'POST', headers,
      body: JSON.stringify({ email, email_confirm: true, password: crypto.randomBytes(24).toString('base64url') }) });
    assert.equal(created.status, 200);
    userId = (await created.json()).id;
    const generated = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, { method: 'POST', headers,
      body: JSON.stringify({ type: 'magiclink', email, options: { redirectTo: 'https://rota-pmmg.vercel.app/' } }) });
    assert.equal(generated.status, 200);
    const payload = await generated.json();
    assert.ok(payload.action_link);
    const verified = await fetch(payload.action_link, { redirect: 'manual' });
    assert.ok([302, 303].includes(verified.status));
    const location = verified.headers.get('location');
    const redirect = new URL(location);
    process.stdout.write(`Redirecionamento observado: ${redirect.origin}${redirect.pathname} (${verified.status}).\n`);
    assert.equal(redirect.origin, 'https://rota-pmmg.vercel.app');
    assert.equal(location.includes('error=access_denied'), false);
    process.stdout.write('Link mágico aprovado: token válido e redirecionamento para rota-pmmg.vercel.app.\n');
  } finally {
    if (userId) await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
