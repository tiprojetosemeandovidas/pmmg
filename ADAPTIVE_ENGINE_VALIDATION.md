# Validação da Fase 5 — Adaptive Engine

## Entrega

- Motor determinístico `adaptive-v1`, independente de IA.
- Prioridade calculada por lacuna de domínio, incerteza, pressão de erros e
  relevância no edital.
- Ação recomendada explícita: estudar a base, resolver questões ou revisar.
- Justificativa textual e fatores numéricos retornados ao candidato.
- Snapshot persistido em `adaptive_recommendations`, protegido por RLS.
- Endpoint autenticado `GET /api/recommendations`.
- Mapa de prioridades do dashboard alimentado por evidências reais.

## Validação em produção

- Migration `006_adaptive_engine.sql` aplicada e verificada no Supabase em
  27/08/2026.
- `npm run check`: lint, typecheck, build e 47 testes aprovados.
- E2E real confirmou diagnóstico com cinco respostas, domínio, recomendações
  ordenadas, fatores explicáveis e justificativa; usuário temporário removido.
- Produção: `https://rota-pmmg.vercel.app`.

## Auditoria posterior

Foram corrigidos dois defeitos antes da Fase 6: relevância zero recebia o
fallback médio indevidamente e a atualização do snapshot ocorria em duas
gravações sujeitas a concorrência. A migration `007` introduziu substituição
transacional; `GET` passou a ser somente leitura e `POST` passou a representar
explicitamente o recálculo.

## Fórmula inicial

O score usa 55% da lacuna de domínio, até 15 pontos de incerteza, até 20 pontos
pela proporção de erros e até 10 pontos de relevância no edital. A fórmula é
limitada entre 0 e 100 e versionada como `adaptive-v1`.
