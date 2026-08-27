# Validação da Fase 4 — Candidate Model

## Entrega

- Respostas autenticadas e imutáveis em `user_answers`.
- Idempotência por usuário para evitar dupla contabilização em retries.
- Gabarito mantido server-side e revelado somente após a tentativa válida.
- Atualização transacional de `topic_mastery` por tópico associado à questão.
- Domínio, confiança, sequência e tempo médio derivados de evidências reais.
- Sessões diagnósticas com contagem, resultado e tópicos prioritários.
- RLS de leitura por proprietário; escrita somente pela API com `service_role`.
- Endpoints para resposta, domínio e ciclo de diagnóstico.
- Frontend preparado para corrigir questões reais pela API sem receber gabarito antecipado.

## Critérios de saída

1. Migration `004_candidate_model.sql` e verificador aplicados no Supabase remoto.
2. `npm run check` aprovado integralmente.
3. E2E autenticado confirma resposta, idempotência, domínio e diagnóstico.
4. Conta e conteúdo temporários do E2E removidos ao final.
5. Deployment de produção responde com autenticação e autorização esperadas.

## Modelo inicial

`candidate-v1` usa acurácia acumulada por tópico e confiança crescente até 20
evidências. É deliberadamente explicável; ponderação temporal e dificuldade
pertencem à evolução do Candidate Model, antes do Adaptive Engine da Fase 5.
