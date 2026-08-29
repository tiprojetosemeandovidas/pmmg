const sidebar = document.querySelector('#sidebar');
const modal = document.querySelector('#sessionModal');
const toast = document.querySelector('#toast');
const landing = document.querySelector('#landing');
const appShell = document.querySelector('#appShell');
let supabaseClient = null;
let currentAccessToken = null;
let currentDiagnosticSessionId = null;
const questionStartedAt = new Map();
const answerAttemptKeys = new Map();
let diagnosticCompleting = false;
let remoteReviews=[];
let errorNotebook = JSON.parse(localStorage.getItem('rota-error-notebook') || '[]');

async function connectSupabase() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) return;
    const { supabaseUrl, supabaseAnonKey } = await response.json();
    if (!supabaseUrl || !supabaseAnonKey || !window.supabase) return;
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    const { data: { session } } = await supabaseClient.auth.getSession();
    document.body.dataset.database = 'connected';
    if (session?.user) {
      currentAccessToken = session.access_token;
      hydrateProfile(session.user);
      await loadPublishedQuestions(session.access_token);
      await loadRecommendations();
      await loadPlan();
      await loadReviews();
      enterDashboard('inicio');
    }
  } catch {
    // O protótipo continua funcional quando executado sem backend local.
  }
}

function hydrateProfile(user) {
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Candidato';
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  document.querySelector('.profile b').textContent = name;
  document.querySelector('.avatar').textContent = initials;
}

function navigate(id) {
  const target = document.getElementById(id) || document.getElementById('inicio');
  document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page === target));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === target.id));
  sidebar.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function enterDashboard(page = 'inicio') {
  landing.hidden = true;
  appShell.hidden = false;
  history.replaceState(null, '', `#${page}`);
  navigate(page);
}

document.querySelectorAll('[data-page]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const page = link.dataset.page;
  history.replaceState(null, '', `#${page}`);
  navigate(page);
}));

document.querySelector('#menuButton').addEventListener('click', () => sidebar.classList.toggle('open'));
document.querySelector('#startSession').addEventListener('click', () => {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
});
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}));
modal.addEventListener('click', event => { if (event.target === modal) document.querySelector('[data-close]').click(); });
document.querySelector('#confirmSession').addEventListener('click', () => {
  document.querySelector('[data-close]').click();
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
});
document.querySelector('.dismiss').addEventListener('click', event => event.target.closest('.insight-card').remove());

function notify(title, message) {
  toast.querySelector('b').textContent = title;
  toast.querySelector('small').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}
document.querySelector('#notificationButton').addEventListener('click', () => notify('Você está em dia!', 'Nenhum alerta novo no seu plano.'));
document.querySelector('#adjustPlan').addEventListener('click', () => notify('Disponibilidade', 'A edição de horários estará disponível no onboarding.'));
let adaptiveRecommendations=[];
document.querySelector('#whyPriorities').addEventListener('click', () => notify('Por que esta prioridade?', adaptiveRecommendations[0]?.reason||'Responda ao diagnóstico para gerar prioridades baseadas no seu desempenho.'));

const studyDays = [
  ['18', 'Penal · 50 min'], ['19', 'Revisão · 25 min'], ['20', 'Português · 40 min'],
  ['21', 'Descanso'], ['22', 'Constitucional · 45 min'], ['23', 'Lógica · 35 min'], ['24', 'Simulado · 60 min']
];
document.querySelector('#calendar').innerHTML = studyDays.map(([day, task]) => `<div class="cal-day"><b>${day} AGO</b><i>${task}</i></div>`).join('');

