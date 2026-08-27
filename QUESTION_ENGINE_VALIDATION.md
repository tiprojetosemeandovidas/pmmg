# Validação da Fase 3 — Question Engine

## Entrega local

- Migration aditiva e reaplicável em `supabase/migrations/003_question_engine.sql`.
- Alternativas normalizadas sem remover o JSON legado.
- Relação muitos-para-muitos entre questões e tópicos universais.
- Origem explícita para conteúdo oficial, licenciado, público, autoral ou gerado por IA.
- Backfill conservador: somente nomes de tópico com correspondência exata e não ambígua são ligados automaticamente.
- Busca textual em português preparada com `tsvector` e índice GIN; embeddings ficam fora desta fase.
- Importação administrativa autenticada e revisão obrigatória antes da publicação.
- API autenticada entrega apenas questões publicadas e validadas e não expõe `correct_option`.
- Interface distingue visualmente a origem e usa o banco quando há sessão, preservando o acervo local como fallback.

## Aplicação em produção

- Migrações `001`, `002` e `003` aplicadas ao projeto Supabase `pmmg` em 27/08/2026.
- Verificadores das Fases 2 e 3 executados sem erro no banco remoto.
- Produção publicada na Vercel com Supabase URL, chave anônima e `service_role` sincronizadas como variáveis sensíveis.
- E2E validado com usuário temporário: login, leitura de questões, editais, papel `content_reviewer` e fila administrativa; a conta temporária foi removida ao final.
- URL canônica desta implantação: `https://rota-pmmg.vercel.app`.

## Limite da fase

Respostas, revelação segura do gabarito, histórico do candidato e atualização de `topic_mastery` pertencem à Fase 4. Até lá, a API de leitura deliberadamente não retorna a resposta correta.
