# Validação da Fase 6 — Plano e revisões adaptativas

## Entrega

- Plano semanal `planner-v1` gerado a partir das recomendações ativas.
- Distribuição da meta semanal do perfil em tarefas de estudo, questões e revisão.
- Motivo da recomendação preservado em cada tarefa.
- Conclusão de tarefa autenticada e persistida.
- Caderno de Erros server-side alimentado automaticamente por respostas erradas.
- Revisões espaçadas em 1, 7, 15 e 30 dias.
- Tabelas `study_plans`, `plan_tasks` e `review_queue` com RLS por proprietário.
- RPCs transacionais para substituir o plano semanal e avançar uma revisão.
- Dashboard e Caderno de Erros conectados às APIs reais.

## Validação

- Migrations `007` e `008` aplicadas e verificadas no Supabase em 27/08/2026.
- `npm run check`: lint, typecheck, build e 51 testes aprovados.
- E2E de produção confirmou recálculo adaptativo, plano com tarefas explicadas,
  conclusão de tarefa, fila criada após erro e avanço do intervalo de revisão.
- Usuário temporário removido ao final.
- Produção: `https://rota-pmmg.vercel.app`.