const axes = [{name:'Linguagens',icon:'Aa'},{name:'Raciocínio Lógico',icon:'∑'},{name:'Direito',icon:'⚖'},{name:'Legislação Policial',icon:'◇'},{name:'Conhecimentos Gerais',icon:'◎'}];
let questions = [
  {axis:'Linguagens',exam:'Semelhante • CFSD 2007',difficulty:'Média',topic:'Interpretação textual',text:'Em um texto argumentativo, qual elemento apresenta de forma direta a posição defendida pelo autor?',options:['A tese central','A referência bibliográfica','O título da publicação','A descrição do suporte'],answer:0,explanation:'A tese é a ideia central que o autor sustenta por meio de argumentos.'},
  {axis:'Raciocínio Lógico',exam:'Semelhante • CFO 2010',difficulty:'Fácil',topic:'Proposições',text:'Se todo policial aprovado concluiu o curso e Ana foi aprovada, qual conclusão decorre necessariamente?',options:['Ana iniciou o curso','Ana concluiu o curso','Ana foi a primeira colocada','Ana concluiu outro concurso'],answer:1,explanation:'Aplicando a implicação apresentada, a aprovação de Ana permite concluir que ela concluiu o curso.'},
  {axis:'Direito',exam:'Semelhante • CFSD 2014',difficulty:'Média',topic:'Direitos fundamentais',text:'Segundo a Constituição Federal, a manifestação do pensamento é livre, sendo:',options:['Permitido o anonimato em qualquer hipótese','Vedado o anonimato','Exigida autorização prévia','Restrita aos agentes públicos'],answer:1,explanation:'O art. 5º, IV, assegura a livre manifestação do pensamento e veda o anonimato.'},
  {axis:'Legislação Policial',exam:'Semelhante • CFO 2018',difficulty:'Difícil',topic:'Ética e disciplina',text:'Em matéria disciplinar, a motivação de uma decisão administrativa serve principalmente para:',options:['Dispensar a apuração dos fatos','Demonstrar os fundamentos de fato e de direito','Substituir o direito de defesa','Manter o ato administrativo em sigilo'],answer:1,explanation:'A motivação explicita as razões fáticas e jurídicas da decisão e permite seu controle.'},
  {axis:'Conhecimentos Gerais',exam:'Semelhante • CFSD 2021',difficulty:'Fácil',topic:'Cidadania',text:'O exercício da cidadania em uma democracia inclui:',options:['Somente o voto obrigatório','Participação social e acompanhamento das políticas públicas','Apenas o exercício de cargo público','Renúncia ao debate de ideias'],answer:1,explanation:'Cidadania abrange participação social, fiscalização e exercício de direitos e deveres.'},
  {axis:'Direito',exam:'Semelhante • CFO 2025',difficulty:'Difícil',topic:'Administração pública',text:'O princípio que exige atuação administrativa sem favorecimentos pessoais é o da:',options:['Publicidade','Eficiência','Impessoalidade','Continuidade'],answer:2,explanation:'A impessoalidade orienta a Administração ao interesse público, sem favorecimento pessoal.'}
];
let filteredQuestions=[...questions], questionIndex=0, answered={};
questions.forEach(question=>{question.sourceType='manually_created'});
const axisStrip=document.querySelector('#axisStrip'), axisFilter=document.querySelector('#axisFilter'), examFilter=document.querySelector('#examFilter'), difficultyFilter=document.querySelector('#difficultyFilter'), shuffleQuestions=document.querySelector('#shuffleQuestions');
const questionCard=document.querySelector('#questionCard'), questionCount=document.querySelector('#questionCount'), questionPosition=document.querySelector('#questionPosition'), questionAxis=document.querySelector('#questionAxis'), questionDots=document.querySelector('#questionDots');
axes.forEach(axis=>{const count=questions.filter(q=>q.axis===axis.name).length;axisStrip.insertAdjacentHTML('beforeend',`<button class="axis-card" data-axis="${axis.name}"><span>${axis.icon}</span><b>${axis.name}</b><small>${count} questões demo</small></button>`);axisFilter.insertAdjacentHTML('beforeend',`<option value="${axis.name}">${axis.name}</option>`)});
[...new Set(questions.map(q=>q.exam))].forEach(exam=>examFilter.insertAdjacentHTML('beforeend',`<option value="${exam}">${exam}</option>`));
const shuffled=items=>[...items].sort(()=>Math.random()-.5);
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const sourceLabels={official_exam:'Questão oficial',licensed:'Conteúdo licenciado',public_source:'Fonte pública',ai_generated:'Gerada por IA',manually_created:'Questão autoral'};
async function loadRecommendations(refresh=false){if(!currentAccessToken)return;try{const response=await fetch('/api/recommendations?limit=4',{method:refresh?'POST':'GET',headers:{Authorization:`Bearer ${currentAccessToken}`}});if(!response.ok)return;const payload=await response.json();adaptiveRecommendations=payload.data;const list=document.querySelector('#adaptivePriorities');if(!adaptiveRecommendations.length){list.innerHTML='<div class="error-empty"><span>⌁</span><h3>Prioridades aguardando evidências</h3><p>Conclua o diagnóstico para ativar seu mapa adaptativo.</p></div>';return}const labels={learn:'Estudar a base',practice:'Resolver questões',review:'Revisar'};list.innerHTML=adaptiveRecommendations.map(item=>`<button class="priority-item" data-recommendation-rank="${item.rank}" title="${escapeHtml(item.reason)}"><div class="ring ${item.priorityScore>=65?'high':item.priorityScore>=40?'medium':'low'}"><span>${item.rank}</span></div><div><b>${escapeHtml(item.topic||item.subject)}</b><small>${labels[item.action]} · ${item.questionsAnswered} evidência${item.questionsAnswered===1?'':'s'}</small></div><strong>${Math.round(item.priorityScore)}</strong></button>`).join('');list.querySelectorAll('[data-recommendation-rank]').forEach(button=>button.addEventListener('click',()=>{const item=adaptiveRecommendations[Number(button.dataset.recommendationRank)-1];notify(`Prioridade ${item.rank}: ${item.topic}`,item.reason)}))}catch{notify('Prioridades indisponíveis','Não foi possível atualizar o motor adaptativo agora.')}}
async function loadPlan(generate=false){if(!currentAccessToken)return;try{let response=await fetch('/api/plan',{method:generate?'POST':'GET',headers:{Authorization:`Bearer ${currentAccessToken}`}});if(!response.ok)return;let payload=await response.json();if(!payload.data&&adaptiveRecommendations.length&&!generate){response=await fetch('/api/plan',{method:'POST',headers:{Authorization:`Bearer ${currentAccessToken}`}});if(!response.ok)return;payload=await response.json()}const plan=payload.data;if(!plan)return;const days=['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];document.querySelector('#adaptiveWeekPlan').innerHTML=plan.tasks.map(task=>{const date=new Date(`${task.scheduledDate}T12:00:00`);return `<button class="day ${task.status==='completed'?'done':''}" data-plan-task="${task.id}"><div class="date"><b>${date.getDate()}</b><span>${days[date.getDay()]}</span></div><span class="day-line"></span><div class="day-info"><b>${escapeHtml(task.topic||task.subject)}</b><small>${escapeHtml(task.subject)} · ${task.plannedMinutes} min</small></div><span class="status ${task.status==='planned'?'neutral':''}">${task.status==='completed'?'✓ Concluída':'Marcar concluída'}</span></button>`}).join('');document.querySelectorAll('[data-plan-task]').forEach(button=>button.addEventListener('click',async()=>{const response=await fetch(`/api/plan/tasks/${button.dataset.planTask}`,{method:'PATCH',headers:{Authorization:`Bearer ${currentAccessToken}`,'Content-Type':'application/json'},body:JSON.stringify({status:'completed'})});if(response.ok){await loadPlan();notify('Missão concluída','Seu plano semanal foi atualizado.')}}))}catch{notify('Plano indisponível','Não foi possível atualizar seu plano agora.')}}
async function loadReviews(){if(!currentAccessToken)return;try{const response=await fetch('/api/reviews',{headers:{Authorization:`Bearer ${currentAccessToken}`}});if(!response.ok)return;const payload=await response.json();remoteReviews=payload.data;renderErrorNotebook()}catch{notify('Revisões indisponíveis','Não foi possível carregar sua fila de revisões.')}}
function applyQuestionFilters(){filteredQuestions=questions.filter(q=>(axisFilter.value==='all'||q.axis===axisFilter.value)&&(examFilter.value==='all'||q.exam===examFilter.value)&&(difficultyFilter.value==='all'||q.difficulty===difficultyFilter.value));if(shuffleQuestions.checked)filteredQuestions=shuffled(filteredQuestions);questionIndex=0;answered={};renderQuestion();document.querySelectorAll('.axis-card').forEach(card=>card.classList.toggle('active',card.dataset.axis===axisFilter.value))}
function saveError(q){if(errorNotebook.some(item=>item.text===q.text))return;errorNotebook.unshift({text:q.text,axis:q.axis,topic:q.topic,nextReview:'Amanhã'});localStorage.setItem('rota-error-notebook',JSON.stringify(errorNotebook));renderErrorNotebook()}
async function submitDatabaseAnswer(q,choice){const attemptId=`${currentDiagnosticSessionId||'practice'}:${q.id}`;if(!answerAttemptKeys.has(attemptId))answerAttemptKeys.set(attemptId,crypto.randomUUID());const response=await fetch('/api/answers',{method:'POST',headers:{Authorization:`Bearer ${currentAccessToken}`,'Content-Type':'application/json'},body:JSON.stringify({questionId:q.id,selectedOption:choice,idempotencyKey:answerAttemptKeys.get(attemptId),responseTimeMs:Math.min(Date.now()-(questionStartedAt.get(q.id)||Date.now()),3600000),diagnosticSessionId:currentDiagnosticSessionId})});if(!response.ok)throw new Error('answer_failed');const payload=await response.json();q.answer=payload.data.correctOption;q.explanation=payload.data.explanation||'Resposta registrada e domínio atualizado.';return payload.data}
async function completeCurrentDiagnostic(){if(!currentDiagnosticSessionId||diagnosticCompleting)return;const answeredCount=Object.keys(answered).length;if(answeredCount<filteredQuestions.length)return;diagnosticCompleting=true;try{const response=await fetch(`/api/diagnostics/${currentDiagnosticSessionId}/complete`,{method:'POST',headers:{Authorization:`Bearer ${currentAccessToken}`}});if(!response.ok)throw new Error('completion_failed');const payload=await response.json();const result=payload.data.result;currentDiagnosticSessionId=null;await loadRecommendations(true);await loadPlan(true);await loadReviews();notify(`Diagnóstico concluído: ${Math.round(result.score)}%`,adaptiveRecommendations.length?`Sua prioridade agora é ${adaptiveRecommendations[0].topic||adaptiveRecommendations[0].subject}.`:'Seu domínio será refinado nas próximas sessões.')}catch{notify('Diagnóstico pendente','Sua resposta foi salva; tente concluir novamente após a última questão.')}finally{diagnosticCompleting=false}}
function renderQuestion(){questionCount.textContent=filteredQuestions.length;if(!filteredQuestions.length){questionCard.innerHTML='<div class="no-questions"><h2>Nenhuma questão encontrada</h2><p>Altere os filtros para começar uma nova seleção.</p></div>';questionPosition.textContent='SEM RESULTADOS';questionAxis.textContent='—';questionDots.innerHTML='';return}const q=filteredQuestions[questionIndex],picked=answered[questionIndex],hasKey=Number.isInteger(q.answer),sourceLabel=sourceLabels[q.sourceType]||'Origem identificada';if(q.id&&!questionStartedAt.has(q.id))questionStartedAt.set(q.id,Date.now());questionPosition.textContent=`QUESTÃO ${questionIndex+1} DE ${filteredQuestions.length}`;questionAxis.textContent=q.axis;questionCard.innerHTML=`<div class="question-tags"><span>${escapeHtml(q.exam)}</span><span>${escapeHtml(q.topic)}</span><span>${escapeHtml(q.difficulty)}</span><span class="question-origin ${q.sourceType==='ai_generated'?'ai-origin':''}">${escapeHtml(sourceLabel)}</span></div><h2>${escapeHtml(q.text)}</h2><div class="alternatives">${q.options.map((option,i)=>`<button class="alternative ${picked===i?'selected':''} ${hasKey&&picked!==undefined&&i===q.answer?'correct':''} ${hasKey&&picked===i&&i!==q.answer?'wrong':''}" data-option="${i}"><i>${String.fromCharCode(65+i)}</i>${escapeHtml(option)}</button>`).join('')}</div>${picked!==undefined?(hasKey?`<div class="explanation"><b>${picked===q.answer?'Resposta correta.':'Resposta incorreta.'}</b> ${escapeHtml(q.explanation)}<div class="answer-tools"><button data-question-action="favorite">☆ Favoritar</button><button data-question-action="note">＋ Anotação</button><button data-question-action="ai">✦ Perguntar à IA</button></div></div>`:`<div class="explanation pending-answer"><b>Resposta sendo registrada.</b> Aguarde a correção segura da plataforma.</div>`):''}${q.sourceUrl?`<a class="question-source-link" href="${escapeHtml(q.sourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir fonte registrada ↗</a>`:''}`;questionCard.querySelectorAll('.alternative').forEach(button=>button.addEventListener('click',async()=>{if(answered[questionIndex]!==undefined)return;const choice=Number(button.dataset.option);answered[questionIndex]=choice;renderQuestion();try{if(q.kind==='database'&&currentAccessToken){const result=await submitDatabaseAnswer(q,choice);if(!result.correct)saveError(q);await completeCurrentDiagnostic()}else if(hasKey&&choice!==q.answer)saveError(q)}catch{delete answered[questionIndex];notify('Resposta não registrada','Verifique sua conexão e tente novamente.')}renderQuestion()}));questionCard.querySelectorAll('[data-question-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.questionAction;notify(action==='ai'?'Tutor IA com fontes':action==='note'?'Anotação adicionada':'Questão favoritada',action==='ai'?'A explicação detalhada será ancorada na fonte oficial indicada.':'Salvo para você revisar depois.')}));questionDots.innerHTML=filteredQuestions.slice(0,50).map((_,i)=>`<i class="${i===questionIndex?'active':''}"></i>`).join('')}
axisStrip.addEventListener('click',event=>{const card=event.target.closest('.axis-card');if(card){axisFilter.value=card.dataset.axis;applyQuestionFilters()}});
[axisFilter,examFilter,difficultyFilter].forEach(select=>select.addEventListener('change',applyQuestionFilters));
document.querySelector('#newRound').addEventListener('click',applyQuestionFilters);
document.querySelector('#clearFilters').addEventListener('click',()=>{axisFilter.value=examFilter.value=difficultyFilter.value='all';applyQuestionFilters()});
document.querySelector('#nextQuestion').addEventListener('click',()=>{if(filteredQuestions.length){questionIndex=(questionIndex+1)%filteredQuestions.length;renderQuestion()}});
document.querySelector('#previousQuestion').addEventListener('click',()=>{if(filteredQuestions.length){questionIndex=(questionIndex-1+filteredQuestions.length)%filteredQuestions.length;renderQuestion()}});
renderQuestion();

let examCatalog=[];
function renderArchive(career='all'){const selected=career==='all'?examCatalog:examCatalog.filter(exam=>exam.career===career);document.querySelector('#archiveCount').textContent=`${selected.length} provas`;document.querySelector('#archiveList').innerHTML=selected.sort((a,b)=>b.year-a.year).map(exam=>{const folder=exam.career==='CFSD'?'cfsd':'cfo';return `<a class="archive-item" href="provas/${folder}/${exam.file}" target="_blank"><span>PDF</span><div><b>${exam.career} ${exam.year}</b><small>${exam.questionCount} questões extraídas</small></div><i>↗</i></a>`}).join('')}
function refreshQuestionFilters(){examFilter.innerHTML='<option value="all">Todos os concursos</option>';[...new Set(questions.map(q=>q.exam))].sort().forEach(exam=>examFilter.insertAdjacentHTML('beforeend',`<option value="${escapeHtml(exam)}">${escapeHtml(exam)}</option>`));axes.forEach(axis=>{const card=document.querySelector(`[data-axis="${axis.name}"] small`);if(card)card.textContent=`${questions.filter(q=>q.axis===axis.name).length} questões`});applyQuestionFilters()}
async function loadQuestionArchive(){try{const [questionResponse,examResponse]=await Promise.all([fetch('data/questions.json'),fetch('data/exams.json')]);const imported=await questionResponse.json();examCatalog=await examResponse.json();questions.push(...imported.map(q=>({axis:q.axis,exam:`${q.career} ${q.year}`,difficulty:'Oficial',topic:`Questão ${q.number}`,text:q.statement,options:q.options,answer:null,explanation:'',sourceUrl:`provas/${q.career==='CFSD'?'cfsd':'cfo'}/${q.sourcePdf}`,sourceType:'official_exam',kind:'archive-pending'})));refreshQuestionFilters();renderArchive()}catch(error){console.warn('Arquivo de provas indisponível',error)}}
async function loadPublishedQuestions(accessToken){try{const response=await fetch('/api/questions?limit=100',{headers:{Authorization:`Bearer ${accessToken}`}});if(!response.ok)return;const payload=await response.json();if(!payload.data.length)return;questions=questions.filter(q=>q.kind!=='archive-pending');questions.push(...payload.data.map(q=>{const source=q.sources[0]||{};return{id:q.id,axis:q.axis||q.subject,exam:source.name||'Concurso',difficulty:({easy:'Fácil',medium:'Média',hard:'Difícil'})[q.difficulty]||'Não classificada',topic:q.topic||q.subject,text:q.statement,options:q.options.map(option=>option.content),answer:null,explanation:'',sourceUrl:source.url,sourceType:q.sourceType,kind:'database'}}));refreshQuestionFilters()}catch(error){console.warn('Question Engine indisponível',error)}}
document.querySelectorAll('.archive-filters button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.archive-filters button').forEach(item=>item.classList.remove('active'));button.classList.add('active');renderArchive(button.dataset.career)}));
document.querySelector('#startSimulation').addEventListener('click',()=>{filteredQuestions=shuffled(questions.filter(q=>Number.isInteger(q.answer))).slice(0,20);questionIndex=0;answered={};renderQuestion();navigate('questoes');notify('Simulado criado','Questões autorais semelhantes foram misturadas em ordem aleatória.')});
loadQuestionArchive();

function renderErrorNotebook(){const list=document.querySelector('#errorList');if(!list)return;const items=currentAccessToken?remoteReviews:errorNotebook;document.querySelector('#errorTotal').textContent=items.length;list.innerHTML=items.length?items.map(item=>`<article class="error-item"><span>↻</span><div><b>${escapeHtml(item.topic)}${item.subject?' • '+escapeHtml(item.subject):' • '+escapeHtml(item.axis)}</b><small>${escapeHtml((item.statement||item.text).slice(0,90))}${(item.statement||item.text).length>90?'…':''}</small></div><em>${item.due?'Revisar agora':item.dueAt?'Agendada':'Revisar '+item.nextReview.toLowerCase()}</em></article>`).join(''):'<div class="error-empty"><span>✓</span><h3>Seu caderno está limpo</h3><p>Quando você errar uma questão, ela aparecerá aqui automaticamente.</p></div>'}
renderErrorNotebook();

const diagnosisModal=document.querySelector('#diagnosisModal');let diagnosisStep=1;
const loginModal=document.querySelector('#loginModal');
function openLogin(message){loginModal.classList.add('open');loginModal.setAttribute('aria-hidden','false');if(message)document.querySelector('#loginMessage').textContent=message}
async function startDiagnosticSession(questionCount){if(!currentAccessToken)return null;const response=await fetch('/api/diagnostics',{method:'POST',headers:{Authorization:`Bearer ${currentAccessToken}`,'Content-Type':'application/json'},body:JSON.stringify({questionCount})});if(!response.ok)throw new Error('diagnostic_failed');const payload=await response.json();return payload.data.id}
function showDiagnosisStep(step){diagnosisStep=step;document.querySelectorAll('.diagnosis-step').forEach(item=>item.classList.toggle('active',Number(item.dataset.step)===step));document.querySelector('#diagnosisBar').style.width=`${step*33.333}%`;document.querySelector('#diagnosisStepLabel').textContent=`DIAGNÓSTICO • ETAPA ${step} DE 3`;document.querySelector('#diagnosisBack').style.visibility=step===1?'hidden':'visible';document.querySelector('#diagnosisNext').textContent=step===3?'Começar diagnóstico →':'Continuar →'}
document.querySelectorAll('[data-start-diagnosis]').forEach(button=>button.addEventListener('click',()=>{if(!currentAccessToken){openLogin('Entre para salvar o diagnóstico e gerar seu plano personalizado.');return}diagnosisModal.classList.add('open');diagnosisModal.setAttribute('aria-hidden','false');showDiagnosisStep(1)}));
document.querySelectorAll('[data-enter-dashboard]').forEach(button=>button.addEventListener('click',event=>{if(!currentAccessToken){event.preventDefault();openLogin();return}enterDashboard()}));
document.querySelector('#closeLogin').addEventListener('click',()=>{loginModal.classList.remove('open');loginModal.setAttribute('aria-hidden','true')});
document.querySelector('#loginForm').addEventListener('submit',async event=>{event.preventDefault();const email=document.querySelector('#loginEmail').value.trim();const message=document.querySelector('#loginMessage');if(!supabaseClient){message.textContent='Conexão ainda não disponível. Aguarde alguns segundos e tente novamente.';return}message.textContent='Enviando link seguro…';const {error}=await supabaseClient.auth.signInWithOtp({email,options:{emailRedirectTo:'https://rota-pmmg.vercel.app/'}});message.textContent=error?'Não foi possível enviar. Confira o e-mail e tente novamente.':'Link enviado. Abra seu e-mail para entrar na plataforma.'});
document.querySelector('#closeDiagnosis').addEventListener('click',()=>diagnosisModal.classList.remove('open'));
document.querySelector('#diagnosisBack').addEventListener('click',()=>showDiagnosisStep(Math.max(1,diagnosisStep-1)));
document.querySelector('#diagnosisNext').addEventListener('click',async()=>{if(diagnosisStep<3){showDiagnosisStep(diagnosisStep+1);return}const pool=questions.filter(q=>q.kind==='database').slice(0,20);if(pool.length<5){notify('Diagnóstico em preparação','Ainda não há questões validadas suficientes para iniciar.');return}try{currentDiagnosticSessionId=await startDiagnosticSession(pool.length)}catch{notify('Diagnóstico indisponível','Entre novamente e tente iniciar o diagnóstico.');return}diagnosisModal.classList.remove('open');enterDashboard('questoes');filteredQuestions=shuffled(pool);questionIndex=0;answered={};renderQuestion();notify('Diagnóstico iniciado',`Responda às ${pool.length} questões para calcular seu nível.`)});
document.querySelector('#hoursRange').addEventListener('input',event=>document.querySelector('#hoursOutput').textContent=`${event.target.value} horas`);
document.querySelector('#startReview').addEventListener('click',async()=>{if(currentAccessToken&&remoteReviews.length){const response=await fetch(`/api/reviews/${remoteReviews[0].id}/advance`,{method:'POST',headers:{Authorization:`Bearer ${currentAccessToken}`}});if(response.ok){notify('Revisão registrada','Próxima revisão recalculada pela sequência 1, 7, 15 e 30 dias.');await loadReviews()}return}if(errorNotebook.length)notify('Revisão iniciada','Começando pelas questões com revisão vencida.');else notify('Tudo revisado','Não há questões pendentes no seu caderno.')});
document.querySelector('#addTafResult').addEventListener('click',()=>notify('Resultado de TAF','O registro de uma nova medição será liberado no próximo passo do piloto.'));

const initialHash=location.hash.slice(1);
const appPages=new Set(['inicio','plano','desempenho','radar','questoes','erros','simulados','taf','edital','ajuda']);
if(appPages.has(initialHash)){enterDashboard(initialHash)}
connectSupabase();
