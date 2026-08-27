const crypto = require('node:crypto');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const body = await response.text();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body}`);
  return body ? JSON.parse(body) : null;
}
async function upsert(table, row, conflict) {
  const result = await request(`/rest/v1/${table}?on_conflict=${conflict}&select=*`, {
    method: 'POST', body: JSON.stringify(row), headers: { Prefer: 'resolution=merge-duplicates,return=representation' }
  });
  return result[0];
}
async function firstOrInsert(table, filter, row) {
  const existing = await request(`/rest/v1/${table}?${filter}&select=*&limit=1`);
  if (existing.length) return existing[0];
  const created = await request(`/rest/v1/${table}?select=*`, {
    method: 'POST', body: JSON.stringify(row), headers: { Prefer: 'return=representation' }
  });
  return created[0];
}

const catalog = [
  ['linguagens', 'LINGUAGENS', 'Linguagens', 'LINGUAGENS.INTERPRETACAO', 'Interpretação textual', 'medium',
    'Em um texto argumentativo, qual elemento apresenta de forma direta a posição defendida pelo autor?',
    ['A tese central', 'A referência bibliográfica', 'O título da publicação', 'A descrição do suporte'], 0,
    'A tese é a ideia central que o autor sustenta por meio de argumentos.'],
  ['raciocinio-logico', 'RLM', 'Raciocínio Lógico', 'RLM.PROPOSICOES', 'Proposições', 'easy',
    'Se todo policial aprovado concluiu o curso e Ana foi aprovada, qual conclusão decorre necessariamente?',
    ['Ana iniciou o curso', 'Ana concluiu o curso', 'Ana foi a primeira colocada', 'Ana concluiu outro concurso'], 1,
    'Aplicando a implicação apresentada, a aprovação de Ana permite concluir que ela concluiu o curso.'],
  ['direito', 'DIREITO', 'Direito', 'DIREITO.FUNDAMENTAIS', 'Direitos fundamentais', 'medium',
    'Segundo a Constituição Federal, a manifestação do pensamento é livre, sendo:',
    ['Permitido o anonimato em qualquer hipótese', 'Vedado o anonimato', 'Exigida autorização prévia', 'Restrita aos agentes públicos'], 1,
    'O art. 5º, IV, assegura a livre manifestação do pensamento e veda o anonimato.'],
  ['legislacao-policial', 'LEGISLACAO_POLICIAL', 'Legislação Policial', 'LEGISLACAO_POLICIAL.ETICA', 'Ética e disciplina', 'hard',
    'Em matéria disciplinar, a motivação de uma decisão administrativa serve principalmente para:',
    ['Dispensar a apuração dos fatos', 'Demonstrar os fundamentos de fato e de direito', 'Substituir o direito de defesa', 'Manter o ato administrativo em sigilo'], 1,
    'A motivação explicita as razões fáticas e jurídicas da decisão e permite seu controle.'],
  ['conhecimentos-gerais', 'CONHECIMENTOS_GERAIS', 'Conhecimentos Gerais', 'CONHECIMENTOS_GERAIS.CIDADANIA', 'Cidadania', 'easy',
    'O exercício da cidadania em uma democracia inclui:',
    ['Somente o voto obrigatório', 'Participação social e acompanhamento das políticas públicas', 'Apenas o exercício de cargo público', 'Renúncia ao debate de ideias'], 1,
    'Cidadania abrange participação social, fiscalização e exercício de direitos e deveres.'],
  ['direito', 'DIREITO', 'Direito', 'DIREITO.ADMINISTRACAO', 'Administração pública', 'hard',
    'O princípio que exige atuação administrativa sem favorecimentos pessoais é o da:',
    ['Publicidade', 'Eficiência', 'Impessoalidade', 'Continuidade'], 2,
    'A impessoalidade orienta a Administração ao interesse público, sem favorecimento pessoal.']
];

async function reviewerId() {
  const email = 'catalog-reviewer@rota-pmmg.internal';
  const users = await request('/auth/v1/admin/users?per_page=1000');
  const existing = users.users.find(user => user.email === email);
  if (existing) return existing.id;
  const created = await request('/auth/v1/admin/users', {
    method: 'POST', body: JSON.stringify({ email, password: crypto.randomBytes(32).toString('hex'), email_confirm: true,
      user_metadata: { full_name: 'Revisão editorial Rota PMMG', system_account: true } })
  });
  await upsert('user_roles', { user_id: created.id, role: 'content_reviewer' }, 'user_id,role');
  return created.id;
}

async function main() {
  const reviewer = await reviewerId();
  const organization = await upsert('organizations', { name: 'Polícia Militar de Minas Gerais', acronym: 'PMMG', country_code: 'BR', state_code: 'MG', slug: 'pmmg' }, 'slug');
  const position = await firstOrInsert('positions', `organization_id=eq.${organization.id}&slug=eq.carreiras-pmmg`,
    { organization_id: organization.id, name: 'Carreiras PMMG', slug: 'carreiras-pmmg', career_area: 'Segurança Pública', education_level: 'Variável' });
  const exam = await firstOrInsert('exams', 'slug=eq.rota-pmmg-autoral-2026', { institution: 'PMMG', state: 'MG', role: 'Material autoral preparatório', exam_year: 2026,
    organizer: 'Rota PMMG', source_url: 'https://rota-pmmg.vercel.app', authorization_reference: 'Conteúdo autoral Rota PMMG',
    status: 'published', slug: 'rota-pmmg-autoral-2026', title: 'Questões autorais Rota PMMG', organization_id: organization.id,
    position_id: position.id, has_physical_test: true, metadata: { official: false, purpose: 'diagnostic_seed' } });

  for (const [axisSlug, subjectCode, subjectName, topicCode, topicName, difficulty, statement, options, correct, explanation] of catalog) {
    const axis = (await request(`/rest/v1/question_axes?slug=eq.${axisSlug}&select=id&limit=1`))[0];
    const subject = await upsert('subjects', { stable_code: subjectCode, name: subjectName, slug: axisSlug }, 'stable_code');
    const topic = await upsert('topics', { subject_id: subject.id, stable_code: topicCode, name: topicName,
      slug: topicName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }, 'stable_code');
    await upsert('exam_subjects', { exam_id: exam.id, subject_id: subject.id, display_name: subjectName }, 'exam_id,subject_id');
    await upsert('exam_topics', { exam_id: exam.id, topic_id: topic.id, source_reference: 'Conteúdo autoral Rota PMMG', required: true }, 'exam_id,topic_id');
    const contentHash = crypto.createHash('sha256').update(statement).digest('hex');
    const question = await upsert('questions', { exam_id: exam.id, axis_id: axis.id, subject: subjectName, topic: topicName,
      statement, options, correct_option: correct, explanation, difficulty, content_hash: contentHash, status: 'published',
      reviewed_by: reviewer, reviewed_at: new Date().toISOString(), source_type: 'manually_created', validation_status: 'validated',
      validated_by: reviewer, validated_at: new Date().toISOString() }, 'content_hash');
    for (let index = 0; index < options.length; index += 1) {
      await upsert('question_options', { question_id: question.id, option_index: index, label: String.fromCharCode(65 + index), content: options[index] }, 'question_id,option_index');
    }
    await upsert('question_topics', { question_id: question.id, topic_id: topic.id, relevance: 1, is_primary: true,
      classification_method: 'manual', classified_by: reviewer }, 'question_id,topic_id');
    await upsert('question_sources', { question_id: question.id, source_type: 'manually_created', source_name: 'Rota PMMG — conteúdo autoral',
      source_url: 'https://rota-pmmg.vercel.app', authorization_reference: 'Produção editorial própria', official: false }, 'question_id,source_type,source_name');
  }
  process.stdout.write(`Catálogo candidato preparado: ${catalog.length} questões autorais validadas.\n`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
