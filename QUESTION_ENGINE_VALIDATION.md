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

## Aplicação manual

1. Execute `supabase/migrations/003_question_engine.sql` no SQL Editor após `002_edital_engine.sql`.
2. Execute `supabase/verify/003_question_engine_check.sql`.
3. Faça novo deploy na Vercel; não há novas variáveis de ambiente.
4. Importe um lote de teste como `content_reviewer`, valide uma questão e confirme sua exibição autenticada.

## Limite da fase

Respostas, revelação segura do gabarito, histórico do candidato e atualização de `topic_mastery` pertencem à Fase 4. Até lá, a API de leitura deliberadamente não retorna a resposta correta.
