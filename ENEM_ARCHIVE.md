# Acervo e inteligência ENEM

O diretório `Concursos/Enem/ENEM_1998_2025` é a fonte local do banco histórico. O fluxo preserva o PDF, a URL registrada no índice, o checksum SHA-256, o ano, o dia, a página e o gabarito utilizado.

## Preparação e importação

1. Extraia e valide todos os documentos:

   ```bash
   npm run enem:prepare
   ```

   O resultado local fica em `Concursos/Enem/ENEM_1998_2025/.prepared`. O arquivo `report.json` resume a cobertura e separa itens prontos tecnicamente dos que precisam de revisão.

2. Aplique a migration `20260901120000_enem_archive_knowledge.sql` no Supabase.

3. Importe o resultado com credenciais server-side:

   ```bash
   SUPABASE_URL=https://seu-projeto.supabase.co \
   SUPABASE_SECRET_KEY=sb_secret_... \
   npm run enem:import
   ```

O importador é idempotente: documentos usam o SHA-256 como identidade; trechos usam documento, página e posição; itens usam ano, dia, número e variante de idioma.

Também é aceita a variável legada `SUPABASE_SERVICE_ROLE_KEY`. Nunca use a chave `publishable` ou `anon` neste importador.

## Como o material é usado

- `enem_archive_documents`: inventário dos 88 PDFs e sua proveniência.
- `enem_archive_chunks`: texto pesquisável por página para recuperação de contexto.
- `enem_archive_items`: questões estruturadas, alternativas, gabarito, área e confiança da extração.
- Mentor: quando o perfil é ENEM, recupera itens históricos relacionados à pergunta do aluno.
- Central de questões: a aba **Inteligência ENEM** recupera exemplos por área, tópico e período e solicita questões inéditas à OpenAI.

Questões geradas entram como candidatas com `source_type = ai_generated`, referências históricas e modelo registrados. Elas nunca recebem o selo de questão oficial e só são publicadas após revisão humana.

## Qualidade da extração

PDFs antigos usam fontes e layouts que nem sempre preservam letras de alternativas na camada textual. Todo o conteúdo continua disponível nos trechos pesquisáveis, mas itens de baixa confiança ficam em `needs_review` e não alimentam a geração automática. Imagens, gráficos e mapas também reduzem a confiança para exigir conferência visual no PDF original.
