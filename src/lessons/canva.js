/**
 * Links do Canva das aulas.
 *
 * Um link de design do Canva tem o formato /design/<ID>/<CHAVE>/<modo>. A CHAVE é o que
 * dá acesso: a chave do link de edição (/edit) deixa qualquer pessoa EDITAR o material,
 * mesmo que o endereço seja trocado para /view. Por isso só aceitamos o "Link público de
 * visualização" (Compartilhar → Link público de visualização), que tem uma chave própria
 * que só permite assistir. Esse link é mostrado dentro da plataforma no modo ?embed.
 */
const DESIGN_RE = /^\/design\/([A-Za-z0-9_-]{6,40})\/([A-Za-z0-9_-]{6,60})\/([a-z]+)\/?$/;

const EDIT_ERROR = 'Esse é o link de EDIÇÃO do Canva (termina em /edit) e deixaria o aluno editar o material. '
  + 'No Canva, abra a apresentação → Compartilhar → "Link público de visualização" e cole esse link.';

function isCanvaHost(host) {
  return host === 'canva.com' || host.endsWith('.canva.com');
}

/** canva.link/… é um encurtador: segue o redirecionamento (só para o próprio Canva). */
async function resolveShortLink(u) {
  let current = u;
  for (let hop = 0; hop < 4 && current.hostname === 'canva.link'; hop += 1) {
    const r = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    const loc = r.headers.get('location');
    if (!loc) break;
    current = new URL(loc, current);
  }
  return current;
}

/**
 * Valida e padroniza o link de uma aula.
 * @returns {Promise<{ url: string } | { error: string }>}
 */
async function normalizeLessonUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return { error: 'Cole um link completo (https://…).' }; }
  if (u.protocol !== 'https:') return { error: 'Use um link https://.' };

  if (u.hostname === 'canva.link') {
    try { u = await resolveShortLink(u); } catch {
      return { error: 'Não consegui abrir esse link curto do Canva. Cole o link completo (https://www.canva.com/design/…/view).' };
    }
  }
  if (!isCanvaHost(u.hostname)) return { url: u.toString() };

  const m = u.pathname.match(DESIGN_RE);
  if (!m) return { error: 'Link do Canva não reconhecido. Use o "Link público de visualização" (https://www.canva.com/design/…/view).' };
  const [, id, key, mode] = m;
  if (mode === 'edit') return { error: EDIT_ERROR };
  return { url: `https://www.canva.com/design/${id}/${key}/view` };
}

/** Endereço para mostrar a apresentação dentro da plataforma (só links de visualização). */
function embedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const m = u.hostname === 'www.canva.com' && u.pathname.match(DESIGN_RE);
    if (!m || m[3] !== 'view') return null;
    return `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed`;
  } catch { return null; }
}

module.exports = { normalizeLessonUrl, embedUrl, EDIT_ERROR };
