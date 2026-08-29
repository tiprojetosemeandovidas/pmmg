# ROADMAP ROTA V2

## 1. Arquitetura atual

O projeto foi migrado do protótipo estático para uma aplicação Next.js:

- framework: Next.js 16 com App Router, React 19 e TypeScript estrito;
- interface: rotas em `app/` e componentes reutilizáveis em `components/`;
- domínio: motor adaptativo puro em `lib/domain/adaptive-engine.ts`;
- backend: Route Handlers do Next.js, iniciando por `/api/health`;
- autenticação: clientes Supabase browser/server preparados; fluxo público ainda pendente;
- banco: schema inicial em `supabase/schema.sql`;
- dados: catálogo JSON com 32 provas e 1.288 questões PMMG extraídas;
- persistência atual: estado demonstrativo local, com schema Supabase preparado para sincronização;
- IA: não implementada;
- qualidade: lint, typecheck, testes unitários e build de produção configurados.

O protótipo demonstra dashboard, plano, desempenho, Radar, questões, simulados, Caderno de Erros, TAF e edital. A maior parte das métricas é estática. As questões oficiais extraídas não possuem gabarito revisado e, corretamente, não contam pontos.

## 2. Problemas encontrados

- PMMG está hardcoded na interface, no catálogo e no modelo `profiles.exam_cycle`.
- O conhecimento é armazenado por disciplina textual, sem taxonomia ou identificadores estáveis.
- Não existem respostas do usuário, domínio por tópico, diagnóstico persistente ou recomendações.
- O plano é um calendário fixo e não reage às respostas.
- Radar, TAF, desempenho e insights usam valores demonstrativos.
- O onboarding coleta poucos dados e não contempla a jornada de escolha do concurso.
- O Caderno de Erros é local ao dispositivo.
- Não há fluxo real de cadastro, upload de edital, administração, IA ou controle de assinatura.
- O arquivo principal concentra interface, dados e regras de negócio.
- Não há testes para as futuras regras críticas.

## 3. Arquitetura proposta

Evoluir de forma incremental em duas superfícies:

1. **Experiência funcional tipada:** o motor determinístico em `lib/domain/adaptive-engine.ts` calcula domínio, confiança, prioridade, Rota Score, próxima ação e plano semanal sem depender da interface ou de IA.
2. **Persistência de produção:** Supabase passa a armazenar concursos, tópicos, respostas, domínio, planos, revisões, recomendações e progresso. A interface continua funcionando em modo demonstração quando não houver sessão, deixando esse estado claramente identificado como local.

Chamadas futuras de IA ficarão no servidor. Cálculos determinísticos não serão enviados ao modelo.

## 4. Princípios do primeiro MVP

- Entregar o ciclo completo antes de ampliar o catálogo.
- Começar com editais e questões validados; upload aberto entra depois da revisão administrativa.
- Exibir confiança das estimativas e nunca probabilidade de aprovação.
- Separar questão oficial, licenciada, autoral e gerada por IA.
- Usar gamificação para incentivar consistência, revisão e retorno, não apenas horas acumuladas.
- Tratar pré-edital, edital publicado e reta final como modos diferentes.

## 5. Plano de execução

