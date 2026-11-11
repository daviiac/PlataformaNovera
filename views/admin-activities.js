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
    // Música usa as mesmas perguntas do quiz (a letra não é reproduzida: direitos autorais).
    $('ed-quiz').hidden = !(t === 'quiz' || t === 'song');
    $('ed-song').hidden = t !== 'song';
    $('ed-video_lesson').hidden = t !== 'video_lesson';
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

  // ---------------------------------------------------------------- publicar
  $('act-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('act-msg');
    msg.className = 'alert';
    msg.textContent = '';
    const type = $('act-type').value;
    let data = {};
    try {
      if (type === 'quiz' || type === 'song') {
        if (type === 'song') data.artist = $('song-artist').value;
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
          ${a.lyrics_hidden ? '<br><span class="small t-warn">⚠️ Oculta dos alunos: tem a letra completa da música (direitos autorais). Exclua e crie de novo com perguntas.</span>' : ''}
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
