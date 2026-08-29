-- ENEM 2026: objetivo nacional, calendário oficial e taxonomia inicial.
alter table public.career_tracks drop constraint if exists career_tracks_area_check;
alter table public.career_tracks add constraint career_tracks_area_check
  check (area in ('policial','juridica','fiscal','administrativa','educacional'));

alter table public.career_tracks drop constraint if exists career_tracks_education_requirement_check;
alter table public.career_tracks add constraint career_tracks_education_requirement_check
  check (education_requirement in ('none','medio','superior'));

alter table public.career_tracks add column if not exists exam_date date;
alter table public.career_tracks add column if not exists secondary_exam_date date;
alter table public.career_tracks add column if not exists official_source_url text;
alter table public.career_tracks add column if not exists official_data_checked_at timestamptz;

insert into public.subjects (stable_code, name, slug) values
  ('RED', 'Redação', 'redacao'),
  ('MAT', 'Matemática', 'matematica'),
  ('HUM', 'Ciências Humanas', 'ciencias-humanas'),
  ('NAT', 'Ciências da Natureza', 'ciencias-da-natureza')
on conflict (stable_code) do update set name = excluded.name, slug = excluded.slug;

insert into public.topics (subject_id, stable_code, name, slug, depth)
select subjects.id, valueset.stable_code, valueset.name, valueset.slug, 0
from (values
  ('RED','RED.COMPETENCIAS','Texto dissertativo-argumentativo','texto-dissertativo-argumentativo'),
  ('MAT','MAT.PROBLEMAS','Resolução de problemas','resolucao-de-problemas'),
  ('HUM','HUM.HISTORIA','História e processos sociais','historia-processos-sociais'),
  ('HUM','HUM.GEOGRAFIA','Geografia e espaço brasileiro','geografia-espaco-brasileiro'),
  ('HUM','HUM.FILOSOFIA_SOCIOLOGIA','Filosofia e sociologia','filosofia-sociologia'),
  ('NAT','NAT.BIOLOGIA','Biologia','biologia'),
  ('NAT','NAT.FISICA','Física','fisica'),
  ('NAT','NAT.QUIMICA','Química','quimica')
) as valueset(subject_code, stable_code, name, slug)
join public.subjects on subjects.stable_code = valueset.subject_code
on conflict (stable_code) do update set name = excluded.name, slug = excluded.slug;

insert into public.career_tracks (
  code, title, institution, area, scope, education_requirement, has_physical_test,
  summary, exam_date, secondary_exam_date, official_source_url, official_data_checked_at
) values (
  'enem-2026', 'ENEM 2026', 'Inep', 'educacional', 'Nacional', 'none', false,
  'Aplicação regular em 8 e 15 de novembro de 2026, com quatro áreas do conhecimento, 180 questões objetivas e redação.',
  '2026-11-08', '2026-11-15',
  'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/orientacoes/cronograma',
  now()
)
on conflict (code) do update set
  title = excluded.title, institution = excluded.institution, area = excluded.area,
  scope = excluded.scope, education_requirement = excluded.education_requirement,
  has_physical_test = excluded.has_physical_test, summary = excluded.summary,
  exam_date = excluded.exam_date, secondary_exam_date = excluded.secondary_exam_date,
  official_source_url = excluded.official_source_url,
  official_data_checked_at = excluded.official_data_checked_at,
  active = true, updated_at = now();

insert into public.career_track_topics (track_code, topic_id, weight)
select 'enem-2026', topics.id, valueset.weight
from (values
  ('LING.INTERPRETACAO',1.00),('RED.COMPETENCIAS',1.00),('MAT.PROBLEMAS',1.00),
  ('HUM.HISTORIA',.86),('HUM.GEOGRAFIA',.86),('HUM.FILOSOFIA_SOCIOLOGIA',.72),
  ('NAT.BIOLOGIA',.86),('NAT.FISICA',.86),('NAT.QUIMICA',.86)
) as valueset(topic_code, weight)
join public.topics on topics.stable_code = valueset.topic_code
on conflict (track_code, topic_id) do update set weight = excluded.weight;
