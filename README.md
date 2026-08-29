# Rota

Plataforma adaptativa de preparação para concursos públicos. A PMMG permanece como primeira vertical e acervo inicial, enquanto o núcleo do produto é nacional e multi-concurso.

## Stack

- Next.js 16 com App Router;
- React 19;
- TypeScript estrito;
- autenticação por e-mail e Supabase SSR/client;
- sincronização do estado adaptativo por usuário, com fallback local explícito;
- Mentor IA com fontes, respostas estruturadas, limite diário e auditoria;
- Opportunity Engine com compatibilidade explicável e trilhas acompanhadas;
- TAF genérico com metas pessoais, histórico e gamificação saudável;
- operação do piloto com planos internos, limites, request IDs e painel administrativo;
- Zod para configuração;
- Vitest para regras de domínio;
- Vercel como destino de deploy.

## Executar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

Verificações disponíveis:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Arquitetura

- `app/`: rotas, layouts, páginas e endpoints do App Router;
- `components/`: shell da aplicação, onboarding e providers;
- `lib/domain/`: motor adaptativo puro, tipado e testável;
- `lib/data/`: conteúdo autoral validado do diagnóstico;
- `lib/supabase/`: clientes browser/server e validação de configuração;
- `public/data/`: catálogo PMMG extraído;
- `public/provas/`: cadernos oficiais preservados;
- `supabase/schema.sql`: schema multi-concurso com RLS;
- `scripts/`: importação auditável de provas.

## Fluxo implementado

- landing pública;
- onboarding progressivo em cinco etapas;
- jornada de escolha e modo pré-edital;
- diagnóstico de dez questões;
- domínio e confiança separados;
- prioridade explicável e próxima melhor ação;
- plano semanal recalculável;
- Rota Score;
- Caderno de Erros e revisão;
- XP, nível e sequência;
- rotas reais para plano, desempenho, Radar, oportunidades, Mentor IA, questões, simulados, TAF, editais e ajuda.

Usuários autenticados sincronizam o estado adaptativo na tabela `candidate_states`. O `localStorage` funciona como cache offline por usuário e como fonte do modo demonstração; a aplicação nunca mistura automaticamente o estado remoto de duas contas.

## Banco de questões

O catálogo contém 32 provas e 1.288 questões PMMG em `public/data/questions.json`. As questões oficiais continuam com gabarito pendente e não pontuam até conferência humana. O diagnóstico utiliza dez questões autorais identificadas.

A central `/app/admin/questoes` permite cadastrar questões manualmente ou pesquisar fontes públicas com Perplexity. Pesquisa, URLs, modelo, direitos declarados e autoria ficam separados e auditáveis. Conteúdo web gera apenas rascunhos autorais; publicação exige revisão humana e associação a prova/eixo.

Para refazer a importação:

```bash
python3 scripts/import_pmmg_pdfs.py /caminho/PMMG_Provas public/data
```

## Supabase

1. Em ambientes novos, aplique `supabase/migrations` em ordem; a migration `00000000000000_legacy_schema_foundation.sql` cria a fundação e o trigger de perfil usados pelo cadastro.
   - `supabase/schema.sql` permanece como snapshot consolidado para consulta e recuperação de ambientes legados.
   - Em um banco que já recebeu o schema anterior, as migrations são idempotentes e podem ser aplicadas em ordem.
   - Para ativar o Edital Engine, execute também `supabase/migrations/20260827180000_notice_engine.sql`.
   - Para ativar o histórico do Mentor, execute `supabase/migrations/20260827200000_ai_mentor.sql`.
   - Para ativar trilhas acompanhadas, execute `supabase/migrations/20260827220000_opportunity_engine.sql`.
   - Para ativar TAF e conquistas, execute `supabase/migrations/20260827233000_taf_gamification.sql`.
   - Para ativar operação, limites e planos, execute `supabase/migrations/20260828090000_pilot_operations.sql`.
   - Para ativar a central de conhecimento, execute `supabase/migrations/20260828150000_question_knowledge_hub.sql`.
2. Configure as variáveis documentadas em `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `PERPLEXITY_API_KEY` e, opcionalmente, `PERPLEXITY_MODEL=sonar` apenas no servidor.
3. Nunca exponha a chave `service_role` no frontend.

O fluxo público está em `/entrar`. Cadastros com confirmação de e-mail retornam por `/auth/callback`; inclua a URL pública do projeto nas Redirect URLs permitidas no Supabase Auth.

## Edital Engine

Editais são enviados para um bucket privado, validados por assinatura e tamanho, deduplicados por SHA-256 e extraídos no servidor. Documentos sem camada textual recebem `needs_ocr`; os demais entram em `needs_review`. Somente perfis `reviewer` ou `admin` acessam `/app/admin/editais` e podem materializar uma submissão na tabela canônica `notices`.

## Mentor IA

O endpoint `/api/mentor` usa a Responses API somente no servidor, com `store: false`, saída estruturada, identificador de segurança pseudonimizado e até 30 solicitações em uma janela de 24 horas. No MVP, o modelo padrão é o econômico `gpt-5.6-luna`, com esforço de raciocínio baixo para controlar custo e latência; ele pode ser trocado por `OPENAI_MODEL`. Cada resposta registra fontes, modelo, versão do prompt, tokens e latência em `ai_interactions`. Sem `OPENAI_API_KEY`, o Mentor mantém uma orientação determinística baseada no motor adaptativo e identifica esse modo na interface.

## Opportunity Engine

A página `/app/oportunidades` compara trilhas de carreira por sobreposição curricular, interesses, formação, domínio observado e confiança das evidências. Compatibilidade, prontidão e elegibilidade são apresentadas separadamente. As trilhas são referências de preparação, não anúncios de concursos abertos; dados de edital continuam dependendo de validação oficial. Usuários autenticados podem acompanhar trilhas, e a pontuação gravada em `user_career_tracks` é recalculada exclusivamente pela API server-side.

## TAF e gamificação

A página `/app/taf` acompanha cinco tipos genéricos de exercício, metas pessoais e medições históricas. Metas pessoais nunca recebem selo de requisito oficial; esse selo fica reservado a dados ligados a um edital validado. O dashboard calcula missões com progresso limitado ao volume planejado e libera conquistas por evidências reais, evitando recompensar excesso de carga. Dados físicos e conquistas são privados, protegidos por RLS e escritos somente pelas APIs server-side.

## Operação do piloto

Planos e permissões ficam desacoplados do gateway de pagamento nas tabelas `subscription_plans` e `user_subscriptions`. Mentor e Edital Engine usam limites derivados do plano e registram consumo idempotente em `usage_events`. Requisições críticas recebem `x-request-id`; somente metadados operacionais, sem perguntas ou conteúdo de documentos, entram em `operational_events`. Administradores acessam `/app/admin/operacoes` para acompanhar falhas, latência, consumo, tokens e fila de revisão.

Os testes ponta a ponta ficam em `tests/e2e`. `npm run test:e2e` executa os cenários públicos; configure `E2E_EMAIL` e `E2E_PASSWORD` de uma conta candidata exclusiva para ativar também o cenário autenticado. Nunca reutilize credenciais administrativas.

O endpoint `/api/health` informa se o runtime Next.js está saudável e se o banco foi configurado, sem expor credenciais.

## Deploy

O `vercel.json` identifica o projeto como Next.js. Configure as mesmas variáveis em Production, Preview e Development antes de publicar.
