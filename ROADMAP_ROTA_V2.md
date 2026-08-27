# ROADMAP ROTA V2

## Resumo executivo

O repositório atual é um protótipo web estático, sem Next.js, React, bundler, lint ou suíte de testes. A interface é servida diretamente de `public/`, usa JavaScript de navegador e pode ser publicada na Vercel. O Supabase foi iniciado como banco e autenticação, mas a aplicação funciona integralmente em modo demonstrativo quando ele não está configurado.

A evolução deve ser incremental: preservar a interface e o catálogo PMMG, introduzir primeiro o modelo universal de dados e somente então substituir os mocks por fluxos autenticados e dados reais. Migrar agora para um framework acrescentaria risco sem resolver o núcleo do produto; essa decisão deve ser reavaliada quando os primeiros endpoints autenticados exigirem uma camada de aplicação maior.

## Arquitetura atual

| Área | Implementação atual | Estado |
| --- | --- | --- |
| Frontend | HTML5, CSS e JavaScript sem framework em `public/` | Protótipo responsivo e funcional |
| Framework / versões | Não há Next.js, React, `package.json` ou toolchain Node | Não aplicável |
| Rotas | SPA por hash (`#inicio`, `#plano`, etc.) | Não corresponde às URLs públicas desejadas |
| Deploy | Vercel com `public/` como `outputDirectory` | Configurado |
| API | Uma Function CommonJS: `GET /api/config` | Expõe somente configuração pública do Supabase |
| Banco | PostgreSQL/Supabase em `supabase/schema.sql` | Schema inicial; sem migrações versionadas |
| Autenticação | Supabase Auth é inicializado e a sessão é lida | Sem login/logout, guardas ou exigência de sessão |
| Persistência | Supabase previsto; Caderno de Erros em `localStorage` | Maioria dos fluxos ainda é mock |
| Serviços externos | Supabase JS via CDN e Google Fonts | Sem IA, OCR, analytics ou pagamentos |
| Conteúdo | 32 PDFs PMMG, `exams.json` e 1.288 questões extraídas | Gabaritos oficiais pendentes de revisão |
| Importação | Script Python com `pdftotext` | Específico para nomes e taxonomia PMMG |

## Inventário funcional

- Landing PMMG com CTA para diagnóstico demonstrativo.
- Dashboard, plano semanal, desempenho e Radar de Aprovação com valores hardcoded.
- Banco de questões: seis questões autorais revisadas no JavaScript e questões oficiais extraídas dos PDFs, sem gabarito e sem contabilização.
- Filtros por eixo, prova e dificuldade, simulados apenas com questões autorais, links para fontes e separação visual parcial da origem.
- Caderno de Erros local, criado ao responder incorretamente uma questão autoral.
- Diagnóstico de três telas que termina em uma seleção aleatória; não persiste respostas nem calcula domínio.
- TAF demonstrativo com métricas fixas; o botão de registro ainda não grava dados.
- Supabase com perfis, sessões, prioridades, eixos, provas e questões; RLS habilitada.

## Referências hardcoded e mocks

- `public/index.html`: marca, textos, concursos CFSD/CFO, datas, usuário “Marcos Rocha”, métricas, prioridades, Radar, plano, TAF, depoimento e preço são PMMG/mocks.
- `public/app.js`: eixos, seis questões autorais, plano de 18–24 de agosto, filtros CFSD/CFO, diagnóstico aleatório e textos PMMG estão hardcoded.
- `scripts/import_pmmg_pdfs.py`: nomes de carreira, convenção de arquivos, eixos e parser são específicos da PMMG.
- `public/data/*.json` e `public/provas/`: acervo real fornecido, mas metadados de classificação são parciais e respostas aguardam revisão.
- `supabase/schema.sql`: `profiles.exam_cycle`, `exams.state` obrigatório, `question_axes` e campos textuais de disciplina/tópico acoplam o domínio ao piloto.

Dados demonstrativos deverão ser marcados como demonstração e removidos das métricas de usuários autenticados. O acervo PMMG será preservado como uma vertical real, nunca apresentado como cobertura nacional.

## Problemas encontrados

1. O conhecimento está ligado implicitamente a textos de sessão/prioridade, não a tópicos universais estáveis.
2. A tabela `exams` representa provas passadas e, ao mesmo tempo, tenta representar concursos; não suporta edital, cargo, ciclo ou múltiplas etapas adequadamente.
3. Questões guardam alternativas em JSON e apenas um eixo; não há origem normalizada nem relação muitos-para-muitos com tópicos.
4. Não existem respostas, domínio, revisões, recomendações, score, planos adaptativos ou histórico de recálculo persistidos.
5. RLS está incompleta para inserts administrativos e não há papel administrativo modelado.
6. A interface entra no dashboard sem autenticação e exibe estatísticas fictícias como se fossem pessoais.
7. Não há camada de domínio testável; toda a lógica de tela está concentrada em `public/app.js`.
8. Não há upload, storage, OCR, extração estruturada, validação ou revisão de edital.
9. Não há integração de IA. Os botões “IA” apenas mostram notificações.
10. Não há CSP, rate limiting, validação de upload, observabilidade ou analytics estruturado.

