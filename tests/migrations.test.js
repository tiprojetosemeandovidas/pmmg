'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const root = path.resolve(__dirname, '..');
const sql = file => fs.readFileSync(path.join(root, file), 'utf8');

test('aplica schema e migrações, reaplica Fases 2 a 4 e verifica objetos', { timeout: 30000 }, async () => {
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
  await db.exec(sql('supabase/schema.sql'));
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
  await db.close();
});
