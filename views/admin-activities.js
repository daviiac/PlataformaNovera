/* Painel admin: criação de atividades com vídeo do YouTube (quiz, música, videoaula). */
(async () => {
  const { api, esc, toast, formatDate } = Novera;
  const $ = (id) => document.getElementById(id);
  const user = await Novera.currentUser();
  if (user?.role !== 'admin') return;

  let player = null;
  let loadedId = null;

  // ---------------------------------------------------------------- tempo
  const fmt = (s) => Act.fmtTime(s);
  function parseTime(v) {
    const s = String(v || '').trim();
    if (!s) return NaN;
    const parts = s.split(':').map(Number);
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }
  const currentTime = () => (player?.getCurrentTime ? Math.floor(player.getCurrentTime()) : null);

  // ---------------------------------------------------------------- tipo
  function showEditor() {
    const t = $('act-type').value;
    ['quiz', 'song', 'video_lesson'].forEach((k) => { $(`ed-${k}`).hidden = k !== t; });
  }
  $('act-type').addEventListener('change', showEditor);

  // ---------------------------------------------------------------- vídeo
  function youtubeIdFrom(input) {
    const s = input.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    try {
      const u = new URL(s);
      if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12);
      return u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/) || [])[1] || null;
    } catch { return null; }
  }

  $('act-load').addEventListener('click', async () => {
    const id = youtubeIdFrom($('act-youtube').value);
    if (!id) return toast('Cole um link válido do YouTube.');
    $('act-preview').hidden = false;
    if (player && loadedId !== id) { player.loadVideoById(id); loadedId = id; return; }
    if (!player) {
      try {
        player = await Act.youtubePlayer($('act-yt'), id);
        loadedId = id;
      } catch (err) { toast(err.message); }
    }
  });

  // ---------------------------------------------------------------- perguntas
  const rows = $('q-rows');
  function addRow(q = {}) {
    const div = document.createElement('div');
    div.className = 'q-row';
    const name = `ans-${Math.random().toString(36).slice(2)}`;
    const opts = q.options || ['', '', '', ''];
    div.innerHTML = `
      <div class="q-row-head">
        <div class="field"><label>Tempo</label><input class="time-input" data-time placeholder="1:05" value="${q.time !== undefined ? fmt(q.time) : ''}"></div>
        <button type="button" class="btn btn-ghost btn-sm" data-now>⏱ tempo atual</button>
        <span class="ws-spacer"></span>
        <button type="button" class="btn btn-danger btn-sm" data-remove>Remover</button>
      </div>
      <div class="field mt"><label>Pergunta</label><input data-prompt maxlength="300" value="${esc(q.prompt || '')}"></div>
      <div class="opts">${opts.map((o, j) => `
        <label class="opt-edit"><input type="radio" name="${name}" value="${j}" ${q.answer === j ? 'checked' : ''} aria-label="Alternativa correta">
          <input type="text" data-opt maxlength="160" placeholder="Alternativa ${'ABCD'[j]}${j > 1 ? ' (opcional)' : ''}" value="${esc(o)}"></label>`).join('')}
      </div>
      <p class="hint">Marque a bolinha da alternativa correta.</p>`;
    rows.appendChild(div);
  }
  $('q-add').addEventListener('click', () => addRow());
  rows.addEventListener('click', (e) => {
    const row = e.target.closest('.q-row');
    if (e.target.closest('[data-remove]')) row.remove();
    if (e.target.closest('[data-now]')) {
      const t = currentTime();
      if (t === null) return toast('Carregue e toque o vídeo para capturar o tempo.');
      row.querySelector('[data-time]').value = fmt(t);
    }
  });
  addRow();

  // ---------------------------------------------------------------- música
  $('song-time').addEventListener('click', () => {
    const t = currentTime();
    if (t === null) return toast('Carregue e toque o vídeo para capturar o tempo.');
    const ta = $('song-lyrics');
    const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    const lineEnd = ta.value.indexOf('\n', start);
    const line = ta.value.slice(start, lineEnd === -1 ? undefined : lineEnd).replace(/^\d+:\d{2}\s*/, '');
    ta.value = `${ta.value.slice(0, start)}${fmt(t)} ${line}${lineEnd === -1 ? '' : ta.value.slice(lineEnd)}`;
    ta.focus();
  });

  /** Lê a letra: aceita "m:ss verso", LRC "[mm:ss.xx] verso" ou só o verso. */
  function parseLine(raw) {
    const l = raw.trim();
    let m = l.match(/^\[(\d{1,2}):(\d{2})(?:[.:]\d{1,3})?\]\s*(.*)$/);
    if (m) return { time: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() };
    m = l.match(/^(\d+:\d{2}(?::\d{2})?)\s+(.*)$/);
    return m ? { time: parseTime(m[1]), text: m[2].trim() } : { time: null, text: l };
  }
  function songLines() {
    return $('song-lyrics').value.split('\n').map(parseLine).filter((l) => l.text && !/^\[.*\]$/.test(l.text));
  }
  function writeLines(lines) {
    $('song-lyrics').value = lines.map((l) => (l.time !== null && Number.isFinite(l.time) ? `${fmt(l.time)} ${l.text}` : l.text)).join('\n');
    songStats();
  }
  function songStats() {
    const lines = songLines();
    const gaps = lines.reduce((n, l) => n + (l.text.match(/\[[^\]]+\]/g) || []).length, 0);
    const timed = lines.filter((l) => l.time !== null).length;
    $('song-stats').textContent = lines.length
      ? `${lines.length} versos · ${gaps} lacunas · ${timed} com tempo. Respeite os direitos autorais: use letras que você pode usar em aula.`
      : 'Respeite os direitos autorais: use letras que você pode usar em aula.';
  }
  $('song-lyrics').addEventListener('input', songStats);

  // ---------------------------------------------------------------- lacunas automáticas
  const STOP = new Set(('a an the and or but so if of to in on at by for from with as is are am be been was were do does did '
    + 'i you he she it we they me him her us them my your his its our their this that these those there here not no yes '
    + 'oh ooh ah yeah hey la na da uh woah whoa im ive id ill youre dont cant wont aint gonna wanna gotta just like '
    + 'will would can could should all up down out')
    .split(/\s+/));

  function gapsFor(level, words) {
    if (level === 'A1') return 1;
    if (level === 'A2') return words >= 8 ? 2 : 1;
    return words <= 4 ? 1 : 2;
  }

  function autoGaps() {
    const level = $('act-level').value;
    const used = new Map();
    const lines = songLines().map((l) => {
      const text = l.text.replace(/\[([^\]]+)\]/g, '$1');
      const tokens = [...text.matchAll(/[A-Za-z][A-Za-z']*/g)].map((m) => ({ word: m[0], index: m.index }));
      const candidates = tokens.filter((t) => {
        const w = t.word.toLowerCase().replace(/'/g, '');
        if (STOP.has(w) || w.length < 3) return false;
        if (level === 'A1' && w.length > 7) return false;
        return true;
      });
      if (!candidates.length) return { ...l, text };
      // Prioridade: palavras ainda não usadas; B2 prefere as mais longas, A1 as mais curtas.
      const ranked = candidates
        .map((t, i) => ({ ...t, i, seen: used.get(t.word.toLowerCase()) || 0 }))
        .sort((a, b) => a.seen - b.seen
          || (level === 'B2' ? b.word.length - a.word.length : level === 'A1' ? a.word.length - b.word.length : 0)
          || a.i - b.i);
      // Escolhe sem deixar duas lacunas vizinhas (fica difícil demais).
      const n = gapsFor(level, tokens.length);
      const pos = (t) => tokens.findIndex((x) => x.index === t.index);
      const picked = [];
      for (const c of ranked) {
        if (picked.length >= n) break;
        if (picked.some((p) => Math.abs(pos(p) - pos(c)) < 2)) continue;
        picked.push(c);
      }
      const chosen = picked.sort((a, b) => b.index - a.index); // de trás pra frente
      let out = text;
      for (const c of chosen) {
        out = `${out.slice(0, c.index)}[${c.word}]${out.slice(c.index + c.word.length)}`;
        used.set(c.word.toLowerCase(), (used.get(c.word.toLowerCase()) || 0) + 1);
      }
      return { ...l, text: out };
    });
    if (!lines.length) return toast('Cole a letra primeiro.');
    writeLines(lines);
    toast(`Lacunas geradas para o nível ${level}. Revise se quiser.`);
  }
  $('song-auto').addEventListener('click', autoGaps);
  $('song-clear').addEventListener('click', () => {
    writeLines(songLines().map((l) => ({ ...l, text: l.text.replace(/\[([^\]]+)\]/g, '$1') })));
  });

  // ---------------------------------------------------------------- sincronizar com o vídeo
  let sync = null;
  function showSync() {
    const { lines, i } = sync;
    $('sync-count').textContent = `Verso ${Math.min(i + 1, lines.length)} de ${lines.length}`;
    $('sync-next').textContent = i < lines.length ? lines[i].text.replace(/\[([^\]]+)\]/g, '$1') : 'Todos os versos marcados! Clique em Concluir.';
    $('sync-mark').disabled = i >= lines.length;
  }
  function startSync() {
    if (!player) return toast('Carregue o vídeo primeiro (botão "Carregar vídeo").');
    const lines = songLines();
    if (!lines.length) return toast('Cole a letra primeiro.');
    sync = { lines, i: 0 };
    $('sync-panel').hidden = false;
    player.seekTo(0, true);
    player.playVideo();
    showSync();
    $('sync-mark').focus();
  }
  function markSync() {
    if (!sync || sync.i >= sync.lines.length) return;
    sync.lines[sync.i].time = currentTime();
    sync.i += 1;
    writeLines(sync.lines);
    showSync();
  }
  function stopSync() {
    $('sync-panel').hidden = true;
    sync = null;
    player?.pauseVideo();
  }
  $('song-sync').addEventListener('click', startSync);
  $('sync-mark').addEventListener('click', markSync);
  $('sync-undo').addEventListener('click', () => {
    if (!sync || !sync.i) return;
    sync.i -= 1;
    sync.lines[sync.i].time = null;
    writeLines(sync.lines);
    showSync();
  });
  $('sync-stop').addEventListener('click', stopSync);
  document.addEventListener('keydown', (e) => {
    if (!sync || e.code !== 'Space' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    e.preventDefault();
    markSync();
  });

  // ---------------------------------------------------------------- publicar
  $('act-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('act-msg');
    msg.className = 'alert';
    msg.textContent = '';
    const type = $('act-type').value;
    let data = {};
    try {
      if (type === 'quiz') {
        data.questions = [...rows.querySelectorAll('.q-row')].map((row, i) => {
          const time = parseTime(row.querySelector('[data-time]').value);
          if (!Number.isFinite(time)) throw new Error(`Pergunta ${i + 1}: informe o tempo (ex.: 1:05).`);
          const inputs = [...row.querySelectorAll('[data-opt]')];
          const checked = row.querySelector('input[type="radio"]:checked');
          // Mantém só alternativas preenchidas, ajustando o índice da correta.
          const filled = inputs.map((inp, j) => ({ text: inp.value.trim(), j })).filter((o) => o.text);
          const answer = checked ? filled.findIndex((o) => o.j === Number(checked.value)) : -1;
          if (answer < 0) throw new Error(`Pergunta ${i + 1}: marque uma alternativa correta que esteja preenchida.`);
          return { time, prompt: row.querySelector('[data-prompt]').value, options: filled.map((o) => o.text), answer };
        });
      } else if (type === 'song') {
        data = { artist: $('song-artist').value, lines: songLines() };
      } else {
        data = { summary: $('vl-summary').value };
      }
    } catch (err) {
      msg.className = 'alert alert-error';
      msg.textContent = err.message;
      return;
    }

    try {
      const r = await api('/api/admin/activities', {
        method: 'POST',
        body: {
          type,
          level: $('act-level').value,
          title: $('act-title').value,
          description: $('act-desc').value,
          youtube: $('act-youtube').value,
          data,
        },
      });
      msg.className = 'alert alert-success';
      msg.innerHTML = `Atividade publicada! <a href="/atividade?id=${encodeURIComponent(r.key)}">Abrir como aluno →</a>`;
      $('act-title').value = '';
      $('act-desc').value = '';
      loadList();
    } catch (err) {
      msg.className = 'alert alert-error';
      msg.textContent = err.message;
    }
  });

  // ---------------------------------------------------------------- lista
  const LABEL = { quiz: '🎬 Quiz em vídeo', song: '🎵 Música', video_lesson: '📺 Videoaula' };
  async function loadList() {
    const { activities } = await api('/api/admin/activities');
    $('act-list').innerHTML = activities.length ? activities.map((a) => `
      <div class="admin-act">
        <img src="${esc(Act.thumb(a.youtube_id || ''))}" alt="" loading="lazy">
        <div class="grow">
          <strong>${esc(a.title)}</strong><br>
          <span class="small dim">${LABEL[a.type] || esc(a.type)} · ${esc(a.level)} · ${formatDate(a.created_at)} · ${a.attempts} tentativa(s)</span>
        </div>
        <a class="btn btn-ghost btn-sm" href="/atividade?id=a-${a.id}">Abrir</a>
        <button type="button" class="btn btn-danger btn-sm" data-del="${a.id}">Excluir</button>
      </div>`).join('') : '<p class="empty">Nenhuma atividade com vídeo publicada ainda.</p>';
  }
  $('act-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (!confirm('Excluir esta atividade? Os resultados dos alunos nela também serão apagados.')) return;
    try {
      await api(`/api/admin/activities/${b.dataset.del}`, { method: 'DELETE' });
      toast('Atividade excluída.');
      loadList();
    } catch (err) { toast(err.message); }
  });

  showEditor();
  loadList();
  if (location.hash === '#atividades') $('atividades').scrollIntoView();
})();
