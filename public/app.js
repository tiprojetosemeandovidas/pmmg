const sidebar = document.querySelector('#sidebar');
const modal = document.querySelector('#sessionModal');
const toast = document.querySelector('#toast');
let supabaseClient = null;

async function connectSupabase() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) return;
    const { supabaseUrl, supabaseAnonKey } = await response.json();
    if (!supabaseUrl || !supabaseAnonKey || !window.supabase) return;
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    const { data: { session } } = await supabaseClient.auth.getSession();
    document.body.dataset.database = 'connected';
    if (session?.user) hydrateProfile(session.user);
  } catch (_) {
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
document.querySelector('#whyPriorities').addEventListener('click', () => notify('Prioridades explicáveis', 'Calculadas por peso no edital, domínio e tempo até a prova.'));

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
const axisStrip=document.querySelector('#axisStrip'), axisFilter=document.querySelector('#axisFilter'), examFilter=document.querySelector('#examFilter'), difficultyFilter=document.querySelector('#difficultyFilter'), shuffleQuestions=document.querySelector('#shuffleQuestions');
const questionCard=document.querySelector('#questionCard'), questionCount=document.querySelector('#questionCount'), questionPosition=document.querySelector('#questionPosition'), questionAxis=document.querySelector('#questionAxis'), questionDots=document.querySelector('#questionDots');
axes.forEach(axis=>{const count=questions.filter(q=>q.axis===axis.name).length;axisStrip.insertAdjacentHTML('beforeend',`<button class="axis-card" data-axis="${axis.name}"><span>${axis.icon}</span><b>${axis.name}</b><small>${count} questões demo</small></button>`);axisFilter.insertAdjacentHTML('beforeend',`<option value="${axis.name}">${axis.name}</option>`)});
[...new Set(questions.map(q=>q.exam))].forEach(exam=>examFilter.insertAdjacentHTML('beforeend',`<option value="${exam}">${exam}</option>`));
const shuffled=items=>[...items].sort(()=>Math.random()-.5);
function applyQuestionFilters(){filteredQuestions=questions.filter(q=>(axisFilter.value==='all'||q.axis===axisFilter.value)&&(examFilter.value==='all'||q.exam===examFilter.value)&&(difficultyFilter.value==='all'||q.difficulty===difficultyFilter.value));if(shuffleQuestions.checked)filteredQuestions=shuffled(filteredQuestions);questionIndex=0;answered={};renderQuestion();document.querySelectorAll('.axis-card').forEach(card=>card.classList.toggle('active',card.dataset.axis===axisFilter.value))}
function renderQuestion(){questionCount.textContent=filteredQuestions.length;if(!filteredQuestions.length){questionCard.innerHTML='<div class="no-questions"><h2>Nenhuma questão encontrada</h2><p>Altere os filtros para começar uma nova seleção.</p></div>';questionPosition.textContent='SEM RESULTADOS';questionAxis.textContent='—';questionDots.innerHTML='';return}const q=filteredQuestions[questionIndex],picked=answered[questionIndex],hasKey=Number.isInteger(q.answer);questionPosition.textContent=`QUESTÃO ${questionIndex+1} DE ${filteredQuestions.length}`;questionAxis.textContent=q.axis;questionCard.innerHTML=`<div class="question-tags"><span>${q.exam}</span><span>${q.topic}</span><span>${q.difficulty}</span></div><h2>${q.text}</h2><div class="alternatives">${q.options.map((option,i)=>`<button class="alternative ${picked===i?'selected':''} ${hasKey&&picked!==undefined&&i===q.answer?'correct':''} ${hasKey&&picked===i&&i!==q.answer?'wrong':''}" data-option="${i}"><i>${String.fromCharCode(65+i)}</i>${option}</button>`).join('')}</div>${picked!==undefined?(hasKey?`<div class="explanation"><b>${picked===q.answer?'Resposta correta.':'Resposta incorreta.'}</b> ${q.explanation}</div>`:`<div class="explanation pending-answer"><b>Gabarito pendente de revisão.</b> Consulte o caderno e o gabarito original antes de contabilizar esta resposta.</div>`):''}${q.sourceUrl?`<a class="question-source-link" href="${q.sourceUrl}" target="_blank">Abrir caderno original ↗</a>`:''}`;questionCard.querySelectorAll('.alternative').forEach(button=>button.addEventListener('click',()=>{if(answered[questionIndex]===undefined){answered[questionIndex]=Number(button.dataset.option);renderQuestion()}}));questionDots.innerHTML=filteredQuestions.slice(0,50).map((_,i)=>`<i class="${i===questionIndex?'active':''}"></i>`).join('')}
axisStrip.addEventListener('click',event=>{const card=event.target.closest('.axis-card');if(card){axisFilter.value=card.dataset.axis;applyQuestionFilters()}});
[axisFilter,examFilter,difficultyFilter].forEach(select=>select.addEventListener('change',applyQuestionFilters));
document.querySelector('#newRound').addEventListener('click',applyQuestionFilters);
document.querySelector('#clearFilters').addEventListener('click',()=>{axisFilter.value=examFilter.value=difficultyFilter.value='all';applyQuestionFilters()});
document.querySelector('#nextQuestion').addEventListener('click',()=>{if(filteredQuestions.length){questionIndex=(questionIndex+1)%filteredQuestions.length;renderQuestion()}});
document.querySelector('#previousQuestion').addEventListener('click',()=>{if(filteredQuestions.length){questionIndex=(questionIndex-1+filteredQuestions.length)%filteredQuestions.length;renderQuestion()}});
renderQuestion();

let examCatalog=[];
function renderArchive(career='all'){const selected=career==='all'?examCatalog:examCatalog.filter(exam=>exam.career===career);document.querySelector('#archiveCount').textContent=`${selected.length} provas`;document.querySelector('#archiveList').innerHTML=selected.sort((a,b)=>b.year-a.year).map(exam=>{const folder=exam.career==='CFSD'?'cfsd':'cfo';return `<a class="archive-item" href="provas/${folder}/${exam.file}" target="_blank"><span>PDF</span><div><b>${exam.career} ${exam.year}</b><small>${exam.questionCount} questões extraídas</small></div><i>↗</i></a>`}).join('')}
async function loadQuestionArchive(){try{const [questionResponse,examResponse]=await Promise.all([fetch('data/questions.json'),fetch('data/exams.json')]);const imported=await questionResponse.json();examCatalog=await examResponse.json();questions.push(...imported.map(q=>({axis:q.axis,exam:`${q.career} ${q.year}`,difficulty:'Oficial',topic:`Questão ${q.number}`,text:q.statement,options:q.options,answer:null,explanation:'',sourceUrl:`provas/${q.career==='CFSD'?'cfsd':'cfo'}/${q.sourcePdf}`,kind:'official'})));examFilter.innerHTML='<option value="all">Todos os concursos</option>';[...new Set(questions.map(q=>q.exam))].sort().forEach(exam=>examFilter.insertAdjacentHTML('beforeend',`<option value="${exam}">${exam}</option>`));axes.forEach(axis=>{const card=document.querySelector(`[data-axis="${axis.name}"] small`);if(card)card.textContent=`${questions.filter(q=>q.axis===axis.name).length} questões`});renderArchive();applyQuestionFilters()}catch(error){console.warn('Arquivo de provas indisponível',error)}}
document.querySelectorAll('.archive-filters button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.archive-filters button').forEach(item=>item.classList.remove('active'));button.classList.add('active');renderArchive(button.dataset.career)}));
document.querySelector('#startSimulation').addEventListener('click',()=>{filteredQuestions=shuffled(questions.filter(q=>Number.isInteger(q.answer))).slice(0,20);questionIndex=0;answered={};renderQuestion();navigate('questoes');notify('Simulado criado','Questões autorais semelhantes foram misturadas em ordem aleatória.')});
loadQuestionArchive();

navigate(location.hash.slice(1) || 'inicio');
connectSupabase();
