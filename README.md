# Plataforma Novera

Plataforma web de estudo de inglês com nivelamento (A1, A2, B2), trilhas de estudo por nível e área administrativa para publicar materiais.

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Servidor | Node.js 22 + Express 4 | Simples, maduro, uma linguagem só no projeto |
| Banco | SQLite embutido do Node (`node:sqlite`) | Zero instalação e sem compilação nativa no Windows; o schema é SQL padrão e migra fácil para PostgreSQL |
| Senhas | bcrypt (custo 12, `bcryptjs`) | Hash lento com salt; nunca há senha em texto puro no banco |
| Sessão | Token aleatório de 256 bits em cookie `httpOnly` + `SameSite=Strict` | Só o hash SHA-256 do token fica no banco; logout invalida no servidor |
| Upload | `multer` com lista branca de extensões e nomes aleatórios em disco | Arquivos ficam fora da pasta pública |
| Frontend | HTML + CSS + JS puro | Sem build; CSP restritiva (`script-src 'self'`) |

## Como rodar

Requisito: **Node.js 22.13 ou superior**.

```bash
npm install
```

```bash
npm run seed
```

```bash
npm start
```

Acesse http://localhost:3000.

O `npm run seed` lê `ADMIN_USERNAME` / `ADMIN_PASSWORD` do arquivo `.env`, grava **apenas o hash bcrypt** da senha e cria 12 módulos iniciais (4 por trilha). Ele é idempotente: rodar de novo não altera nada. Para trocar a senha do admin, edite o `.env` e rode `npm run seed:reset-admin` (isso também encerra as sessões abertas do admin).

> O `.env` está no `.gitignore`. Use o `.env.example` como modelo em outros ambientes e, depois do seed, a senha pode ser removida do `.env` — o banco só precisa do hash.

Testes de integração (sobem o servidor com banco temporário):

```bash
npm test
```

## Perfis e fluxo

**Aluno**
1. Cria conta (nome, e-mail, senha ≥ 8 caracteres) ou entra com e-mail e senha.
2. Sem nível definido, é levado ao **teste de nivelamento**: 15 questões de múltipla escolha de gramática e vocabulário, 5 por faixa (A1, A2, B2).
3. A correção é feita **no servidor** (as respostas corretas nunca vão para o navegador). Pontuação ponderada — A1 = 1 ponto, A2 = 2, B2 = 3 (máx. 30):
   - 0–11 → **A1** · 12–21 → **A2** · 22–30 → **B2**
4. O nível é gravado no perfil e o aluno vai para a sua trilha. Ele pode navegar pelas outras trilhas (com aviso de que não é o seu nível) e refazer o nivelamento quando quiser.
5. Em cada módulo, o aluno abre PDFs, áudios e vídeos direto na página ou baixa qualquer material.

**Administrador** (login `davi`, criado pelo seed)
- Entra pelo mesmo formulário, usando o nome de usuário no campo "E-mail ou usuário".
- Painel em `/admin`: cria e exclui módulos em cada trilha, envia arquivos associando trilha + módulo (com barra de progresso), remove materiais e vê a lista de alunos com o nível de cada um.

## Segurança do controle de acesso

- **Todas as rotas `/api/admin/*` passam por `requireAdmin` no servidor**, antes até do `multer`: um aluno que chame a API diretamente recebe `403` e nenhum byte é gravado em disco (coberto pelos testes).
- A página `/admin` e o script `/admin/admin.js` ficam fora de `public/` e só são entregues para sessões de admin; outros perfis são redirecionados.
- O cadastro público sempre cria perfil `student`; não existe rota para promover usuários.
- Materiais são servidos por `/api/materials/:id/download`, que exige sessão; o tipo MIME vem da lista branca do servidor, não do que o navegador enviou; nomes em disco são UUIDs (sem path traversal).
- Login com limite de tentativas por IP + usuário e comparação de hash mesmo quando o usuário não existe (não revela contas existentes).
- Cabeçalhos: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`.

## Estrutura

```
src/
  server.js          Express, cabeçalhos de segurança, rotas, páginas protegidas
  config.js          Porta, caminhos, limites
  db.js              Conexão SQLite + schema
  auth.js            Hash de senha, sessões, requireAuth / requireAdmin / requirePlacement
  placement.js       Banco de questões e correção do nivelamento
  tracks.js          Metadados das trilhas e módulos iniciais
  uploads.js         Multer, lista branca de tipos, armazenamento
  routes/            auth, placement, tracks, materials, admin
scripts/seed.js      Cria o admin (hash) e os módulos padrão
public/              Login/cadastro, nivelamento, trilha (CSS/JS)
views/               Painel admin (servido apenas para admin)
tests/api.test.js    Testes de integração
data/                Banco SQLite (gerado)
storage/uploads/     Arquivos enviados (gerado)
```

## Produção

- Rode atrás de um proxy com HTTPS e defina `NODE_ENV=production` (cookie `Secure`) e `TRUST_PROXY=1`.
- Faça backup de `data/` e `storage/uploads/` juntos.
- Ajuste `MAX_UPLOAD_MB` no `.env` (e o limite de corpo do proxy) conforme o tamanho dos vídeos.
- Para várias instâncias, troque o SQLite por PostgreSQL e o disco local por um storage de objetos (S3 ou similar); as rotas não mudam.
