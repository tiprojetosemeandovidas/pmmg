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

navigate(location.hash.slice(1) || 'inicio');
connectSupabase();
