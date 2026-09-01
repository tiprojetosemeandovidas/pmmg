'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const root = path.resolve(__dirname, '..');
const sql = file => fs.readFileSync(path.join(root, file), 'utf8');

test('aplica schema e migrações, reaplica Fases 2 a 6 e verifica objetos', { timeout: 30000 }, async () => {
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
  `);
  // Usa a mesma fundação executada pelo histórico real de migrations. O
  // schema.sql é apenas um snapshot de desenvolvimento e pode estar à frente.
  await db.exec(sql('supabase/migrations/00000000000000_legacy_schema_foundation.sql'));
  await db.exec(sql('supabase/migrations/001_multi_exam_foundation.sql'));
  await db.exec(sql('supabase/migrations/002_edital_engine.sql'));
  await db.exec(sql('supabase/migrations/002_edital_engine.sql'));
  await db.exec(sql('supabase/verify/002_edital_engine_check.sql'));
  await db.exec(sql('supabase/migrations/003_question_engine.sql'));
  await db.exec(sql('supabase/migrations/003_question_engine.sql'));
  await db.exec(sql('supabase/verify/003_question_engine_check.sql'));
  await db.exec(sql('supabase/migrations/004_candidate_model.sql'));
  await db.exec(sql('supabase/migrations/004_candidate_model.sql'));
  await db.exec(sql('supabase/verify/004_candidate_model_check.sql'));
  await db.exec(sql('supabase/migrations/005_candidate_model_hardening.sql'));
  await db.exec(sql('supabase/migrations/005_candidate_model_hardening.sql'));
  await db.exec(sql('supabase/verify/005_candidate_model_hardening_check.sql'));
  await db.exec(sql('supabase/migrations/006_adaptive_engine.sql'));
  await db.exec(sql('supabase/migrations/006_adaptive_engine.sql'));
  await db.exec(sql('supabase/verify/006_adaptive_engine_check.sql'));
  await db.exec(sql('supabase/migrations/007_adaptive_engine_hardening.sql'));
  await db.exec(sql('supabase/migrations/007_adaptive_engine_hardening.sql'));
  await db.exec(sql('supabase/verify/007_adaptive_engine_hardening_check.sql'));
  await db.exec(sql('supabase/migrations/008_adaptive_planner.sql'));
  await db.exec(sql('supabase/migrations/008_adaptive_planner.sql'));
  await db.exec(sql('supabase/verify/008_adaptive_planner_check.sql'));
  await db.exec(sql('supabase/migrations/20260830120000_enem_pilot_readiness.sql'));
  await db.exec(sql('supabase/migrations/20260830120000_enem_pilot_readiness.sql'));
  await db.exec(sql('supabase/migrations/20260830160000_pilot_cohort.sql'));
  await db.exec(sql('supabase/migrations/20260830160000_pilot_cohort.sql'));
  await db.exec(`
    drop table public.user_roles;
    insert into auth.users (email, raw_user_meta_data)
    values ('digitalcarloscruz@gmail.com', '{"full_name":"Carlos Cruz"}'::jsonb);
  `);
  await db.exec(sql('supabase/migrations/20260830170000_admin_digitalcarloscruz.sql'));
  await db.exec(sql('supabase/migrations/20260830170000_admin_digitalcarloscruz.sql'));
  await db.exec(sql('supabase/migrations/20260901120000_enem_archive_knowledge.sql'));
  await db.exec(sql('supabase/migrations/20260901120000_enem_archive_knowledge.sql'));
  await db.exec(sql('supabase/verify/009_enem_archive_check.sql'));

  const tables = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('notices','user_roles','notice_extraction_runs','notice_stages','notice_chunks','notice_topic_mappings','api_rate_limits') order by tablename");
  assert.equal(tables.rows.length, 7);
  assert.ok(tables.rows.every(row => row.rowsecurity));
  const forbiddenWrites = await db.query("select tablename, cmd from pg_policies where schemaname = 'public' and tablename in ('user_roles','topics','questions','notices') and cmd <> 'SELECT'");
  assert.equal(forbiddenWrites.rows.length, 0);
  const bucket = await db.query("select public, file_size_limit from storage.buckets where id = 'editais-private'");
  assert.deepEqual(bucket.rows[0], { public: false, file_size_limit: 10485760 });
  const limited = await db.query("select * from public.consume_rate_limit($1, 1, 3600)", ['a'.repeat(64)]);
  const blocked = await db.query("select * from public.consume_rate_limit($1, 1, 3600)", ['a'.repeat(64)]);
  assert.equal(limited.rows[0].allowed, true);
  assert.equal(blocked.rows[0].allowed, false);
  const questionTables = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('question_options','question_topics','question_sources') order by tablename");
  assert.equal(questionTables.rows.length, 3);
  assert.ok(questionTables.rows.every(row => row.rowsecurity));
  const candidateTables = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('user_answers','diagnostic_sessions') order by tablename");
  assert.equal(candidateTables.rows.length, 2);
  assert.ok(candidateTables.rows.every(row => row.rowsecurity));
  const adaptiveTables = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'adaptive_recommendations'");
  assert.deepEqual(adaptiveTables.rows[0], { tablename: 'adaptive_recommendations', rowsecurity: true });
  const plannerTables = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('study_plans','plan_tasks','review_queue') order by tablename");
  assert.equal(plannerTables.rows.length, 3);
  assert.ok(plannerTables.rows.every(row => row.rowsecurity));
  const pilotTables = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'pilot_events'");
  assert.deepEqual(pilotTables.rows[0], { tablename: 'pilot_events', rowsecurity: true });
  const cohortTables = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('pilot_cohorts','pilot_participants','pilot_feedback') order by tablename");
  assert.equal(cohortTables.rows.length, 3);
  assert.ok(cohortTables.rows.every(row => row.rowsecurity));
  const adminProfile = await db.query(`
    select p.account_role
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = 'digitalcarloscruz@gmail.com'
  `);
  assert.deepEqual(adminProfile.rows[0], { account_role: 'admin' });
  const adminRole = await db.query(`
    select ur.role
    from public.user_roles ur
    join auth.users u on u.id = ur.user_id
    where lower(u.email) = 'digitalcarloscruz@gmail.com'
  `);
  assert.deepEqual(adminRole.rows[0], { role: 'admin' });
  assert.equal(
    await db.query("select has_column_privilege('authenticated', 'public.profiles', 'account_role', 'update') as allowed").then(result => result.rows[0].allowed),
    false,
  );
  assert.equal(
    await db.query("select has_column_privilege('authenticated', 'public.profiles', 'account_role', 'select') as allowed").then(result => result.rows[0].allowed),
    true,
  );
  assert.equal(
    await db.query("select count(*)::integer as count from pg_policies where schemaname = 'public' and policyname in ('pilot_cohorts_admin_all','pilot_participants_admin_all','pilot_feedback_admin_select','pilot_events_admin_select')").then(result => result.rows[0].count),
    4,
  );
  const enemArchiveTables = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('enem_archive_documents','enem_archive_chunks','enem_archive_items') order by tablename");
  assert.equal(enemArchiveTables.rows.length, 3);
  assert.ok(enemArchiveTables.rows.every(row => row.rowsecurity));
  assert.equal(await db.query("select count(*)::integer as count from public.exams where slug like 'enem-%-regular-amarelo'").then(result => result.rows[0].count), 28);
  await db.close();
});