## Arquitetura proposta

### Domínio e dados

- `organizations`, `positions`, `exam_boards`, `exams` e `notices` descrevem concursos sem condicionais por órgão.
- `subjects` e `topics` formam a taxonomia universal; `topics.stable_code` é o identificador imutável e `parent_id` representa a hierarquia.
- `exam_subjects` e `exam_topics` ligam o edital à taxonomia, com peso, incidência e critérios.
- `user_exams` liga o candidato a vários concursos. `topic_mastery` pertence ao par usuário/tópico e é reaproveitado entre concursos.
- Questões evoluem de forma compatível: manter `questions`, adicionar origem e validação, criar `question_options`, `question_topics`, `question_sources` e `user_answers` em migrações posteriores.
- Serviços determinísticos de domínio calcularão domínio, prioridade, score, compatibilidade, comparação e plano; IA ficará restrita a interpretação, classificação, geração e explicação.

### Aplicação e API

- Curto prazo: manter o frontend estático e criar módulos ES independentes em `public/js/`, reduzindo gradualmente `app.js`.
- Endpoints serverless autenticados validarão sessão e entrada; secrets serão usados apenas no servidor.
- Antes da Fase 2, escolher entre continuar com Vercel Functions ou adotar uma camada tipada (recomendação: TypeScript com funções modulares; migração para Next.js somente com ADR e testes de regressão).
- Uploads irão para bucket privado; processamento de PDF/OCR será assíncrono, idempotente e auditável.

### Segurança e privacidade

- RLS por usuário em dados comportamentais; leitura pública somente para catálogos explicitamente publicados.
- Papéis em `user_roles`, nunca inferidos de metadados editáveis pelo cliente.
- Validação de MIME, assinatura do arquivo, tamanho, estado e ownership; rate limit em upload e IA.
- Sem chaves de IA no navegador. Logs usarão IDs técnicos e não incluirão texto pessoal completo.

## Plano por fase

| Fase | Objetivo | Arquivos | Banco | Risco | Status |
| ---- | -------- | -------- | ----- | ----- | ------ |
| 0 | Auditar arquitetura, mocks, segurança e funcionalidades | `ROADMAP_ROTA_V2.md` | Auditoria de `schema.sql` | Baixo | ✅ Concluído |
| 1 | Fundação multi-concurso e taxonomia universal | `supabase/migrations/001_multi_exam_foundation.sql`, `supabase/schema.sql`, documentação | organizations, positions, boards, subjects, topics, exams, user_exams e vínculos | Médio | ✅ Concluído — migration aplicada e verificada no Supabase remoto |
| 2 | Edital Engine, upload privado, extração validada e revisão | `api/editals/*`, `api/admin/editals/*`, `lib/ai/*`, `public/analisar-edital.html`, `public/admin.html` | notices, chunks, extraction runs, stages e mapeamentos | Alto | 🟡 Parcial — banco, Vercel, autenticação e APIs validados; extração por IA aguarda `OPENAI_API_KEY` |
| 3 | Question Engine, origens, alternativas e tópicos | API/UI de questões e importador | options, topics, sources, validation | Alto | ✅ Concluído — migration, deploy e E2E autenticado validados em produção |
| 4 | Candidate Model | serviços de respostas/mastery | user_answers, topic_mastery, diagnostics | Alto | ✅ Concluído — migration, suíte, deploy e E2E autenticado validados em produção |
| 5 | Adaptive Engine explicável | `lib/domain/adaptive*`, API e testes | recommendations e reasons | Alto | ❌ Pendente |
| 6 | Planejador e revisão adaptativos | API/UI de plano e revisões | plans, tasks, review_queue | Alto | ❌ Pendente |
| 7 | Rota Score e dashboard real | componentes do dashboard e testes | rota_scores | Médio | ❌ Pendente |
| 8 | Mentor IA com ferramentas e fontes | `lib/ai/mentor*`, endpoint e UI | ai_interactions, citations | Alto | ❌ Pendente |
| 9 | Compatibilidade e oportunidades | serviço, endpoint e UI | índices/materializações se necessários | Médio | ❌ Pendente |
| 10 | Generalizar TAF | serviço e UI condicionada | physical_tests, taf_results | Médio | ❌ Pendente |
| 11 | Landing nacional, aquisição e SEO | rotas públicas, landing e analisador | catálogo publicado | Médio | ❌ Pendente |

