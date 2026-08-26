# Rota PMMG

Protótipo responsivo de uma plataforma adaptativa de preparação para candidatos da PMMG, construído a partir do blueprint do piloto.

## Executar

Inicie um servidor apontando para a pasta pública:

```bash
python3 -m http.server 8000 --directory public
```

Depois acesse `http://localhost:8000`.

## Incluído

- Dashboard do candidato responsivo
- Próxima sessão e explicação da recomendação
- Métricas de estudo e mapa de prioridades
- Plano semanal e navegação entre módulos
- Modal para iniciar sessão e feedbacks interativos
- Páginas de plano, desempenho, questões, edital e ajuda

Os dados são demonstrativos e não incluem conteúdo protegido de terceiros.

### Banco de questões

A interface organiza questões em cinco eixos, permite filtrar por concurso e dificuldade e oferece ordem aleatória. As questões iniciais são demonstrativas e autorais.

Para importar conteúdo real, use `supabase/questions-import-template.csv`. Cada prova deve ter URL de origem e referência de autorização. O banco bloqueia por padrão tudo que ainda não estiver com status `published`.

O arquivo fornecido `PMMG_Provas_CFSD_CFO_2001-2025.zip` foi catalogado em `public/provas`: são 32 cadernos e 1.288 questões extraídas para `public/data/questions.json`. Como a marcação visual dos gabaritos não é preservada na extração dos PDFs, as questões oficiais permanecem com `reviewStatus: pending` e não contam pontos até conferência humana.

Para refazer a importação:

```bash
python3 scripts/import_pmmg_pdfs.py /caminho/PMMG_Provas public/data
```

A aba Simulados mistura as questões autorais semelhantes que possuem resposta revisada. Os cadernos oficiais podem ser filtrados por CFSD/CFO e abertos diretamente pela plataforma.

## Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute `supabase/schema.sql`.
3. Execute, em ordem, os arquivos de `supabase/migrations/` (começando por `001_multi_exam_foundation.sql`).
4. Copie a Project URL e a chave `anon` pública em Project Settings → API.
5. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` na Vercel.

O esquema ativa Row Level Security e isola perfil, sessões e prioridades pelo usuário autenticado. Nunca exponha a chave `service_role` no frontend.

### Edital Engine (Fase 2)

A página `/analisar-edital` oferece login por link mágico, upload direto e assinado para um bucket privado e extração estruturada assíncrona. PDFs são limitados a 10 MB e validados novamente no servidor antes do registro. Toda extração fica com revisão obrigatória; usuários com papel `admin` ou `content_reviewer` podem revisar em `/admin`.

Além das variáveis públicas acima, configure somente no ambiente server-side:

```text
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_EDITAL_MODEL
```

O modelo pode ser substituído sem alterar o extrator. A API usa Structured Outputs e valida novamente datas, tipos, disciplinas e confiança antes de persistir. O processamento usa o modo background da OpenAI, polling curto e exclusão best effort da resposta após a normalização. O rate limit é atômico no PostgreSQL e limita o custo mesmo com várias instâncias serverless.

Conceda revisão somente pelo SQL Editor ou por outro processo administrativo confiável, nunca pelo frontend:

```sql
insert into public.user_roles (user_id, role)
values ('UUID_DO_USUARIO', 'content_reviewer')
on conflict do nothing;
```

Depois de executar `supabase/schema.sql`, `001_multi_exam_foundation.sql` e `002_edital_engine.sql` no SQL Editor, execute `supabase/verify/002_edital_engine_check.sql`. O último arquivo é somente leitura e falha explicitamente se faltar tabela, coluna, bucket privado ou função de rate limit.

### Question Engine (Fase 3)

Em um banco já inicializado, execute `supabase/migrations/003_question_engine.sql` depois das migrations anteriores e valide com `supabase/verify/003_question_engine_check.sql`. A migration preserva `questions.options` para compatibilidade, cria alternativas normalizadas, relação muitos-para-muitos com tópicos, metadados de origem e busca textual em português.

Somente questões com `status = published` e `validation_status = validated` são entregues pela API autenticada `GET /api/questions`. O contrato público omite o gabarito. Questões oficiais exigem URL de fonte e conteúdo gerado por IA mantém sempre `source_type = ai_generated`.

Para preparar um lote, copie `supabase/questions-import-template.csv`, substitua os UUIDs pelo catálogo real e execute:

```bash
node scripts/prepare_questions_import.js caminho/questoes.csv > questions-import.json
```

Envie o JSON, em lotes de até 25, para `POST /api/admin/questions` com o token de um usuário `admin` ou `content_reviewer`. Toda importação começa como pendente; a revisão administrativa usa `PATCH /api/admin/questions/:id` com `decision` igual a `validated` ou `rejected`. A captura de respostas e a correção ao candidato pertencem à Fase 4 e ainda não foram ativadas.

## Qualidade

O projeto usa npm e fixa a linha LTS Node.js 24.x:

```bash
npm install
npm run check
```

`check` executa ESLint, verificação de tipos JavaScript com TypeScript, testes `node:test`, migrações em PostgreSQL efêmero e validação do build estático.

## Vercel

Importe este repositório na Vercel e configure as variáveis aplicáveis para Production, Preview e Development. O endpoint `/api/config` entrega somente a URL e a chave pública necessárias ao navegador.

Para deploy via CLI, depois de instalar e autenticar a Vercel CLI:

```bash
vercel link
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel --prod
```
