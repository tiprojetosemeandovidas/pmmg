do $$
begin
  if (select count(*) from public.exams where slug like 'enem-%-regular-amarelo') <> 28 then
    raise exception 'Catálogo ENEM 1998-2025 incompleto';
  end if;
  if (select count(*) from pg_tables where schemaname = 'public' and tablename in
    ('enem_archive_documents', 'enem_archive_chunks', 'enem_archive_items') and rowsecurity) <> 3 then
    raise exception 'Tabelas do acervo ENEM ausentes ou sem RLS';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename in
      ('enem_archive_documents', 'enem_archive_chunks', 'enem_archive_items')
  ) then
    raise exception 'O acervo ENEM não deve possuir políticas de acesso direto';
  end if;
end $$;