## O que manter

- Identidade visual, responsividade, navegação e feedbacks já reconhecíveis.
- PDFs e catálogo PMMG como primeira vertical, com o status de revisão atual.
- Separação explícita entre questões oficiais e autorais/geradas.
- Supabase, RLS, Vercel, endpoint de configuração pública e política de não expor `service_role`.
- Fluxos de questões, simulados, diagnóstico, Caderno de Erros, Radar e TAF como protótipos para evolução.

## O que refatorar

- Marca e conteúdo global para “Rota”; PMMG será uma página/vertical.
- `app.js` em módulos de dados, domínio, API, estado e UI.
- `profiles.exam_cycle` para seleção via `user_exams`.
- Campos textuais `subject`/`topic` para chaves da taxonomia, mantendo-os temporariamente para compatibilidade.
- Eixos e `exams` legados por modelos universais, com migração idempotente do acervo atual.
- Mocks do HTML para estados vazios/demonstração e consultas reais autenticadas.

## O que criar

- Taxonomia universal com códigos estáveis e aliases.
- Modelo multi-concurso e domínio do candidato independente de concurso.
- Migrações versionadas e seeds explicitamente identificados.
- Serviços determinísticos testáveis e uma camada única para IA.
- Autenticação completa, admin protegido, entitlements, analytics interno e observabilidade.
- Estados de loading, erro, vazio, parcial, offline e sem permissão em todos os novos fluxos.

## O que remover

- Nenhuma funcionalidade ou acervo será removido na fundação.
- Após migração validada: retirar `profiles.exam_cycle`, métricas pessoais fictícias e dependência de nomes PMMG no código principal.
- Depoimentos e estatísticas não comprovados não devem aparecer na landing nacional.

## Dependências necessárias

- Fase 1: nenhuma biblioteca nova; PostgreSQL/Supabase existentes bastam.
- Fase 2: validador de schema, parser PDF/OCR, cliente de IA server-side e fila. A escolha será registrada antes da instalação.
- Fases de domínio: runner de testes e TypeScript se a camada serverless permanecer fora de um framework.
- Busca semântica: `pgvector` somente quando embeddings forem implementados; full-text e taxonomia vêm primeiro.

## Migrações de banco necessárias

1. Criar catálogo universal, tópicos hierárquicos e vínculos de concurso (Fase 1).
2. Migrar `exams` legado sem perda e ligar PMMG/CFSD/CFO às novas entidades.
3. Criar edital, extração e revisão administrativa (Fase 2).
4. Normalizar questões e respostas (Fases 3–4).
5. Criar domínio, recomendação, plano, revisão e score (Fases 4–7).
6. Criar auditoria de IA, compatibilidade e TAF genérico (Fases 8–10).

Todas as migrações devem ser idempotentes quando possível, evitar drops na primeira passagem e conter backfill verificável antes de tornar colunas obrigatórias.

## Variáveis de ambiente necessárias

Atuais:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (pública por definição, mas limitada por RLS)

Previstas, apenas no servidor:

- `SUPABASE_SERVICE_ROLE_KEY`
- credencial e modelo do provedor de IA
- configuração do provedor de OCR, se externo
- segredo/rate-limit store quando endpoints públicos forem ativados

Os nomes concretos serão adicionados ao `.env.example` somente na fase que os consumir.

## Ordem segura de implementação

1. Aplicar a fundação multi-concurso sem alterar as tabelas consumidas pelo protótipo.
2. Cadastrar PMMG como vertical e mapear os dados legados para a taxonomia.
3. Implementar autenticação real e separar modo demonstração de dados do candidato.
4. Entregar Edital Engine com revisão humana antes de qualquer automação de plano.
5. Normalizar questões e capturar respostas; então calcular `topic_mastery`.
6. Implementar e testar prioridade, recomendação, plano, revisão e score nessa ordem.
7. Conectar dashboard e Mentor somente a dados reais e fontes rastreáveis.
8. Generalizar TAF e, por último, substituir a landing PMMG pela aquisição nacional.

## Riscos e critérios de saída

- **Migração de dados:** o nome `exams` já significa prova histórica. A Fase 1 deve preservar sua API atual e evitar redefinição destrutiva.
- **Qualidade:** 1.288 questões não possuem gabarito validado; não podem atualizar domínio.
- **Segurança:** nenhum endpoint mutável deve ir a produção sem autenticação, autorização, validação e rate limit proporcional ao risco.
- **IA:** extrações só passam a `approved` após validação de schema e revisão administrativa dos campos críticos.
- **Produto:** Rota Score será “índice de preparação”, nunca probabilidade de aprovação.
- **Estabilidade:** cada fase exige migração revisável, testes das regras críticas e verificação manual do protótipo existente.
