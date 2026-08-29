-- Opportunity Engine: catálogo de trilhas e interesses privados do candidato.
create table if not exists public.career_tracks (
  code text primary key,
  title text not null,
  institution text not null,
  area text not null check (area in ('policial','juridica','fiscal','administrativa')),
  scope text not null,
  education_requirement text not null check (education_requirement in ('medio','superior')),
  has_physical_test boolean not null default false,
  summary text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_track_topics (
  track_code text not null references public.career_tracks(code) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  weight numeric(5,4) not null check (weight > 0 and weight <= 1),
  primary key (track_code, topic_id)
);

create table if not exists public.user_career_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_code text not null references public.career_tracks(code) on delete cascade,
  status text not null default 'watching' check (status in ('watching','secondary')),
  compatibility_score numeric(5,2) not null check (compatibility_score between 0 and 100),
  calculation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_code)
);

create index if not exists user_career_tracks_status_idx
  on public.user_career_tracks(user_id, status, updated_at desc);

alter table public.career_tracks enable row level security;
alter table public.career_track_topics enable row level security;
alter table public.user_career_tracks enable row level security;

drop policy if exists "career_tracks_read" on public.career_tracks;
create policy "career_tracks_read" on public.career_tracks for select using (active);
drop policy if exists "career_track_topics_read" on public.career_track_topics;
create policy "career_track_topics_read" on public.career_track_topics for select using (true);
drop policy if exists "user_career_tracks_own_all" on public.user_career_tracks;
drop policy if exists "user_career_tracks_select_own" on public.user_career_tracks;
create policy "user_career_tracks_select_own" on public.user_career_tracks for select
using (auth.uid() = user_id);

-- O cálculo e as escritas passam pela API server-side para impedir que o
-- cliente altere artificialmente a própria pontuação de compatibilidade.

insert into public.career_tracks (code, title, institution, area, scope, education_requirement, has_physical_test, summary) values
  ('pmmg-cfsd','Polícia Militar — Soldado','Polícias Militares','policial','Estadual','medio',true,'Trilha-base para carreiras policiais militares, sujeita ao edital de cada estado.'),
  ('pmmg-cfo','Polícia Militar — Oficial','Polícias Militares','policial','Estadual','superior',true,'Trilha de formação de oficiais com maior ênfase jurídica e requisitos definidos por edital.'),
  ('federal-police','Carreiras policiais federais','Órgãos policiais federais','policial','Federal','superior',true,'Base de conhecimentos reaproveitável; cargos, etapas e requisitos variam por órgão e edital.'),
  ('courts','Tribunais','Tribunais e órgãos jurídicos','juridica','Nacional','medio',false,'Trilha geral para áreas administrativa e judiciária, sem representar um edital específico.'),
  ('fiscal','Carreira fiscal','Fiscos estaduais e municipais','fiscal','Nacional','superior',false,'Núcleo comum inicial para fiscos; disciplinas especializadas entram após a escolha do edital.'),
  ('administrative','Área administrativa','Órgãos públicos diversos','administrativa','Nacional','medio',false,'Trilha exploratória de alta reutilização para quem ainda está escolhendo um órgão.')
on conflict (code) do update set
  title = excluded.title, institution = excluded.institution, area = excluded.area,
  scope = excluded.scope, education_requirement = excluded.education_requirement,
  has_physical_test = excluded.has_physical_test, summary = excluded.summary,
  active = true, updated_at = now();

insert into public.career_track_topics (track_code, topic_id, weight)
select valueset.track_code, topics.id, valueset.weight
from (values
  ('pmmg-cfsd','LING.INTERPRETACAO',.75),('pmmg-cfsd','RLM.PROPOSICOES',.70),('pmmg-cfsd','CONST.DIREITOS_FUNDAMENTAIS',.90),('pmmg-cfsd','LEG.ETICA_DISCIPLINA',1.00),('pmmg-cfsd','GERAL.CIDADANIA',.65),
  ('pmmg-cfo','LING.INTERPRETACAO',.80),('pmmg-cfo','RLM.PROPOSICOES',.55),('pmmg-cfo','CONST.DIREITOS_FUNDAMENTAIS',1.00),('pmmg-cfo','LEG.ETICA_DISCIPLINA',.90),('pmmg-cfo','GERAL.CIDADANIA',.60),
  ('federal-police','LING.INTERPRETACAO',.80),('federal-police','RLM.PROPOSICOES',.85),('federal-police','CONST.DIREITOS_FUNDAMENTAIS',1.00),('federal-police','LEG.ETICA_DISCIPLINA',.65),('federal-police','GERAL.CIDADANIA',.45),
  ('courts','LING.INTERPRETACAO',1.00),('courts','RLM.PROPOSICOES',.65),('courts','CONST.DIREITOS_FUNDAMENTAIS',.90),('courts','LEG.ETICA_DISCIPLINA',.25),('courts','GERAL.CIDADANIA',.35),
  ('fiscal','LING.INTERPRETACAO',.70),('fiscal','RLM.PROPOSICOES',1.00),('fiscal','CONST.DIREITOS_FUNDAMENTAIS',.70),('fiscal','LEG.ETICA_DISCIPLINA',.15),('fiscal','GERAL.CIDADANIA',.35),
  ('administrative','LING.INTERPRETACAO',1.00),('administrative','RLM.PROPOSICOES',.80),('administrative','CONST.DIREITOS_FUNDAMENTAIS',.60),('administrative','LEG.ETICA_DISCIPLINA',.30),('administrative','GERAL.CIDADANIA',.55)
) as valueset(track_code, topic_code, weight)
join public.topics on topics.stable_code = valueset.topic_code
on conflict (track_code, topic_id) do update set weight = excluded.weight;
