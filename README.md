# Rota PMMG

Protótipo responsivo de uma plataforma adaptativa de preparação para candidatos da PMMG, construído a partir do blueprint do piloto.

## Executar

Abra `index.html` diretamente no navegador ou inicie um servidor local:

```bash
python3 -m http.server 8000
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

## Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute `supabase/schema.sql`.
3. Copie a Project URL e a chave `anon` pública em Project Settings → API.
4. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` na Vercel.

O esquema ativa Row Level Security e isola perfil, sessões e prioridades pelo usuário autenticado. Nunca exponha a chave `service_role` no frontend.

## Vercel

Importe este repositório na Vercel e configure as duas variáveis acima para Production, Preview e Development. O endpoint `/api/config` entrega somente a URL e a chave pública necessárias ao navegador.

Para deploy via CLI, depois de instalar e autenticar a Vercel CLI:

```bash
vercel link
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel --prod
```
