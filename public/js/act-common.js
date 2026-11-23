/* Utilitários das atividades: correção de respostas, voz em inglês e player do YouTube. */
const Act = (() => {
  // ---------------------------------------------------------------- correção
  const CONTRACTIONS = [
    [/\bcan't\b|\bcannot\b/g, 'can not'],
    [/\bwon't\b/g, 'will not'],
    [/\bshan't\b/g, 'shall not'],
    [/\b(\w+)n't\b/g, '$1 not'],
    [/\bi'm\b/g, 'i am'],
    [/\b(you|we|they|who|what)'re\b/g, '$1 are'],
    [/\b(he|she|it|that|there|here|what|where|who|how)'s\b/g, '$1 is'],
    [/\b(i|you|we|they|could|should|would|who)'ve\b/g, '$1 have'],
    [/\b(i|you|he|she|it|we|they|that|there)'ll\b/g, '$1 will'],
    [/\b(i|you|he|she|it|we|they)'d\b/g, '$1 would'],
    [/\blet's\b/g, 'let us'],
  ];

  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  /** 0–99 por extenso ("11" → "eleven", "25" → "twenty five"), para aceitar número em dígitos. */
  const numberWords = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);

  /** Normaliza para comparar: minúsculas, aspas retas, contrações expandidas, números por extenso, sem pontuação. */
  function normalize(text) {
    let s = String(text || '').toLowerCase()
      .replace(/[‘’´`]/g, "'")
      .replace(/[“”]/g, '"');
    for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
    s = s.replace(/\b(\d{1,2})\b(?!:)/g, (m, d) => numberWords(Number(d))).replace(/-/g, ' ');
    return s
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9' ]+/g, ' ')
      .replace(/'/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const same = (a, b) => normalize(a) === normalize(b);

  /** Compara palavra a palavra e devolve HTML com as palavras certas/erradas da resposta. */
  function wordDiff(answer, expected) {
    const exp = normalize(expected).split(' ');
    const got = normalize(answer).split(' ').filter(Boolean);
    return got.map((w, i) => `<span class="${w === exp[i] ? 'w-ok' : 'w-bad'}">${Novera.esc(w)}</span>`).join(' ');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------------------------------------------------------------- voz (TTS)
  const synth = window.speechSynthesis || null;
  let voicesCache = null;

  // Vozes "de brincadeira" ou muito robóticas que alguns aparelhos (Mac/iPhone) trazem.
  const ROBOTIC = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|junior|pipe organ|organ|trinoids|whisper|zarvox|fred|ralph|kathy|superstar|grandma|grandpa|rocko|shelley|sandy|flo\b|eddy|reed|jester|wobble|novelty/i;

  /**
   * Nota da voz: quanto mais natural, maior. Prioriza as vozes neurais/naturais
   * (Edge "Online (Natural)", iPhone "Enhanced/Premium", Android "network", Google do Chrome)
   * e deixa por último as antigas do Windows e as robóticas.
   */
  function voiceScore(v) {
    const n = v.name;
    let s = 0;
    if (/natural|neural|premium|enhanced|siri/i.test(n)) s += 8;
    if (/online|network/i.test(n)) s += 4;
    if (/^google/i.test(n)) s += 5;
    if (/samantha|daniel|karen|moira|serena|ava|allison|evan|nathan|zoe|tom\b/i.test(n)) s += 2; // boas vozes do iPhone/Mac
    if (/^microsoft (david|zira|mark|hazel|george|susan)\b/i.test(n) && !/natural|online/i.test(n)) s -= 3; // antigas do Windows
    if (ROBOTIC.test(n)) s -= 20;
    if (/en[-_]us/i.test(v.lang)) s += 2;
    else if (/en[-_](gb|au|ca|ie|nz)/i.test(v.lang)) s += 1;
    if (v.localService === false) s += 1; // vozes da internet costumam soar melhor
    return s;
  }

  function englishVoices() {
    if (!synth) return [];
    return synth.getVoices()
      .filter((v) => /^en[-_]/i.test(v.lang) && voiceScore(v) > -10)
      .sort((a, b) => voiceScore(b) - voiceScore(a));
  }

  function voicesReady() {
    if (!synth) return Promise.resolve([]);
    if (voicesCache?.length) return Promise.resolve(voicesCache);
    return new Promise((resolve) => {
      const done = () => { voicesCache = englishVoices(); resolve(voicesCache); };
      if (synth.getVoices().length) return done();
      synth.addEventListener('voiceschanged', done, { once: true });
      setTimeout(done, 1500);
    });
  }

  const FEMALE = /female|woman|samantha|zira|aria|jenny|sonia|libby|emma|ava|allison|susan|karen|moira|tessa|serena|victoria|michelle|ana\b|natasha|clara|zoe|google us english|google uk english female/i;
  const MALE = /\bmale|\bman\b|david|mark|guy|ryan|christopher|eric|daniel|alex|george|oliver|thomas|andrew|brian|steffan|william|evan|nathan|tom\b|google uk english male/i;

  /** Escolhe a melhor voz feminina ('f') ou masculina ('m'); a lista já vem da mais natural para a menos. */
  function pickVoice(voices, gender, fallbackIndex = 0) {
    const re = gender === 'm' ? MALE : FEMALE;
    const other = gender === 'm' ? FEMALE : MALE;
    return voices.find((v) => re.test(v.name) && !other.test(v.name.replace(/\bmale\b/i, '')))
      || voices.find((v) => re.test(v.name))
      || voices[fallbackIndex % Math.max(voices.length, 1)] || null;
  }

  const ttsSupported = () => Boolean(synth && window.SpeechSynthesisUtterance);

  function stopSpeaking() { if (synth) synth.cancel(); }

  /**
   * Celular (principalmente iPhone): a voz só é liberada se o primeiro "falar" acontecer
   * no mesmo instante do toque. No primeiro toque em qualquer lugar da página, fala um
   * texto vazio e mudo para destravar a voz; depois disso, as falas seguintes funcionam.
   */
  let unlocked = false;
  function unlockVoice() {
    if (unlocked || !ttsSupported()) return;
    unlocked = true;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'en-US';
      synth.speak(u);
      synth.resume();
    } catch { /* sem voz: o aviso aparece ao tentar ouvir */ }
  }
  if (ttsSupported()) {
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, unlockVoice, { capture: true, passive: true }));
    voicesReady(); // carrega a lista de vozes já ao abrir a página
  }

  const isAbort = (e) => e && (e.error === 'interrupted' || e.error === 'canceled');

  function utter(text, { voice, rate, pitch }) {
    return new Promise((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice?.lang?.replace('_', '-') || 'en-US';
      u.rate = rate;
      u.pitch = pitch;
      let settled = false;
      const finish = (fn, arg) => { if (!settled) { settled = true; clearTimeout(guard); fn(arg); } };
      // Alguns Androids não avisam o fim da fala: segue em frente depois do tempo esperado.
      const words = String(text).split(/\s+/).length;
      const guard = setTimeout(() => finish(resolve), Math.max(4000, (words * 650) / Math.max(rate, 0.5) + 3000));
      u.onend = () => finish(resolve);
      u.onerror = (e) => (isAbort(e) ? finish(resolve) : finish(reject, e));
      synth.resume(); // Chrome às vezes fica "pausado" e não fala
      synth.speak(u);
    });
  }

  /** Fala um texto. Retorna uma Promise que resolve ao terminar. */
  async function speak(text, { gender = 'f', rate = 0.95, pitch } = {}) {
    if (!ttsSupported()) throw new Error('Seu navegador não tem voz em inglês disponível.');
    unlockVoice();
    // Com as vozes já carregadas, fala na hora (sem esperar), para valer o toque no celular.
    const voices = voicesCache?.length ? voicesCache : await voicesReady();
    const voice = pickVoice(voices, gender, gender === 'm' ? 1 : 0);
    // Tom natural (1.0): mudar o tom deixa a voz robótica. Só quando homem e mulher caem na
    // mesma voz (aparelho com uma voz só) é que o tom muda um pouquinho, para diferenciar.
    const sameVoice = voice && pickVoice(voices, gender === 'm' ? 'f' : 'm', gender === 'm' ? 0 : 1) === voice;
    const opts = { voice, rate, pitch: pitch ?? (sameVoice ? (gender === 'm' ? 0.94 : 1.05) : 1) };
    try {
      return await utter(text, opts);
    } catch (e) {
      if (e?.error === 'not-allowed') {
        throw new Error('O celular bloqueou o som. Toque em ▶ de novo para ouvir.');
      }
      // A voz escolhida falhou (comum no Android): tenta de novo com a voz padrão em inglês.
      try {
        return await utter(text, { ...opts, voice: null });
      } catch {
        throw new Error('Não foi possível tocar o áudio. Confira se o celular não está no silencioso e se há voz em inglês instalada.');
      }
    }
  }

  // ---------------------------------------------------------------- YouTube
  let ytPromise = null;
  function loadYouTube() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!ytPromise) {
      ytPromise = new Promise((resolve, reject) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.onerror = () => reject(new Error('Não foi possível carregar o player do YouTube.'));
        document.head.appendChild(s);
      });
    }
    return ytPromise;
  }

  /** Cria um player do YouTube (sem cookies de rastreamento) dentro de `el`. */
  async function youtubePlayer(el, videoId, { onStateChange, controls = 1 } = {}) {
    // Página com vídeo: fundo parado e barra do topo sem desfoque (evita a tela piscar).
    document.body.classList.add('has-video');
    // Fonte do vídeo logo abaixo do player, com link para o vídeo no YouTube (regra do YouTube).
    const box = el.closest('.video-box');
    if (box && !box.nextElementSibling?.classList.contains('yt-source')) {
      const src = document.createElement('p');
      src.className = 'yt-source';
      src.innerHTML = `Vídeo do YouTube · <a href="https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}" target="_blank" rel="noopener">assistir no YouTube</a> · <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">Termos do YouTube</a>`;
      box.after(src);
    }
    const YT = await loadYouTube();
    return new Promise((resolve) => {
      const p = new YT.Player(el, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls, cc_load_policy: 0, origin: location.origin },
        events: {
          onReady: () => resolve(p),
          onStateChange: (e) => onStateChange?.(e),
        },
      });
    });
  }

  const thumb = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------- progresso parcial
  // Enviado a cada resposta: se o aluno sair antes de terminar, a professora vê o percentual
  // e o aluno é lembrado da atividade pendente quando voltar.
  let lastProgress = '';
  let progressInFlight = Promise.resolve();
  function reportProgress(key, answered, correct, total, state = null) {
    const sig = `${key}|${answered}|${correct}|${total}|${JSON.stringify(state)}`;
    if (sig === lastProgress || !total) return progressInFlight;
    lastProgress = sig;
    progressInFlight = progressInFlight
      .then(() => Novera.api(`/api/activities/${encodeURIComponent(key)}/progress`, { method: 'PUT', body: { answered, correct, total, state } }))
      .catch(() => { lastProgress = ''; });
    return progressInFlight;
  }

  // ---------------------------------------------------------------- resultado
  async function saveAttempt(key, score, total) {
    try {
      // O resultado final precisa chegar DEPOIS do último progresso (que é apagado ao concluir).
      await progressInFlight;
      lastProgress = '';
      const r = await Novera.api(`/api/activities/${encodeURIComponent(key)}/attempts`, { method: 'POST', body: { score, total } });
      return r.best;
    } catch (err) {
      // Não perde o resultado em silêncio: guarda e avisa o aluno.
      const queued = !(err.status === 400 || err.status === 403 || err.status === 404) && Novera.queueAttempt(key, score, total);
      const msg = err.status === 401
        ? '⚠️ Sua sessão terminou (por exemplo, a senha foi trocada), então este resultado ainda não chegou para a professora. Entre de novo na plataforma: ele será salvo automaticamente.'
        : queued
          ? '⚠️ Não conseguimos salvar este resultado agora (verifique a internet). Ele foi guardado e será enviado na próxima vez que você abrir a plataforma.'
          : `⚠️ Este resultado não foi salvo: ${err.message}`;
      const box = document.getElementById('act-error');
      if (box) { box.textContent = msg; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } else Novera.toast(msg);
      return null;
    }
  }

  function resultHtml(score, total, { retryLabel = 'Fazer de novo' } = {}) {
    const pct = total ? Math.round((score / total) * 100) : 0;
    const msg = pct === 100 ? 'Perfeito! 🎉' : pct >= 70 ? 'Muito bem! 👏' : pct >= 40 ? 'Bom começo — vale revisar.' : 'Continue praticando, você chega lá!';
    return `
      <div class="act-result">
        <div class="act-result-score"><strong>${score}</strong><span>/ ${total}</span></div>
        <p class="act-result-msg">${msg}</p>
        <div class="progress"><span style-pct="${pct}"></span></div>
        <div class="act-result-actions">
          <button type="button" class="btn" data-retry>${retryLabel}</button>
          <a class="btn btn-ghost" data-back href="#">Ver outras atividades</a>
        </div>
      </div>`;
  }

  /** Ajusta larguras de barras sem usar estilos inline no HTML (CSP). */
  function applyBars(root) {
    root.querySelectorAll('[style-pct]').forEach((el) => { el.style.width = `${el.getAttribute('style-pct')}%`; });
  }

  return {
    normalize, same, wordDiff, shuffle,
    ttsSupported, speak, stopSpeaking, voicesReady,
    loadYouTube, youtubePlayer, thumb, fmtTime,
    saveAttempt, reportProgress, resultHtml, applyBars,
  };
})();
