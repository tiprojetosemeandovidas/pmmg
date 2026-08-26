'use strict';

function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw Object.assign(new Error('Supabase server-side não configurado.'), { status: 503, code: 'service_unavailable' });
  return { url, serviceKey };
}

async function parse(response) {
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 300) }; }
  }
  if (!response.ok) {
    const message = data && (data.message || data.msg || data.error_description) || 'Falha no Supabase.';
    throw Object.assign(new Error(message), { status: response.status, code: 'supabase_error', details: data });
  }
  return data;
}

async function authenticate(request) {
  const authorization = request.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('Faça login para continuar.'), { status: 401, code: 'authentication_required' });
  const { url, serviceKey } = config();
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: authorization } });
  const user = await parse(response);
  if (!user || !user.id) throw Object.assign(new Error('Sessão inválida.'), { status: 401, code: 'invalid_session' });
  return user;
}

async function authenticateReviewer(request) {
  const user = await authenticate(request);
  const roles = await rest(`user_roles?user_id=eq.${encodeURIComponent(user.id)}&role=in.(admin,content_reviewer)&select=role`);
  if (!roles.length) throw Object.assign(new Error('Acesso restrito à revisão de conteúdo.'), { status: 403, code: 'forbidden' });
  return user;
}

async function rest(path, options = {}) {
  const { url, serviceKey } = config();
  const headers = Object.assign({ apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, options.headers);
  const response = await fetch(`${url}/rest/v1/${path}`, Object.assign({}, options, { headers }));
  return parse(response);
}

async function createSignedUpload(path) {
  const { url, serviceKey } = config();
  const response = await fetch(`${url}/storage/v1/object/upload/sign/editais-private/${path}`, {
    method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: '{}'
  });
  return parse(response);
}

async function downloadPdf(path) {
  const { url, serviceKey } = config();
  const response = await fetch(`${url}/storage/v1/object/editais-private/${path}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (!response.ok) throw Object.assign(new Error('Arquivo do edital não encontrado.'), { status: response.status, code: 'file_not_found' });
  return Buffer.from(await response.arrayBuffer());
}

async function removePdf(path) {
  const { url, serviceKey } = config();
  await fetch(`${url}/storage/v1/object/editais-private/${path}`, {
    method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
}

module.exports = { authenticate, authenticateReviewer, createSignedUpload, downloadPdf, removePdf, rest };
