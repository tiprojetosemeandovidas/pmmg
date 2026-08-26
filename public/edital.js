'use strict';

const states = ['loadingState', 'configErrorState', 'loginState', 'workspaceState', 'processingState', 'errorState', 'resultState'];
let client;
let session;
let selectedFile;

const byId = id => document.getElementById(id);
const show = id => states.forEach(state => { byId(state).hidden = state !== id; });
const authHeaders = () => ({ Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' });

async function api(path, options = {}) {
  const response = await fetch(path, Object.assign({}, options, { headers: Object.assign({}, authHeaders(), options.headers) }));
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'O serviço não respondeu como esperado.');
  return payload;
}

function humanSize(bytes) { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value == null ? 'Não informado' : String(value); return element.innerHTML; }

async function loadNotices() {
  const select = byId('existingNotices');
  select.innerHTML = '<option value="">Selecione uma análise existente</option>';
  try {
    const payload = await api('/api/editals');
    payload.data.forEach(notice => select.insertAdjacentHTML('beforeend', `<option value="${notice.id}">${escapeHtml(notice.file_name)} • ${escapeHtml(notice.status)}</option>`));
  } catch (error) {
    select.innerHTML = '<option value="">Análises anteriores indisponíveis</option>';
  }
}

function chooseFile(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) return fail('Selecione um arquivo PDF válido.');
  if (file.size > 10 * 1024 * 1024) return fail('O arquivo excede o limite de 10 MB.');
  selectedFile = file;
  byId('selectedFile').hidden = false;
  byId('selectedFile').querySelector('b').textContent = file.name;
  byId('selectedFile').querySelector('small').textContent = humanSize(file.size);
  byId('analyzeButton').disabled = false;
}

function clearFile() {
  selectedFile = null; byId('noticeFile').value = ''; byId('selectedFile').hidden = true; byId('analyzeButton').disabled = true;
}

function fail(message) { byId('errorMessage').textContent = message; show('errorState'); }

function renderResult(notice) {
  const data = notice.extractedData || notice.extracted_data;
  if (!data) return fail('Esta análise ainda não possui dados extraídos.');
  byId('resultTitle').textContent = [data.orgao, data.cargo].filter(Boolean).join(' — ') || 'Edital analisado';
  const topicCount = (data.disciplinas || []).reduce((total, subject) => total + subject.topicos.length, 0);
  byId('resultMetrics').innerHTML = [
    [data.banca || 'Não informada', 'Banca'],
    [String((data.disciplinas || []).length), 'Disciplinas'],
    [String(topicCount), 'Tópicos'],
    [data.numero_vagas == null ? 'Não informado' : String(data.numero_vagas), 'Vagas'],
    [data.data_prova || 'Não informada', 'Data da prova'],
    [`${Math.round((data.confianca_geral || 0) * 100)}%`, 'Confiança da extração']
  ].map(([value, label]) => `<article><b>${escapeHtml(value)}</b><small>${label}</small></article>`).join('');
  byId('subjectResults').innerHTML = (data.disciplinas || []).map(subject => `<article class="subject-result"><b>${escapeHtml(subject.nome)}</b><span>${subject.quantidade_questoes == null ? 'quantidade não informada' : `${subject.quantidade_questoes} questões`}</span><p>${subject.topicos.map(escapeHtml).join(' • ') || 'Nenhum tópico identificado'}</p></article>`).join('') || '<p>Nenhuma disciplina identificada.</p>';
  byId('stageResults').innerHTML = (data.etapas || []).map(stage => `<span>${escapeHtml(stage.nome)}</span>`).join('') || '<span>Nenhuma etapa identificada</span>';
  const alerts = data.alertas_revisao || [];
  byId('reviewAlerts').hidden = !alerts.length;
  byId('reviewAlerts').innerHTML = alerts.length ? `<b>Pontos para revisão:</b> ${alerts.map(escapeHtml).join(' • ')}` : '';
  show('resultState');
}

async function analyze() {
  if (!selectedFile) return;
  show('processingState');
  try {
    const prepared = await api('/api/editals/upload-url', { method: 'POST', body: JSON.stringify({ fileName: selectedFile.name, mimeType: selectedFile.type, size: selectedFile.size }) });
    const { error: storageError } = await client.storage.from('editais-private').uploadToSignedUrl(prepared.data.path, prepared.data.token, selectedFile, { contentType: 'application/pdf' });
    if (storageError) throw storageError;
    const uploaded = await api('/api/editals/upload', { method: 'POST', body: JSON.stringify({ storagePath: prepared.data.path, fileName: selectedFile.name, mimeType: selectedFile.type, size: selectedFile.size }) });
    byId('processingTitle').textContent = 'Entendendo seu edital';
    byId('processingMessage').textContent = 'Identificando regras, datas, disciplinas, tópicos e etapas.';
    const extracted = await api(`/api/editals/${uploaded.data.id}/extract`, { method: 'POST', body: '{}' });
    renderResult(extracted.data);
  } catch (error) { fail(error.message); }
}

async function start() {
  try {
    const response = await fetch('/api/config'); const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) return show('configErrorState');
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    ({ data: { session } } = await client.auth.getSession());
    if (!session) return show('loginState');
    show('workspaceState'); await loadNotices();
  } catch (_) { show('configErrorState'); }
}

byId('loginState').addEventListener('submit', async event => {
  event.preventDefault(); byId('loginFeedback').textContent = 'Enviando…';
  const { error } = await client.auth.signInWithOtp({ email: byId('loginEmail').value, options: { emailRedirectTo: location.href } });
  byId('loginFeedback').textContent = error ? error.message : 'Confira sua caixa de entrada para acessar.';
});
byId('signOutButton').addEventListener('click', async () => { await client.auth.signOut(); session = null; show('loginState'); });
byId('noticeFile').addEventListener('change', event => chooseFile(event.target.files[0]));
byId('clearFile').addEventListener('click', clearFile);
byId('analyzeButton').addEventListener('click', analyze);
byId('retryButton').addEventListener('click', () => show(session ? 'workspaceState' : 'loginState'));
byId('newAnalysisButton').addEventListener('click', () => { clearFile(); show('workspaceState'); loadNotices(); });
byId('existingNotices').addEventListener('change', async event => { if (!event.target.value) return; show('processingState'); try { const payload = await api(`/api/editals/${event.target.value}`); renderResult(payload.data); } catch (error) { fail(error.message); } });
for (const eventName of ['dragenter', 'dragover']) byId('dropZone').addEventListener(eventName, event => { event.preventDefault(); byId('dropZone').classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) byId('dropZone').addEventListener(eventName, event => { event.preventDefault(); byId('dropZone').classList.remove('dragging'); if (eventName === 'drop') chooseFile(event.dataTransfer.files[0]); });
start();
