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

  function englishVoices() {
    if (!synth) return [];
    const all = synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    // Prioriza vozes naturais / online e en-US.
    const score = (v) => (/natural|online|neural|google/i.test(v.name) ? 2 : 0) + (/en[-_]us/i.test(v.lang) ? 1 : 0);
    return all.sort((a, b) => score(b) - score(a));
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

  const FEMALE = /female|woman|samantha|zira|aria|jenny|sonia|libby|emma|ava|allison|susan|karen|moira|tessa|serena|victoria|google us english|google uk english female/i;
  const MALE = /male|man|david|mark|guy|ryan|christopher|eric|daniel|alex|fred|george|oliver|thomas|google uk english male/i;

  /** Escolhe uma voz feminina ('f') ou masculina ('m'), com alternativa se não houver. */
  function pickVoice(voices, gender, fallbackIndex = 0) {
    const re = gender === 'm' ? MALE : FEMALE;
    const other = gender === 'm' ? FEMALE : MALE;
    return voices.find((v) => re.test(v.name) && !(gender === 'm' && other.test(v.name)))
      || voices[fallbackIndex % Math.max(voices.length, 1)] || null;
  }

  const ttsSupported = () => Boolean(synth && window.SpeechSynthesisUtterance);

  function stopSpeaking() { if (synth) synth.cancel(); }

  /** Fala um texto. Retorna uma Promise que resolve ao terminar. */
  async function speak(text, { gender = 'f', rate = 0.95, pitch } = {}) {
    if (!ttsSupported()) throw new Error('Seu navegador não tem voz em inglês disponível.');
    const voices = await voicesReady();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(voices, gender, gender === 'm' ? 1 : 0);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || 'en-US';
      u.rate = rate;
      // Se só houver uma voz, muda o tom para diferenciar os personagens.
      u.pitch = pitch ?? (gender === 'm' ? 0.85 : 1.1);
      u.onend = resolve;
      u.onerror = resolve;
      synth.speak(u);
    });
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
