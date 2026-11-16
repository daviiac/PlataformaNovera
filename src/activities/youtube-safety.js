'use strict';

/**
 * Confere no YouTube, antes de o admin cadastrar um vídeo, se ele é próprio para todas as idades.
 *
 * Bloqueia: vídeo com restrição de idade (18+), vídeo que o YouTube não marca como "seguro para
 * família", vídeo que não pode ser incorporado em outros sites, privado ou removido.
 * Se o YouTube não responder (rede fora), o cadastro segue — a revisão humana continua valendo.
 */

const AGE_RE = /confirm your age|age-restricted|inappropriate for some users|confirme sua idade/i;

/** Lê a página do vídeo e devolve { ok, reason }. `ok: null` = não deu para saber. */
function analyzeWatchPage(html) {
  const m = String(html || '').match(/var ytInitialPlayerResponse = (\{.+?\});(?:var|<\/script>)/s);
  if (!m) return { ok: null, reason: 'Não foi possível ler a página do vídeo.' };
  let pr;
  try { pr = JSON.parse(m[1]); } catch { return { ok: null, reason: 'Não foi possível ler a página do vídeo.' }; }
  const ps = pr.playabilityStatus || {};
  const why = `${ps.reason || ''} ${ps.errorScreen?.playerErrorMessageRenderer?.subreason?.simpleText || ''}`;
  if (AGE_RE.test(why) || ps.desktopLegacyAgeGateReason) {
    return { ok: false, reason: 'Este vídeo tem restrição de idade no YouTube (18+). Escolha outro vídeo.' };
  }
  if (ps.status && ps.status !== 'OK') {
    return { ok: false, reason: 'Este vídeo não está disponível (privado, removido ou bloqueado). Escolha outro vídeo.' };
  }
  if (ps.playableInEmbed === false) {
    return { ok: false, reason: 'O dono deste vídeo não permite que ele seja exibido em outros sites. Escolha outro vídeo.' };
  }
  const mf = pr.microformat?.playerMicroformatRenderer || {};
  if (mf.isFamilySafe === false) {
    return { ok: false, reason: 'O YouTube não classifica este vídeo como próprio para todas as idades. Escolha outro vídeo.' };
  }
  return { ok: true };
}

async function checkVideo(videoId) {
  if (process.env.YT_SAFETY_CHECK === 'off') return { ok: true };
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
      headers: {
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        cookie: 'CONSENT=YES+1',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: null, reason: `YouTube respondeu ${r.status}.` };
    return analyzeWatchPage(await r.text());
  } catch (err) {
    return { ok: null, reason: err.message };
  }
}

module.exports = { analyzeWatchPage, checkVideo };
