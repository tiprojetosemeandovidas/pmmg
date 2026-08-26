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

A página `/analisar-edital` oferece login por link mágico, upload direto e assinado para um bucket privado e extração estruturada. PDFs são limitados a 10 MB e validados novamente no servidor antes do registro. Toda extração fica com revisão obrigatória; usuários com papel `admin` ou `content_reviewer` podem revisar em `/admin`.

Além das variáveis públicas acima, configure somente no ambiente server-side:

```text
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_EDITAL_MODEL
```

O modelo pode ser substituído sem alterar o extrator. A API usa Structured Outputs e valida novamente datas, tipos, disciplinas e confiança antes de persistir. O rate limit atual protege cada instância serverless; antes de alto volume, substitua-o por um armazenamento distribuído.

Conceda revisão somente pelo SQL Editor ou por outro processo administrativo confiável, nunca pelo frontend:

```sql
insert into public.user_roles (user_id, role)
values ('UUID_DO_USUARIO', 'content_reviewer');
```

## Vercel

Importe este repositório na Vercel e configure as variáveis aplicáveis para Production, Preview e Development. O endpoint `/api/config` entrega somente a URL e a chave pública necessárias ao navegador.

Para deploy via CLI, depois de instalar e autenticar a Vercel CLI:

```bash
vercel link
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel --prod
```
