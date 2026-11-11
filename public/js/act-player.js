(async () => {
  const { api, requireUser, renderTopbar, esc } = Novera;
  const user = await requireUser();
  if (user.role === 'student' && !user.level) return window.location.replace('/nivelamento');

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const key = new URLSearchParams(location.search).get('id');

  let activity;
  let type;
  try {
    ({ activity, type } = await api(`/api/activities/${encodeURIComponent(key || '')}`));
  } catch (err) {
    renderTopbar(user, 'atividades');
    $('act-title').textContent = 'Atividade não encontrada';
    $('act-error').textContent = err.message;
    return;
  }

  renderTopbar(user, activity.type === 'worksheet' ? 'worksheets' : 'atividades');
  document.title = `Novera · ${activity.title}`;
  const listUrl = `/atividades?tipo=${activity.type}&nivel=${activity.level}`;
  $('back-link').href = listUrl;
  $('back-link').textContent = `← ${type.label}`;
  $('act-type').textContent = `${type.icon} ${type.label}`;
  $('act-title').textContent = activity.title;
  $('act-desc').textContent = activity.description || '';
  $('act-tags').innerHTML = `<span class="level-badge level-${esc(activity.level)}">${esc(activity.level)}</span>`
    + (activity.best ? ` <span class="tag">Melhor: ${activity.best.score}/${activity.best.total}</span>` : '');

  const data = activity.data;

  /** Mostra o resultado, salva a tentativa e oferece "fazer de novo". */
  async function finish(score, total, { target = stage, retry = start } = {}) {
    const box = document.createElement('div');
    box.className = 'card act-result-card';
    box.innerHTML = Act.resultHtml(score, total);
    Act.applyBars(box);
    target.appendChild(box);
    box.querySelector('[data-back]').href = listUrl;
    box.querySelector('[data-retry]').addEventListener('click', () => { Act.stopSpeaking(); retry(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const best = await Act.saveAttempt(activity.key, score, total);
    if (best) $('act-tags').innerHTML = `<span class="level-badge level-${esc(activity.level)}">${esc(activity.level)}</span> <span class="tag">Melhor: ${best.score}/${best.total}</span>`;
  }

  /** Progresso parcial (para a professora ver o % e o aluno ser lembrado se sair antes do fim). */
  const progress = (answered, correct, total, state) => Act.reportProgress(activity.key, answered, correct, total, state);

  // ---------- Continuar de onde parou ----------
  // O servidor devolve o progresso guardado; cada tipo de atividade pega o seu estado uma vez
  // (depois de montar a tela) e reaplica as respostas. "Fazer de novo" começa do zero.
  let resume = activity.progress?.state ? activity.progress : null;
  function takeResume(total) {
    const r = resume;
    resume = null;
    if (!r || r.total !== total || !r.state || typeof r.state !== 'object') return null;
    const note = document.createElement('div');
    note.className = 'notice-info resume-note';
    note.innerHTML = `↩️ <span>Continuando de onde você parou: <b>${r.answered} de ${r.total}</b> já respondidas.</span>
      <button type="button" class="link-btn" data-fresh>Recomeçar do zero</button>`;
    stage.prepend(note);
    note.querySelector('[data-fresh]').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      await progress(0, 0, r.total);
      location.reload();
    });
    return r.state;
  }
  const clampInt = (n, min, max) => (Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : min);

  const ttsWarning = () => (Act.ttsSupported() ? '' : '<p class="notice">Seu navegador não oferece voz em inglês. Use o Chrome, Edge ou Safari atualizados para ouvir os áudios.</p>');

  // ====================================================================== LISTEN
  function playListen() {
    const lines = data.lines;
    const qs = data.questions;
    const answers = new Array(qs.length).fill(null);
    let idx = 0;
    let playing = false;
    let slow = false;
    let runId = 0;

    stage.innerHTML = `
      ${ttsWarning()}
      <div class="card audio-card">
        <div class="wave" aria-hidden="true">${'<i></i>'.repeat(28)}</div>
        <div class="audio-controls">
          <button type="button" class="btn btn-ghost btn-icon" data-restart aria-label="Ouvir do início">↺</button>
          <button type="button" class="btn play-btn" data-play aria-label="Ouvir">▶</button>
          <button type="button" class="btn btn-ghost btn-sm" data-speed aria-pressed="false">🐢 Devagar</button>
        </div>
        <p class="small dim center" data-status>Clique em ▶ para ouvir o diálogo (${lines.length} falas).</p>
        <details class="transcript">
          <summary>Mostrar transcrição</summary>
          <ol>${lines.map(([who, text], i) => `<li data-line="${i}"><b>${esc(who)}:</b> ${esc(text)}</li>`).join('')}</ol>
        </details>
      </div>
      <div class="q-list">
        ${qs.map((q, i) => `
          <fieldset class="card q-card" data-q="${i}">
            <legend><span class="q-num">${i + 1}.</span> ${esc(q.prompt)}</legend>
            <div class="opt-list">
              ${q.options.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}"><span>${esc(o)}</span></label>`).join('')}
            </div>
          </fieldset>`).join('')}
      </div>
      <button type="button" class="btn btn-block" data-finish disabled>Finalizar (0/${qs.length})</button>`;

    const playBtn = stage.querySelector('[data-play]');
    const status = stage.querySelector('[data-status]');
    const wave = stage.querySelector('.wave');
    const setPlaying = (on) => {
      playing = on;
      playBtn.textContent = on ? '❚❚' : '▶';
      playBtn.setAttribute('aria-label', on ? 'Pausar' : 'Ouvir');
      wave.classList.toggle('on', on);
    };
    const highlight = (i) => stage.querySelectorAll('[data-line]').forEach((li) => li.classList.toggle('speaking', Number(li.dataset.line) === i));

    async function run() {
      const my = ++runId;
      setPlaying(true);
      while (idx < lines.length && my === runId) {
        const [who, text] = lines[idx];
        status.textContent = `Fala ${idx + 1} de ${lines.length} — ${who}`;
        highlight(idx);
        try {
          await Act.speak(text, { gender: data.speakers[who] || 'f', rate: slow ? 0.7 : 0.95 });
        } catch (err) {
          status.textContent = err.message;
          break;
        }
        if (my !== runId) return;
        idx += 1;
        await new Promise((r) => setTimeout(r, 350));
      }
      if (my === runId) {
        setPlaying(false);
        highlight(-1);
        if (idx >= lines.length) { status.textContent = 'Fim do diálogo. Clique em ↺ para ouvir de novo.'; idx = 0; }
      }
    }
    const pause = () => { runId += 1; Act.stopSpeaking(); setPlaying(false); status.textContent = 'Pausado.'; };

    playBtn.addEventListener('click', () => (playing ? pause() : run()));
    stage.querySelector('[data-restart]').addEventListener('click', () => { pause(); idx = 0; run(); });
    stage.querySelector('[data-speed]').addEventListener('click', (e) => {
      slow = !slow;
      e.currentTarget.setAttribute('aria-pressed', String(slow));
      e.currentTarget.classList.toggle('active', slow);
    });

    const finishBtn = stage.querySelector('[data-finish]');
    const refresh = () => {
      const n = answers.filter((a) => a !== null).length;
      finishBtn.textContent = `Finalizar (${n}/${qs.length})`;
      finishBtn.disabled = n < qs.length;
      return n;
    };
    stage.querySelector('.q-list').addEventListener('change', (e) => {
      const fs = e.target.closest('[data-q]');
      answers[Number(fs.dataset.q)] = Number(e.target.value);
      const n = refresh();
      progress(n, qs.filter((q, i) => answers[i] === q.answer).length, qs.length, { answers });
    });
    const saved = takeResume(qs.length);
    if (Array.isArray(saved?.answers)) {
      saved.answers.forEach((a, i) => {
        if (!qs[i] || !Number.isInteger(a) || a < 0 || a >= qs[i].options.length) return;
        answers[i] = a;
        const inp = stage.querySelector(`input[name="q${i}"][value="${a}"]`);
        if (inp) inp.checked = true;
      });
      refresh();
    }
    finishBtn.addEventListener('click', () => {
      pause();
      let score = 0;
      qs.forEach((q, i) => {
        const fs = stage.querySelector(`[data-q="${i}"]`);
        const ok = answers[i] === q.answer;
        if (ok) score += 1;
        fs.classList.add(ok ? 'is-ok' : 'is-bad');
        fs.querySelectorAll('.opt').forEach((lab, j) => {
          lab.classList.toggle('opt-correct', j === q.answer);
          lab.classList.toggle('opt-wrong', j === answers[i] && !ok);
          lab.querySelector('input').disabled = true;
        });
      });
      stage.querySelector('.transcript').open = true;
      finishBtn.hidden = true;
      finish(score, qs.length);
    });
  }

  // ====================================================================== DITADO
  function playDictation() {
    const sentences = data.sentences;
    let i = 0;
    let score = 0;

    stage.innerHTML = `
      ${ttsWarning()}
      <div class="card dict-card">
        <div class="dict-top"><span class="small dim" data-count></span><div class="dots" data-dots></div></div>
        <div class="audio-controls">
          <button type="button" class="btn play-btn" data-play aria-label="Ouvir a frase">▶</button>
          <button type="button" class="btn btn-ghost btn-sm" data-slow>🐢 Devagar</button>
        </div>
        <div class="field">
          <label for="dict-input" class="sr-only">Escreva o que você ouviu</label>
          <input id="dict-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Escreva o que você ouviu…">
        </div>
        <div class="feedback" data-feedback hidden></div>
        <div class="row-actions">
          <button type="button" class="btn" data-check>Verificar</button>
          <button type="button" class="btn" data-next hidden>Próxima frase →</button>
        </div>
      </div>`;

    const input = $('dict-input');
    const fb = stage.querySelector('[data-feedback]');
    const checkBtn = stage.querySelector('[data-check]');
    const nextBtn = stage.querySelector('[data-next]');
    const say = (rate) => Act.speak(sentences[i], { gender: i % 2 ? 'm' : 'f', rate }).catch((e) => Novera.toast(e.message));

    function show() {
      stage.querySelector('[data-count]').textContent = `Frase ${i + 1} de ${sentences.length}`;
      stage.querySelector('[data-dots]').innerHTML = sentences.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('');
      input.value = '';
      input.disabled = false;
      fb.hidden = true;
      checkBtn.hidden = false;
      nextBtn.hidden = true;
      input.focus();
    }

    function check() {
      if (!input.value.trim()) { input.focus(); return; }
      Act.stopSpeaking();
      const ok = Act.same(input.value, sentences[i]);
      if (ok) score += 1;
      progress(i + 1, score, sentences.length, { i: i + 1, score });
      fb.hidden = false;
      fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
      fb.innerHTML = ok
        ? '✅ Perfeito!'
        : `❌ Sua resposta: ${Act.wordDiff(input.value, sentences[i])}<br><span class="small">Frase correta:</span> <b>${esc(sentences[i])}</b>`;
      input.disabled = true;
      checkBtn.hidden = true;
      nextBtn.hidden = false;
      nextBtn.textContent = i === sentences.length - 1 ? 'Ver resultado' : 'Próxima frase →';
      nextBtn.focus();
    }

    stage.querySelector('[data-play]').addEventListener('click', () => { Act.stopSpeaking(); say(0.9); });
    stage.querySelector('[data-slow]').addEventListener('click', () => { Act.stopSpeaking(); say(0.6); });
    checkBtn.addEventListener('click', check);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    nextBtn.addEventListener('click', () => {
      if (i < sentences.length - 1) { i += 1; show(); say(0.9); return; }
      stage.querySelector('.dict-card').hidden = true;
      finish(score, sentences.length);
    });
    const saved = takeResume(sentences.length);
    if (saved) {
      i = clampInt(saved.i, 0, sentences.length);
      score = clampInt(saved.score, 0, i);
      if (i >= sentences.length) { stage.querySelector('.dict-card').hidden = true; finish(score, sentences.length); return; }
    }
    show();
  }

  // ====================================================================== GRAMÁTICA (estudo)
  function playLesson() {
    const d = data;
    const table = (t) => `
      <div class="table-wrap"><table class="g-table">
        <thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    // intro/notes/summary vêm do conteúdo próprio da Novera (código do servidor) e usam só <b>/<i>.
    stage.innerHTML = `
      <article class="card lesson">
        <section><p class="lead-text">${d.intro}</p></section>
        <section><h2>Estrutura</h2>${table(d.structure)}</section>
        <section>
          <h2>Exemplos</h2>
          <ul class="examples">${d.examples.map(([en, pt]) => `
            <li><button type="button" class="speak-btn" data-say="${esc(en)}" aria-label="Ouvir">🔊</button>
              <span><b>${esc(en)}</b><br><span class="small dim">${esc(pt)}</span></span></li>`).join('')}
          </ul>
        </section>
        <section><h2>Fique de olho</h2><ul class="notes">${d.notes.map((n) => `<li>${n}</li>`).join('')}</ul></section>
        ${d.table ? `<section><h2>${esc(d.table.title)}</h2>${table(d.table)}</section>` : ''}
        <section>
          <h2>Erros comuns</h2>
          <div class="mistakes">${d.mistakes.map(([wrong, right, tip]) => `
            <div class="mistake"><span class="m-wrong">❌ ${esc(wrong)}</span><span class="m-right">✅ ${esc(right)}</span><span class="small dim">${esc(tip)}</span></div>`).join('')}
          </div>
        </section>
        <section class="summary"><h2>Resumo rápido</h2><ul>${d.summary.map((s) => `<li>${s}</li>`).join('')}</ul></section>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost" data-done>✓ Concluí a lição</button>
          ${d.quizKey ? `<a class="btn" href="/atividade?id=${encodeURIComponent(d.quizKey)}">Praticar no Quiz de Gramática →</a>` : ''}
        </div>
      </article>`;
    stage.addEventListener('click', (e) => {
      const b = e.target.closest('[data-say]');
      if (b) { Act.stopSpeaking(); Act.speak(b.dataset.say).catch((err) => Novera.toast(err.message)); }
    });
    stage.querySelector('[data-done]').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      if (await Act.saveAttempt(activity.key, 1, 1)) Novera.toast('Lição marcada como concluída.');
    });
  }

  // ====================================================================== GRAMÁTICA (quiz)
  function playGrammarQuiz() {
    const items = data.items;
    let i = 0;
    let score = 0;
    stage.innerHTML = `
      <div class="card gq-card">
        <div class="progress"><span data-bar></span></div>
        <div class="q-meta"><span data-count></span><span data-kind></span></div>
        <p class="q-prompt" data-prompt></p>
        <div data-answer></div>
        <div class="feedback" data-feedback hidden></div>
        <div class="row-actions">
          <button type="button" class="btn" data-check>Verificar</button>
          <button type="button" class="btn" data-next hidden>Próxima →</button>
        </div>
        ${data.lessonKey ? `<p class="small dim center">Dúvida? <a href="/atividade?id=${encodeURIComponent(data.lessonKey)}">Reveja a lição</a>.</p>` : ''}
      </div>`;
    const q = (s) => stage.querySelector(s);
    let chosen = null;

    function show() {
      const it = items[i];
      chosen = null;
      q('[data-bar]').style.width = `${(i / items.length) * 100}%`;
      q('[data-count]').textContent = `Questão ${i + 1} de ${items.length}`;
      q('[data-kind]').textContent = it.kind === 'translate' ? 'Escreva em inglês' : 'Escolha a correta';
      q('[data-prompt]').textContent = it.prompt;
      q('[data-feedback]').hidden = true;
      q('[data-check]').hidden = false;
      q('[data-next]').hidden = true;
      q('[data-answer]').innerHTML = it.kind === 'translate'
        ? '<div class="field"><label class="sr-only" for="gq-input">Sua resposta</label><input id="gq-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Digite sua resposta em inglês…"></div>'
        : `<div class="options">${it.options.map((o, j) => `<button type="button" class="option" data-opt="${j}"><span class="letter">${'ABCDE'[j]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
      const inp = $('gq-input');
      if (inp) { inp.focus(); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } }); }
    }

    function check() {
      const it = items[i];
      let ok;
      let correct;
      if (it.kind === 'translate') {
        const inp = $('gq-input');
        if (!inp.value.trim()) return inp.focus();
        ok = it.accepted.some((a) => Act.same(inp.value, a));
        correct = it.accepted[0];
        inp.disabled = true;
      } else {
        if (chosen === null) return Novera.toast('Escolha uma alternativa.');
        ok = chosen === it.answer;
        correct = it.options[it.answer];
        stage.querySelectorAll('[data-opt]').forEach((b) => {
          const j = Number(b.dataset.opt);
          b.disabled = true;
          b.classList.toggle('opt-correct', j === it.answer);
          b.classList.toggle('opt-wrong', j === chosen && !ok);
        });
      }
      if (ok) score += 1;
      progress(i + 1, score, items.length, { i: i + 1, score });
      const fb = q('[data-feedback]');
      fb.hidden = false;
      fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
      fb.innerHTML = ok ? '✅ Correto!' : `❌ Resposta esperada: <b>${esc(correct)}</b>`;
      q('[data-check]').hidden = true;
      const next = q('[data-next]');
      next.hidden = false;
      next.textContent = i === items.length - 1 ? 'Ver resultado' : 'Próxima →';
      next.focus();
    }

    stage.addEventListener('click', (e) => {
      const b = e.target.closest('[data-opt]');
      if (!b || b.disabled) return;
      chosen = Number(b.dataset.opt);
      stage.querySelectorAll('[data-opt]').forEach((x) => x.classList.toggle('selected', x === b));
    });
    q('[data-check]').addEventListener('click', check);
    q('[data-next]').addEventListener('click', () => {
      if (i < items.length - 1) { i += 1; show(); return; }
      q('[data-bar]').style.width = '100%';
      stage.querySelector('.gq-card').hidden = true;
      finish(score, items.length);
    });
    const saved = takeResume(items.length);
    if (saved) {
      i = clampInt(saved.i, 0, items.length);
      score = clampInt(saved.score, 0, i);
      if (i >= items.length) { stage.querySelector('.gq-card').hidden = true; finish(score, items.length); return; }
    }
    show();
  }

  // ====================================================================== MONTE A FRASE
  function playWordOrder() {
    const sentences = data.sentences;
    let i = 0;
    let score = 0;
    let placed = [];
    let pool = [];
    let checked = false;

    stage.innerHTML = `
      <div class="card wo-card">
        <div class="progress"><span data-bar></span></div>
        <div class="q-meta"><span data-count></span><span>Clique nas palavras na ordem certa</span></div>
        <p class="wo-hint" data-hint></p>
        <div class="wo-answer" data-answer aria-live="polite"></div>
        <p class="small dim">Palavras disponíveis</p>
        <div class="wo-pool" data-pool></div>
        <div class="feedback" data-feedback hidden></div>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost" data-reset>↺ Resetar</button>
          <button type="button" class="btn btn-ghost btn-sm" data-listen>🔊 Ouvir</button>
          <button type="button" class="btn" data-check disabled>Verificar</button>
          <button type="button" class="btn" data-next hidden>Próxima →</button>
        </div>
      </div>`;
    const q = (s) => stage.querySelector(s);

    function draw() {
      q('[data-answer]').innerHTML = placed.length
        ? placed.map((w, k) => `<button type="button" class="chip chip-placed" data-unplace="${k}" ${checked ? 'disabled' : ''}>${esc(w.text)}</button>`).join('')
        : '<span class="small dim">As palavras escolhidas aparecem aqui.</span>';
      q('[data-pool]').innerHTML = pool.map((w, k) => `<button type="button" class="chip" data-take="${k}" ${checked ? 'disabled' : ''}>${esc(w.text)}</button>`).join('');
      q('[data-check]').disabled = pool.length > 0 || checked;
    }

    function show() {
      const s = sentences[i];
      const words = s.en.split(/\s+/).map((text, id) => ({ text, id }));
      let shuffled = Act.shuffle(words);
      if (words.length > 1) while (shuffled.every((w, k) => w.id === k)) shuffled = Act.shuffle(words);
      pool = shuffled;
      placed = [];
      checked = false;
      q('[data-bar]').style.width = `${(i / sentences.length) * 100}%`;
      q('[data-count]').textContent = `Frase ${i + 1} de ${sentences.length}`;
      q('[data-hint]').innerHTML = `<span class="small dim">Em português:</span> ${esc(s.pt)}`;
      q('[data-feedback]').hidden = true;
      q('[data-check]').hidden = false;
      q('[data-next]').hidden = true;
      q('[data-reset]').disabled = false;
      draw();
    }

    stage.addEventListener('click', (e) => {
      const take = e.target.closest('[data-take]');
      const back = e.target.closest('[data-unplace]');
      if (take && !take.disabled) { placed.push(pool.splice(Number(take.dataset.take), 1)[0]); draw(); }
      if (back && !back.disabled) { pool.push(placed.splice(Number(back.dataset.unplace), 1)[0]); draw(); }
    });
    q('[data-reset]').addEventListener('click', () => { pool = pool.concat(placed); placed = []; draw(); });
    q('[data-listen]').addEventListener('click', () => { Act.stopSpeaking(); Act.speak(sentences[i].en).catch((err) => Novera.toast(err.message)); });
    q('[data-check]').addEventListener('click', () => {
      const s = sentences[i];
      const ok = Act.same(placed.map((w) => w.text).join(' '), s.en);
      if (ok) score += 1;
      progress(i + 1, score, sentences.length, { i: i + 1, score });
      checked = true;
      draw();
      q('[data-answer]').classList.toggle('is-ok', ok);
      q('[data-answer]').classList.toggle('is-bad', !ok);
      const fb = q('[data-feedback]');
      fb.hidden = false;
      fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
      fb.innerHTML = ok ? '✅ Isso mesmo!' : `❌ A ordem certa é: <b>${esc(s.en)}</b>`;
      q('[data-check]').hidden = true;
      q('[data-reset]').disabled = true;
      const next = q('[data-next]');
      next.hidden = false;
      next.textContent = i === sentences.length - 1 ? 'Ver resultado' : 'Próxima →';
      next.focus();
    });
    q('[data-next]').addEventListener('click', () => {
      q('[data-answer]').classList.remove('is-ok', 'is-bad');
      if (i < sentences.length - 1) { i += 1; show(); return; }
      stage.querySelector('.wo-card').hidden = true;
      finish(score, sentences.length);
    });
    const saved = takeResume(sentences.length);
    if (saved) {
      i = clampInt(saved.i, 0, sentences.length);
      score = clampInt(saved.score, 0, i);
      if (i >= sentences.length) { stage.querySelector('.wo-card').hidden = true; finish(score, sentences.length); return; }
    }
    show();
  }

  // ====================================================================== CORRIGIR TEXTOS
  function playTextCorrection() {
    // Quebra o texto em tokens: palavras normais e erros marcados [errado|certo].
    const tokens = [];
    const re = /\[([^|\]]+)\|([^\]]+)\]/g;
    let last = 0;
    let m;
    const pushPlain = (s) => s.split(/(\s+)/).forEach((p) => { if (p) tokens.push({ text: p, space: /^\s+$/.test(p) }); });
    while ((m = re.exec(data.text))) {
      pushPlain(data.text.slice(last, m.index));
      tokens.push({ text: m[1], fix: m[2], error: true });
      last = re.lastIndex;
    }
    pushPlain(data.text.slice(last));
    const total = tokens.filter((t) => t.error).length;

    stage.innerHTML = `
      <div class="card tc-card">
        <p class="notice-info">🔎 Este texto tem <b>${total} erros</b>. Clique nas palavras erradas e depois em <b>Concluir</b>.</p>
        <div class="tc-text" data-text>${tokens.map((t, k) => {
          if (t.space) return ' ';
          if (!/[A-Za-z0-9]/.test(t.text)) return `<span>${esc(t.text)}</span>`;
          return `<button type="button" class="tc-word" data-k="${k}" aria-pressed="false">${esc(t.text)}</button>`;
        }).join('')}</div>
        <p class="small dim" data-sel>0 palavras marcadas</p>
        <div class="feedback" data-feedback hidden></div>
        <button type="button" class="btn btn-block" data-done>Concluir</button>
      </div>`;
    const q = (s) => stage.querySelector(s);
    const selected = new Set();
    let done = false;

    const mark = (b, k, on) => {
      if (on) selected.add(k); else selected.delete(k);
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
      q('[data-sel]').textContent = `${selected.size} ${selected.size === 1 ? 'palavra marcada' : 'palavras marcadas'}`;
    };
    q('[data-text]').addEventListener('click', (e) => {
      const b = e.target.closest('.tc-word');
      if (!b || done) return;
      const k = Number(b.dataset.k);
      mark(b, k, !selected.has(k));
      const hits = [...selected].filter((s) => tokens[s].error).length;
      progress(Math.min(selected.size, total), Math.min(hits, total), total, { selected: [...selected] });
    });
    const saved = takeResume(total);
    if (Array.isArray(saved?.selected)) {
      saved.selected.forEach((k) => {
        const b = Number.isInteger(k) && stage.querySelector(`.tc-word[data-k="${k}"]`);
        if (b) mark(b, k, true);
      });
    }

    q('[data-done]').addEventListener('click', () => {
      done = true;
      let found = 0;
      let wrongPicks = 0;
      stage.querySelectorAll('.tc-word').forEach((b) => {
        const k = Number(b.dataset.k);
        const t = tokens[k];
        b.disabled = true;
        if (t.error && selected.has(k)) { found += 1; b.classList.add('tc-found'); b.innerHTML = `<s>${esc(t.text)}</s> ${esc(t.fix)}`; }
        else if (t.error) { b.classList.add('tc-missed'); b.innerHTML = `<s>${esc(t.text)}</s> ${esc(t.fix)}`; }
        else if (selected.has(k)) { wrongPicks += 1; b.classList.add('tc-false'); }
      });
      const score = Math.max(0, found - wrongPicks);
      const fb = q('[data-feedback]');
      fb.hidden = false;
      fb.className = 'feedback';
      fb.innerHTML = `Você encontrou <b>${found} de ${total}</b> erros${wrongPicks ? ` e marcou <b>${wrongPicks}</b> palavra(s) que estavam certas (cada uma desconta 1 ponto)` : ''}.
        <div class="legend"><span class="tc-found">encontrado</span><span class="tc-missed">não encontrado</span><span class="tc-false">estava certa</span></div>`;
      q('[data-done]').hidden = true;
      finish(score, total);
    });
  }

  // ====================================================================== QUIZ EM VÍDEO (YouTube)
  async function playVideoQuiz() {
    const qs = data.questions;
    const answered = new Array(qs.length).fill(null);
    let score = 0;
    let open = null;
    let finished = false;

    stage.innerHTML = `
      <div class="vq-wrap">
        <div class="video-box"><div id="yt-player"></div></div>
        <!-- A pergunta aparece ABAIXO do vídeo: as regras do YouTube não permitem nada na frente do player. -->
        <div class="vq-overlay" data-overlay hidden>
          <div class="vq-modal" role="region" aria-live="polite" aria-labelledby="vq-prompt">
            <p class="small dim" data-qcount></p>
            <h2 id="vq-prompt" data-prompt></h2>
            <div class="opt-list" data-options></div>
            <div class="feedback" data-feedback hidden></div>
            <div class="row-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-rewind>↺ Rever 15s</button>
              <button type="button" class="btn" data-confirm disabled>Confirmar</button>
              <button type="button" class="btn" data-continue hidden>Continuar ▶</button>
            </div>
          </div>
        </div>
        <div class="vq-bar"><span class="small dim" data-progress>0/${qs.length} perguntas respondidas</span>
          <span class="small dim">As perguntas aparecem durante o vídeo.</span></div>
      </div>`;
    const q = (s) => stage.querySelector(s);
    const overlay = q('[data-overlay]');

    let player;
    try {
      player = await Act.youtubePlayer($('yt-player'), data.youtubeId, {
        onStateChange: (e) => { if (e.data === 0) onEnded(); },
      });
    } catch (err) {
      $('act-error').textContent = err.message;
      return;
    }

    function showQuestion(k) {
      open = k;
      player.pauseVideo();
      const it = qs[k];
      q('[data-qcount]').textContent = `Pergunta ${k + 1} de ${qs.length} · ${Act.fmtTime(it.time)}`;
      q('[data-prompt]').textContent = it.prompt;
      q('[data-options]').innerHTML = it.options.map((o, j) => `<label class="opt"><input type="radio" name="vq" value="${j}"><span>${esc(o)}</span></label>`).join('');
      q('[data-feedback]').hidden = true;
      q('[data-confirm]').hidden = false;
      q('[data-confirm]').disabled = true;
      q('[data-continue]').hidden = true;
      q('[data-rewind]').hidden = false;
      overlay.hidden = false;
      overlay.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    q('[data-options]').addEventListener('change', () => { q('[data-confirm]').disabled = false; });
    q('[data-confirm]').addEventListener('click', () => {
      const it = qs[open];
      const chosen = Number(stage.querySelector('input[name="vq"]:checked')?.value);
      const ok = chosen === it.answer;
      answered[open] = chosen;
      if (ok) score += 1;
      stage.querySelectorAll('[data-options] .opt').forEach((lab, j) => {
        lab.classList.toggle('opt-correct', j === it.answer);
        lab.classList.toggle('opt-wrong', j === chosen && !ok);
        lab.querySelector('input').disabled = true;
      });
      const fb = q('[data-feedback]');
      fb.hidden = false;
      fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
      fb.textContent = ok ? '✅ Correto!' : '❌ Não foi dessa vez — veja a resposta certa em verde.';
      q('[data-confirm]').hidden = true;
      q('[data-rewind]').hidden = true;
      q('[data-continue]').hidden = false;
      q('[data-continue]').focus();
      const n = answered.filter((a) => a !== null).length;
      q('[data-progress]').textContent = `${n}/${qs.length} perguntas respondidas`;
      progress(n, score, qs.length, { answered });
    });
    q('[data-continue]').addEventListener('click', () => {
      overlay.hidden = true;
      open = null;
      if (answered.every((a) => a !== null)) return finishVideo();
      player.playVideo();
    });
    q('[data-rewind]').addEventListener('click', () => {
      const t = qs[open].time;
      overlay.hidden = true;
      open = null;
      player.seekTo(Math.max(0, t - 15), true);
      player.playVideo();
    });

    // Verifica o tempo do vídeo e abre a pergunta quando chega a hora (também se o aluno pular).
    const timer = setInterval(() => {
      if (finished || open !== null || !player?.getCurrentTime) return;
      const now = player.getCurrentTime();
      const k = qs.findIndex((it, idx) => answered[idx] === null && now >= it.time);
      if (k >= 0) showQuestion(k);
    }, 250);

    function onEnded() {
      const k = answered.findIndex((a) => a === null);
      if (k >= 0) showQuestion(k); else finishVideo();
    }
    function finishVideo() {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      finish(score, qs.length, { retry: () => location.reload() });
    }

    // Continuar: perguntas já respondidas não aparecem de novo; o vídeo vai para a última respondida.
    const saved = takeResume(qs.length);
    if (Array.isArray(saved?.answered)) {
      let lastTime = 0;
      saved.answered.forEach((a, k) => {
        if (!qs[k] || !Number.isInteger(a) || a < 0 || a >= qs[k].options.length) return;
        answered[k] = a;
        if (a === qs[k].answer) score += 1;
        lastTime = Math.max(lastTime, qs[k].time || 0);
      });
      const n = answered.filter((a) => a !== null).length;
      q('[data-progress]').textContent = `${n}/${qs.length} perguntas respondidas`;
      if (n === qs.length) finishVideo();
      else if (lastTime > 0) { try { player.seekTo(lastTime, true); player.pauseVideo(); } catch { /* player ainda carregando */ } }
    }
  }

  // ====================================================================== MÚSICA (YouTube + letra)
  async function playSong() {
    const gaps = [];
    const lines = data.lines.map((l, li) => {
      const parts = [];
      const re = /\[([^\]]+)\]/g;
      let last = 0;
      let m;
      while ((m = re.exec(l.text))) {
        if (m.index > last) parts.push({ text: l.text.slice(last, m.index) });
        parts.push({ gap: gaps.length });
        gaps.push({ word: m[1].trim(), line: li, state: null });
        last = re.lastIndex;
      }
      if (last < l.text.length) parts.push({ text: l.text.slice(last) });
      return { time: l.time, parts };
    });
    const uniqueWords = [...new Set(gaps.map((g) => g.word.toLowerCase()))];
    const EXTRA = ['love', 'time', 'heart', 'night', 'light', 'away', 'home', 'world', 'dream', 'know', 'feel', 'say'];
    let current = 0;
    let score = 0;

    stage.innerHTML = `
      <div class="song-layout">
        <div class="song-left">
          <div class="video-box"><div id="yt-player"></div></div>
          <div class="card song-pick">
            <p class="small dim" data-gapcount></p>
            <div class="song-options" data-options></div>
            <p class="small dim">Dica: clique em uma linha com horário para ouvir aquele trecho.</p>
          </div>
        </div>
        <div class="card song-lyrics">
          <h2 class="small-title">Letra da música${data.artist ? ` · ${esc(data.artist)}` : ''}</h2>
          <ol class="lyrics" data-lyrics>${lines.map((l, li) => `
            <li data-line="${li}" ${l.time !== null ? `data-time="${l.time}" class="seekable"` : ''}>
              ${l.time !== null ? `<span class="l-time">${Act.fmtTime(l.time)}</span>` : '<span class="l-time"></span>'}
              <span class="l-text">${l.parts.map((p) => (p.text !== undefined ? esc(p.text) : `<span class="gap" data-gap="${p.gap}">____</span>`)).join('')}</span>
            </li>`).join('')}
          </ol>
        </div>
      </div>`;
    const q = (s) => stage.querySelector(s);

    let player = null;
    Act.youtubePlayer($('yt-player'), data.youtubeId).then((p) => { player = p; }).catch((err) => { $('act-error').textContent = err.message; });

    function optionsFor(k) {
      const right = gaps[k].word;
      const pool = Act.shuffle(uniqueWords.filter((w) => w !== right.toLowerCase()));
      const extra = Act.shuffle(EXTRA.filter((w) => w !== right.toLowerCase() && !pool.includes(w)));
      return Act.shuffle([right, ...pool.concat(extra).slice(0, 3)]);
    }

    function showGap() {
      stage.querySelectorAll('.gap').forEach((g) => g.classList.toggle('gap-now', Number(g.dataset.gap) === current));
      if (current >= gaps.length) {
        q('.song-pick').hidden = true;
        finish(score, gaps.length, { target: q('.song-left'), retry: () => location.reload() });
        return;
      }
      q('[data-gapcount]').textContent = `Preencha a lacuna (${current + 1}/${gaps.length}):`;
      q('[data-options]').innerHTML = optionsFor(current).map((w) => `<button type="button" class="chip" data-word="${esc(w)}">${esc(w)}</button>`).join('');
      stage.querySelector(`.gap[data-gap="${current}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    const picks = [];
    function pick(word) {
      const g = gaps[current];
      const ok = word.toLowerCase() === g.word.toLowerCase();
      if (ok) score += 1;
      picks.push(word);
      const el = stage.querySelector(`.gap[data-gap="${current}"]`);
      el.textContent = g.word;
      el.classList.add(ok ? 'gap-ok' : 'gap-bad');
      if (!ok) el.title = `Você escolheu: ${word}`;
      current += 1;
    }
    q('[data-options]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-word]');
      if (!b) return;
      pick(b.dataset.word);
      progress(current, score, gaps.length, { picks });
      showGap();
    });
    const saved = takeResume(gaps.length);
    if (Array.isArray(saved?.picks)) {
      saved.picks.slice(0, gaps.length).forEach((w) => { if (typeof w === 'string' && w.length <= 80) pick(w); });
    }

    q('[data-lyrics]').addEventListener('click', (e) => {
      const li = e.target.closest('[data-time]');
      if (li && player) { player.seekTo(Number(li.dataset.time), true); player.playVideo(); }
    });

    // Destaca a linha que está tocando.
    setInterval(() => {
      if (!player?.getCurrentTime) return;
      const t = player.getCurrentTime();
      let active = -1;
      lines.forEach((l, li) => { if (l.time !== null && t >= l.time) active = li; });
      stage.querySelectorAll('[data-line]').forEach((li) => li.classList.toggle('playing', Number(li.dataset.line) === active));
    }, 400);

    showGap();
  }

  // ====================================================================== VIDEOAULA
  async function playVideoLesson() {
    stage.innerHTML = `
      <div class="video-box"><div id="yt-player"></div></div>
      ${data.summary ? `<div class="card lesson-summary"><h2 class="small-title">Sobre esta aula</h2><p>${esc(data.summary).replace(/\n/g, '<br>')}</p></div>` : ''}
      <div class="row-actions"><button type="button" class="btn btn-ghost" data-done>✓ Assisti à aula</button></div>`;
    Act.youtubePlayer($('yt-player'), data.youtubeId).catch((err) => { $('act-error').textContent = err.message; });
    stage.querySelector('[data-done]').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      if (await Act.saveAttempt(activity.key, 1, 1)) Novera.toast('Aula marcada como assistida.');
    });
  }

  // ====================================================================== WORKSHEET
  function playWorksheet() {
    const pages = data.pages;
    let page = 0;
    const gradable = []; // { el, check() -> bool }

    const header = (p, k) => `
      <header class="ws-header">
        <div class="ws-badge"><span>${esc(activity.title)}</span><small>Worksheet · ${esc(activity.level)}</small></div>
        <div class="ws-titles"><h2>${esc(p.title)}</h2><p class="ws-instruction"><b>Instruction:</b> ${esc(p.instruction)}</p></div>
        <div class="ws-cover" aria-hidden="true">${esc(data.cover || '📄')}<small>${k + 1}/${pages.length}</small></div>
      </header>`;

    function section(p, k) {
      if (p.kind === 'learn') {
        return `<div class="ws-learn">${p.cards.map((c) => `
          <button type="button" class="ws-learn-card" data-say="${esc(c.example ? `${c.word}. ${c.example}` : c.word)}">
            <span class="ws-emoji" aria-hidden="true">${esc(c.emoji)}</span>
            <strong>${esc(c.word)}</strong>
            ${c.meaning ? `<span class="ws-meaning">${esc(c.meaning)}</span>` : ''}
            ${c.example ? `<span>${esc(c.example)}</span>` : ''}
            <span class="ws-hear" aria-hidden="true">🔊</span>
          </button>`).join('')}</div>`;
      }
      if (p.kind === 'choose') {
        return `<ol class="ws-choose">${p.items.map((it, n) => `
          <li class="ws-item" data-g="${k}-${n}">
            <span class="ws-emoji ws-emoji-lg" aria-hidden="true">${esc(it.emoji)}</span>
            <div>${it.prompt ? `<p class="ws-prompt">${esc(it.prompt)}</p>` : ''}
              ${it.options.map((o, j) => `<label class="ws-check"><input type="radio" name="ws-${k}-${n}" value="${j}"><span>${esc(o)}</span></label>`).join('')}
            </div>
          </li>`).join('')}</ol>`;
      }
      if (p.kind === 'match') {
        const rights = Act.shuffle(p.pairs.map((pr) => pr.right));
        return `<div class="ws-match">${p.pairs.map((pr, n) => `
          <div class="ws-match-row" data-g="${k}-${n}">
            <span class="ws-match-left">${esc(pr.left)}</span>
            <span class="ws-dot" aria-hidden="true">•</span>
            <label class="sr-only" for="ws-m-${k}-${n}">Ligue com</label>
            <select id="ws-m-${k}-${n}"><option value="">Escolha…</option>${rights.map((r) => `<option>${esc(r)}</option>`).join('')}</select>
          </div>`).join('')}</div>`;
      }
      if (p.kind === 'fill') {
        const opts = Act.shuffle(p.bank);
        return `
          <div class="ws-bank"><b>Word box:</b> ${p.bank.map((w) => `<span class="chip chip-static">${esc(w)}</span>`).join('')}</div>
          <ol class="ws-fill">${p.sentences.map((s, n) => {
            const html = esc(s).replace(/\[([^\]]+)\]/, () => `<select aria-label="Lacuna ${n + 1}"><option value="">______</option>${opts.map((w) => `<option>${esc(w)}</option>`).join('')}</select>`);
            return `<li class="ws-fill-row" data-g="${k}-${n}">${html}</li>`;
          }).join('')}</ol>`;
      }
      return '';
    }

    stage.innerHTML = `
      <div class="ws-toolbar">
        <button type="button" class="btn btn-ghost btn-icon" data-prev aria-label="Página anterior">‹</button>
        <span class="small" data-pageinfo></span>
        <button type="button" class="btn btn-ghost btn-icon" data-next aria-label="Próxima página">›</button>
        <span class="ws-spacer"></span>
        <button type="button" class="btn btn-ghost btn-sm" data-print>🖨️ Imprimir</button>
        <button type="button" class="btn btn-sm" data-check>Corrigir</button>
      </div>
      <div class="ws-pages ws-theme-${esc(data.theme || 'violet')}">
        ${pages.map((p, k) => `<section class="ws-page" data-page="${k}" ${k ? 'hidden' : ''}>${header(p, k)}<div class="ws-content">${section(p, k)}</div></section>`).join('')}
      </div>
      <div data-result></div>`;
    const q = (s) => stage.querySelector(s);

    // Itens corrigíveis
    pages.forEach((p, k) => {
      if (p.kind === 'choose') p.items.forEach((it, n) => gradable.push({ el: q(`[data-g="${k}-${n}"]`), page: k, check: (el) => Number(el.querySelector('input:checked')?.value) === it.answer, show: (el) => el.querySelectorAll('.ws-check').forEach((l, j) => l.classList.toggle('opt-correct', j === it.answer)) }));
      if (p.kind === 'match') p.pairs.forEach((pr, n) => gradable.push({ el: q(`[data-g="${k}-${n}"]`), page: k, check: (el) => el.querySelector('select').value === pr.right, show: (el) => { el.dataset.answer = pr.right; } }));
      if (p.kind === 'fill') p.sentences.forEach((s, n) => {
        const right = /\[([^\]]+)\]/.exec(s)[1];
        gradable.push({ el: q(`[data-g="${k}-${n}"]`), page: k, check: (el) => el.querySelector('select').value === right, show: (el) => { el.dataset.answer = right; } });
      });
    });

    function go(k) {
      page = Math.max(0, Math.min(pages.length - 1, k));
      stage.querySelectorAll('.ws-page').forEach((s) => { s.hidden = Number(s.dataset.page) !== page; });
      q('[data-pageinfo]').textContent = `Página ${page + 1} de ${pages.length}`;
      q('[data-prev]').disabled = page === 0;
      q('[data-next]').disabled = page === pages.length - 1;
    }
    q('[data-prev]').addEventListener('click', () => go(page - 1));
    q('[data-next]').addEventListener('click', () => go(page + 1));
    q('[data-print]').addEventListener('click', () => window.print());
    let corrected = false;
    // Resposta de cada item (rádio escolhido ou opção da lista) — para continuar de onde parou.
    const valueOf = (el) => el.querySelector('input:checked')?.value ?? el.querySelector('select')?.value ?? '';
    stage.addEventListener('change', () => {
      if (corrected) return;
      const filled = gradable.filter((g) => valueOf(g.el) !== '');
      progress(filled.length, filled.filter((g) => g.check(g.el)).length, gradable.length, { values: gradable.map((g) => valueOf(g.el)) });
    });
    const saved = takeResume(gradable.length);
    if (Array.isArray(saved?.values)) {
      saved.values.slice(0, gradable.length).forEach((v, n) => {
        if (typeof v !== 'string' || !v) return;
        const el = gradable[n].el;
        const radio = [...el.querySelectorAll('input[type=radio]')].find((r) => r.value === v);
        if (radio) radio.checked = true;
        const sel = el.querySelector('select');
        if (sel && [...sel.options].some((o) => o.value === v)) sel.value = v;
      });
    }
    stage.addEventListener('click', (e) => {
      const c = e.target.closest('[data-say]');
      if (c) { Act.stopSpeaking(); Act.speak(c.dataset.say).catch((err) => Novera.toast(err.message)); }
    });
    q('[data-check]').addEventListener('click', () => {
      corrected = true;
      let score = 0;
      const wrongPages = new Set();
      gradable.forEach((g) => {
        const ok = g.check(g.el);
        if (ok) score += 1; else wrongPages.add(g.page + 1);
        g.el.classList.toggle('ws-ok', ok);
        g.el.classList.toggle('ws-bad', !ok);
        if (!ok) g.show(g.el);
      });
      q('[data-result]').innerHTML = '';
      const extra = wrongPages.size ? `Revise as páginas ${[...wrongPages].join(', ')} — a resposta certa aparece em destaque.` : '';
      if (extra) Novera.toast(extra);
      finish(score, gradable.length, { target: q('[data-result]'), retry: () => { location.reload(); } });
    });
    go(0);
  }

  const PLAYERS = {
    listen: playListen,
    dictation: playDictation,
    grammar_lesson: playLesson,
    grammar_quiz: playGrammarQuiz,
    word_order: playWordOrder,
    text_correction: playTextCorrection,
    quiz: playVideoQuiz,
    // Música: quiz no clipe oficial (perguntas durante o vídeo) ou letra com lacunas.
    song: () => (data.questions ? playVideoQuiz() : playSong()),
    video_lesson: playVideoLesson,
    worksheet: playWorksheet,
  };

  function start() {
    Act.stopSpeaking();
    stage.innerHTML = '';
    (PLAYERS[activity.type] || (() => { stage.innerHTML = '<p class="muted">Tipo de atividade não suportado.</p>'; }))();
  }

  window.addEventListener('beforeunload', () => Act.stopSpeaking());
  start();
})();
