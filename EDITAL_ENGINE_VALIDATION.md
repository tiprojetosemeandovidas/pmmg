# Validação de produção — Edital Engine

## Estado

🟡 **Parcial.** Código, migrações e falhas controladas foram validados localmente. A migração remota e o E2E com Supabase, OpenAI e Vercel reais ainda dependem de credenciais e projeto configurados.

## Fluxo implementado

1. Supabase Auth valida o bearer token no servidor.
2. A API autentica, aplica rate limit distribuído e emite upload assinado para caminho privado do usuário.
3. O navegador envia o PDF diretamente ao Storage, evitando o limite de corpo da Vercel.
4. A API baixa e valida MIME declarado, extensão, tamanho real, assinatura `%PDF-`, marcador `%%EOF`, caminho e SHA-256.
5. PDFs repetidos do mesmo usuário reutilizam o registro existente.
6. A Responses API inicia Structured Output em background e devolve o controle rapidamente.
7. A interface consulta estados com backoff: `uploaded`, `queued`, `extracting`, `processing`, `normalizing`, `needs_review` e `failed`.
8. O JSON é validado deterministicamente antes de persistir; resposta inválida é descartada.
9. Tópicos são normalizados contra códigos, nomes e aliases existentes. Itens sem correspondência ficam pendentes.
10. A extração termina em `needs_review`. Apenas `admin` ou `content_reviewer` pode aprovar no backend.

## Validação local executada

```bash
npm install
npm run check
```

O comando abrange lint, typecheck, testes e build estático. A suíte também cria PostgreSQL efêmero, executa schema + migrações, reaplica `002_edital_engine.sql`, valida RLS/bucket e exercita o rate limit.

Resultado da última execução: **35 testes aprovados, 0 falhas**, `npm audit` sem vulnerabilidades e build Preview concluído pela Vercel CLI 59.5.0 no runtime Node.js 24.x. As nove funções serverless, incluindo as rotas dinâmicas de extração e status, apareceram no output.

Foram ainda validados todos os 51 PDFs reais existentes em `public/provas` quanto a tamanho, assinatura e estrutura final. Eles são provas, não editais completos, portanto não substituem o E2E pedido com um edital oficial.

O ambiente Preview recuperado da Vercel contém as variáveis públicas do Supabase, mas não contém `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` ou `OPENAI_EDITAL_MODEL`. Nenhuma migração foi aplicada ao projeto remoto durante esta auditoria.

## Aplicação no Supabase Dashboard

Em um projeto novo, abra **SQL Editor** e execute integralmente, nesta ordem:

1. `supabase/schema.sql`
2. `supabase/migrations/001_multi_exam_foundation.sql`
3. `supabase/migrations/002_edital_engine.sql`
4. `supabase/verify/002_edital_engine_check.sql`

Em projeto que já recebeu a Fase 1, execute somente os itens 3 e 4. A Fase 2 é incremental, não contém `drop table` nem exclusão de dados. A reaplicação atualiza constraints/policies e preserva registros; estados antigos são migrados antes da nova constraint.

Para conceder revisão, use o SQL Editor com um UUID confirmado em `auth.users`:

```sql
insert into public.user_roles (user_id, role)
values ('UUID_DO_USUARIO', 'content_reviewer')
on conflict do nothing;
```

## E2E manual obrigatório

Após configurar as variáveis e publicar na Vercel:

1. Cadastre/acesse um usuário em `/analisar-edital`.
2. Envie um edital oficial em PDF com até 10 MB.
3. Confirme no Storage que o objeto está em `editais-private/{user_id}/...` e o bucket não é público.
4. Confirme a sequência de estados e o resultado `needs_review`.
5. Confira órgão, cargo, banca, datas, disciplinas, tópicos, etapas, critérios eliminatórios e TAF contra o PDF.
6. Entre em `/admin` com `content_reviewer`, corrija se necessário e aprove.
7. Confirme `status = completed`, `review_status = approved` e `reviewed_by` preenchido.
8. Com outro usuário, tente consultar o UUID do edital: a API deve responder 404.

Repita com: arquivo texto renomeado; PDF maior que 10 MB; PDF escaneado/sem texto; indisponibilidade da OpenAI; resposta inválida simulada; e indisponibilidade do Supabase. Os testes automatizados cobrem os contratos dessas falhas, mas a infraestrutura real precisa ser exercitada após o deploy.
