# Plataforma Novera

Plataforma web de estudo de inglês com nivelamento (A1, A2, B2), trilhas de estudo por nível e área administrativa para publicar materiais.

## Stack

| Camada | Produção (Vercel) | Desenvolvimento / testes |
|---|---|---|
| Servidor | Express 4 como função serverless (`api/index.js`) | `npm start` (`src/server.js`) |
| Páginas estáticas | CDN da Vercel (`public/`) | Express |
| Banco | Postgres do **Supabase** (`DATABASE_URL`) | PGlite — Postgres embutido, sem instalar nada (`data/pglite`) |
| Arquivos | **Supabase Storage**, bucket privado | Disco local (`storage/uploads`) |
| Senhas | bcrypt (custo 12) | idem |
| Sessão | Token aleatório em cookie `httpOnly` + `SameSite=Strict` + `Secure`; só o hash SHA-256 fica no banco | idem |

### Por que o upload vai direto para o Supabase

Na Vercel cada requisição a uma função aceita no máximo **4,5 MB**. Por isso o painel do admin envia o arquivo **direto do navegador para o Supabase Storage**:

1. `POST /api/admin/uploads` — o servidor confere se é admin, valida tipo, tamanho e módulo e devolve uma **URL de upload assinada** (uso único).
2. O navegador faz `PUT` do arquivo nessa URL, com barra de progresso.
3. `POST /api/admin/materials` — o servidor confirma no Storage que o arquivo chegou e registra o material.

Downloads e vídeos usam **URLs assinadas temporárias**, geradas só para usuários logados; o bucket é privado.

## Publicar na Vercel + Supabase

### 1. Supabase

1. Crie um projeto em https://supabase.com (região **South America (São Paulo)** para menor latência).
2. Anote:
   - **Connect → Transaction pooler** (porta **6543**): é o `DATABASE_URL`. Troque `[YOUR-PASSWORD]` pela senha do banco.
   - **Settings → API**: `Project URL` → `SUPABASE_URL` e a chave **service_role** (secreta) → `SUPABASE_SERVICE_ROLE_KEY`.
3. No seu computador, coloque esses valores no `.env` (junto com `ADMIN_USERNAME` e `ADMIN_PASSWORD`) e rode:

   ```bash
   npm run seed
   ```

   Isso cria as tabelas, o administrador (só o hash da senha), os 12 módulos iniciais e o bucket privado `materiais`.

### 2. Vercel

1. **Add New → Project** e importe o repositório `noveraacademyoficial/PlataformaNovera`.
2. Framework Preset: **Other** (o `vercel.json` já define tudo; não há build).
3. Em **Environment Variables**, cadastre:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | URL do Transaction pooler (porta 6543) |
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave service_role |
   | `SUPABASE_BUCKET` | `materiais` |
   | `MAX_UPLOAD_MB` | `50` |

   `ADMIN_USERNAME` / `ADMIN_PASSWORD` **não** precisam ir para a Vercel — o admin já foi criado pelo seed.
4. **Deploy**. Cada `git push` na `main` publica uma nova versão.

> O plano Hobby da Vercel é para uso não comercial; para a escola, use o plano Pro.
> No plano gratuito do Supabase cada arquivo pode ter até 50 MB e o total é 1 GB.

## Rodar localmente

Requisito: **Node.js 22**.

```bash
npm install
```

```bash
npm run seed
```

```bash
npm start
```

Acesse http://localhost:3000. Sem `DATABASE_URL`/`SUPABASE_*` no `.env`, o projeto usa o Postgres embutido (PGlite) e disco local — nada para instalar. Preenchendo essas variáveis, o ambiente local passa a usar o Supabase de verdade.

Para trocar a senha do admin: edite o `.env` e rode `npm run seed:reset-admin` (encerra as sessões abertas do admin).

Testes (Postgres em memória, sem tocar no Supabase):

```bash
npm test
```

## Perfis e fluxo

**Aluno**
1. Cria conta (nome, e-mail, senha ≥ 8 caracteres) ou entra com e-mail e senha.
2. Sem nível definido, faz o **teste de nivelamento**: 15 questões de gramática e vocabulário, 5 por faixa.
3. A correção é feita **no servidor**. Pontuação ponderada (A1 = 1, A2 = 2, B2 = 3; máx. 30): 0–11 → **A1** · 12–21 → **A2** · 22–30 → **B2**.
4. Vai para a trilha do seu nível; pode explorar as outras e refazer o nivelamento.
5. Abre os materiais no visualizador (PDF, áudio, vídeo, Word, PowerPoint, Excel, ODT, TXT) ou baixa.

**Administrador** (login por nome de usuário, criado pelo seed)
- Painel em `/admin`: cria/exclui módulos, envia arquivos para trilha + módulo, visualiza e remove materiais, vê os alunos e seus níveis.

## Segurança do controle de acesso

- Todas as rotas `/api/admin/*` passam por `requireAdmin` **no servidor**: sem sessão de admin não se obtém URL de upload nem se registra material (coberto pelos testes).
- A página `/admin` e o script dela ficam fora de `public/` e só são entregues a admins.
- O cadastro público sempre cria perfil `student`; não há rota para promover usuários.
- A chave `service_role` do Supabase só existe no servidor; o navegador recebe apenas URLs assinadas de curta duração.
- Pré-visualizações de documentos são HTML estático com CSP `sandbox` e `default-src 'none'` (nenhum script roda).
- Login com limite de tentativas e comparação de hash mesmo quando o usuário não existe.

## Estrutura

```
api/index.js         Entrada da função serverless na Vercel
vercel.json          Estáticos via CDN + rewrite do resto para a função
src/
  app.js             Express: segurança, rotas, páginas protegidas
  server.js          Servidor local (npm start)
  config.js          Variáveis de ambiente e limites
  db.js              Postgres (pg no Supabase / PGlite local) + schema
  storage.js         Supabase Storage / disco local, URLs assinadas
  auth.js            Hash de senha, sessões, requireAuth / requireAdmin
  placement.js       Questões e correção do nivelamento
  preview.js         Conversão de docx/pptx/xlsx/odt/txt para pré-visualização
  routes/            auth, placement, tracks, materials, admin
scripts/seed.js      Tabelas, admin, módulos padrão e bucket
public/              Login/cadastro, nivelamento, trilha
views/               Painel admin (servido apenas para admin)
tests/               Testes de integração
```