| Fase | Objetivo | Arquivos | Banco | Risco | Status |
| --- | --- | --- | --- | --- | --- |
| 0 | Auditoria e roadmap | `ROADMAP_ROTA_V2.md` | Nenhum | Baixo | Concluído |
| 0.5 | Migração Next.js | `app/`, `components/`, `lib/`, configuração e testes | Configuração Supabase SSR | Alto | Concluído |
| 1 | Motor adaptativo e onboarding ampliado | `lib/domain`, `components`, rotas `app/app` | Estruturas espelhadas no schema | Médio | Concluído no MVP |
| 2 | Fundação multi-concurso | Interface e catálogo | `exams`, `subjects`, `topics`, `user_exams`, `exam_topics` | Médio | Base concluída |
| 3 | Candidate Model e diagnóstico | Motor e interface | `diagnostics`, `user_answers`, `topic_mastery` | Alto | MVP local concluído |
| 4 | Plano, recomendações e revisão semanal | Motor e interface | `study_plans`, `study_tasks`, `recommendations`, `review_queue` | Alto | MVP local concluído |
| 5 | Autenticação completa e sincronização | Interface e API | perfis, `candidate_states` e políticas RLS | Alto | Concluído e publicado |
| 6 | Edital Engine com revisão administrativa | novas rotas e funções server-side | `notice_submissions`, storage privado, `notices` e auditoria | Alto | Concluído e publicado |
| 7 | Mentor IA com ferramentas e fontes | API server-side | `ai_interactions`, fontes e auditoria | Alto | Concluído e publicado |
| 8 | Multi-concurso, compatibilidade e oportunidades | novas páginas | relações de tópicos e concursos | Médio | Concluído e publicado |
| 9 | TAF genérico e gamificação avançada | interface e motor | testes físicos, resultados e conquistas | Médio | Concluído e publicado |
| 10 | Operação segura do piloto | observabilidade, limites, admin e E2E | planos, consumo e eventos operacionais | Alto | Publicado; E2E autenticado pendente |
| 11 | Vertical ENEM 2026 | onboarding, diagnóstico, calendário e motor isolado por rota | trilha, taxonomia e datas oficiais | Médio | Publicado |
| 12 | Central de conhecimento | pesquisa Perplexity, cadastro manual, proveniência e revisão | fontes, lotes e questões candidatas | Alto | Publicado |

## O que manter

- identidade visual e componentes do protótipo;
- acervo de provas e pipeline de extração;
- distinção entre questões demonstrativas e oficiais;
- configuração segura da chave pública do Supabase;
- políticas RLS já iniciadas;
- Caderno de Erros, Radar e TAF como conceitos de produto.

## O que refatorar

- separar regras adaptativas de manipulação do DOM;
- substituir valores demonstrativos por estado derivado;
- generalizar concurso, edital, disciplina e tópico;
- tornar onboarding progressivo;
- persistir respostas e revisões por usuário;
- transformar plano e Radar em cálculos explicáveis.

## O que criar

- Candidate Model com domínio e confiança;
- motor de prioridade e próxima melhor ação;
- modos pré-edital, edital publicado e reta final;
- ciclo semanal de avaliação e replanejamento;
- XP, nível e missões baseados em comportamento saudável;
- taxonomia universal;
- trilha de auditoria de recomendações;
- fluxo administrativo para validar editais e questões.

## O que remover

- estatísticas fictícias apresentadas como se fossem pessoais;
- dependência estrutural da PMMG;
- regras de produto misturadas diretamente à interface;
- `localStorage` como fonte final de verdade para progresso autenticado.

## Dependências necessárias

O runtime de produção agora é Next.js com React, TypeScript, Supabase SSR, Zod, ESLint e Vitest. OCR, filas e provedor de IA só serão adicionados quando o fluxo principal persistente estiver validado.

## Migrações de banco necessárias

- perfis de candidato e preferências;
- bancas, cargos, disciplinas e tópicos;
- associação entre concursos e tópicos;
- respostas, domínio e confiança;
- diagnósticos;
- planos, tarefas e sessões;
- revisões e recomendações;
- progresso semanal e conquistas;
- editais e seus estados de validação.

## Variáveis de ambiente necessárias

Agora:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Futuramente, apenas no servidor:

- credencial do provedor de IA;
- configuração de armazenamento de editais;
- limites de upload e de uso do Mentor.

## Ordem segura de implementação

1. Tornar o ciclo adaptativo funcional com dados demonstrativos identificados.
2. Migrar esse estado para Supabase e concluir autenticação.
3. Validar e publicar um pequeno conjunto de concursos/editais.
4. Implementar upload e revisão de edital.
5. Adicionar IA somente nos pontos não determinísticos.
6. Expandir catálogo, multi-concurso, TAF e aquisição.

## Critérios do primeiro corte

- onboarding salva objetivo, estágio, disponibilidade e preferências;
- diagnóstico atualiza domínio e confiança;
- toda resposta recalcula prioridade e plano;
- dashboard exibe recomendação explicada por fatores reais;
- pré-edital funciona sem data de prova;
- revisão semanal gera uma nova rota;
- estado de demonstração não é apresentado como dado definitivo;
- questões oficiais sem gabarito continuam sem pontuar.
