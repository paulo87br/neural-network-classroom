# Rede Neural ao Vivo

Aplicação educacional para demonstrar, em uma projeção, como uma rede neural convolucional reconhece dígitos desenhados por alunos em um tablet.

## Telas

- `/teacher?room=AULA-IA` — painel do professor, QR Code e controles.
- `/display?room=AULA-IA` — visualização 3D para o projetor.
- `/input?room=AULA-IA` — área de desenho para o tablet.

Todas as telas precisam usar o mesmo código de sala.

## Desenvolvimento

Requisitos: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com a URL e a chave **publishable** do Supabase. Nunca utilize uma chave `service_role` ou secret no navegador.

## Supabase

A aplicação usa apenas canais públicos do Supabase Realtime Broadcast. Não cria tabelas, usuários ou registros no banco. O tópico tem o formato `nn-classroom:<CODIGO_DA_SALA>`.

Variáveis necessárias:

```env
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Sem essas variáveis, a aplicação entra em modo local para demonstrações com abas abertas no mesmo navegador.

## Deploy na Vercel

1. Importe este repositório na Vercel.
2. Use as variáveis criadas pela integração do Supabase: `SUPABASE_URL` e
   `SUPABASE_PUBLISHABLE_KEY`. O build expõe apenas esses dois valores
   públicos; nunca use `SUPABASE_SECRET_KEY` ou `service_role`.
3. Faça o deploy.
4. Abra primeiro `/teacher` e use o QR Code para conectar o tablet.

## Atalhos da projeção

- `F`: tela cheia.
- `Enter`: processar novamente o desenho atual.
- `Espaço`: limpar a atividade.

## Créditos e licença

O modelo, seus pesos e a inspiração visual derivam de [CNN Visualization](https://github.com/okdalto/CNN-visualization), de Kim Seonghyun (`okdalto`), distribuído sob LGPL-3.0. A licença original está em `licenses/CNN-visualization-LGPL-3.0.txt`.

Este repositório mantém a mesma licença LGPL-3.0. Consulte `LICENSE` e `THIRD_PARTY_NOTICES.md`.
