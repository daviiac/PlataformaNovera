(async () => {
  const { api, requireUser, renderTopbar, esc, formatBytes, formatDate, openViewer, toast } = Novera;
  // Busca a visão geral junto com o usuário (uma espera a menos ao abrir a página).
  const overviewP = api('/api/tracks').catch((err) => err);
  const user = await requireUser();
  if (user.role === 'student' && !user.level) return window.location.replace('/nivelamento');
  renderTopbar(user, 'trilha');
  Novera.showPendingBanner(user, document.querySelector('main'));

  const $ = (id) => document.getElementById(id);
  const isStudent = user.role === 'student';
  const NAMES = { A1: 'Iniciante', A2: 'Básico', B2: 'Intermediário superior' };
  const PALETTE = ['#f9d56e', '#7ed6a5', '#7ec8d6', '#8ab6f9', '#b9b4f5', '#d8a7f2', '#f2a7c8', '#f9b48a', '#a3e4a6', '#e88b8b', '#f6c178', '#9ad1f5'];

  let overview = await overviewP;
  if (overview instanceof Error) overview = await api('/api/tracks');
  const unlocked = overview.unlocked;
  const params = new URLSearchParams(location.search);
  let current = (params.get('nivel') || user.level || unlocked[unlocked.length - 1] || 'A1').toUpperCase();
  if (!unlocked.includes(current)) current = user.level || unlocked[0];

  // ------------------------------------------------------------ céu animado
  (function buildSky() {
    const sky = $('space-sky');
    const rnd = (a, b) => a + Math.random() * (b - a);
    let html = '';
    for (let i = 0; i < 70; i += 1) {
      const big = Math.random() < 0.15;
      html += `<i class="star${big ? ' big' : ''}" data-x="${rnd(0, 100).toFixed(1)}" data-y="${rnd(0, 100).toFixed(1)}" data-d="${rnd(0, 4).toFixed(2)}"></i>`;
    }
    for (let i = 0; i < 3; i += 1) html += `<i class="shooting s${i + 1}"></i>`;
    html += '<span class="rocket r1">🚀</span><span class="rocket r2">🚀</span><span class="rocket r3">🛸</span>';
    html += '<span class="planet-deco p1"></span><span class="planet-deco p2"></span>';
    sky.innerHTML = html;
    // Posições via CSSOM (a CSP não permite estilo inline no HTML).
    sky.querySelectorAll('.star').forEach((s) => {
      s.style.left = `${s.dataset.x}%`;
      s.style.top = `${s.dataset.y}%`;
      s.style.animationDelay = `${s.dataset.d}s`;
    });
  }());

  // ------------------------------------------------------------ níveis (planetas)
  function renderPlanets() {
    $('planets').innerHTML = overview.tracks.map((t) => `
      <button type="button" class="planet lv-${t.level} ${t.level === current ? 'active' : ''} ${t.locked ? 'locked' : ''}"
              data-level="${t.level}" aria-pressed="${t.level === current}" ${t.locked ? 'aria-disabled="true"' : ''}>
        <span class="planet-orb" aria-hidden="true">${t.locked ? '🔒' : t.level}</span>
        <span class="planet-name">${t.level} · ${esc(NAMES[t.level])}</span>
        <span class="planet-meta">${t.locked ? 'Liberado pela professora' : `${t.lessons} aulas${t.homework ? ` · ${t.homework} homeworks` : ''}`}</span>
        ${t.level === user.level ? '<span class="tag tag-own">Seu nível</span>' : ''}
      </button>`).join('');
  }

  function renderStatus() {
    if (!isStudent) {
      $('level-status').innerHTML = '<span class="tag">Visão da equipe: todos os níveis liberados</span>';
      return;
    }
    const last = overview.history.find((h) => h.from && h.to);
    $('level-status').innerHTML = `
      <span class="lvl-pill now">Nível atual <b class="level-badge level-${esc(user.level)}">${esc(user.level)}</b></span>
      ${last ? `<span class="lvl-pill">Nível anterior <b class="level-badge level-${esc(last.from)}">${esc(last.from)}</b></span>
        <span class="small dim">Alterado${last.by ? ` por ${esc(last.by)}` : ''} em ${formatDate(last.at)}</span>` : ''}`;
  }

  $('planets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    if (b.classList.contains('locked')) return toast('🔒 Este nível será liberado pela sua professora.');
    current = b.dataset.level;
    history.replaceState(null, '', `?nivel=${current}`);
    load();
  });

  // ------------------------------------------------------------ mapa de aulas
  let lessons = [];

  function perRow() {
    const w = $('map-rows').clientWidth;
    if (w < 560) return 0; // vertical
    return Math.max(3, Math.min(8, Math.floor(w / 150)));
  }

  function nodeHtml(l, i) {
    const color = PALETTE[i % PALETTE.length];
    const up = i % 2 === 1;
    const hwCount = l.homework.length;
    const hw = hwCount
      ? `<button type="button" class="hw-link" data-hw="${i}">Home Work${hwCount > 1 ? ` (${hwCount})` : ''}</button>`
      : '<span class="hw-link hw-none" aria-hidden="true"></span>';
    const card = `<button type="button" class="lesson-card ${l.url ? '' : 'no-url'} ${l.extra ? 'extra' : ''}" data-lesson="${i}" data-color="${color}"
                    title="${l.url ? 'Abrir a apresentação' : 'Material em breve'}">${l.extra ? '★ ' : ''}${esc(l.title)}</button>`;
    return `
      <div class="map-node ${up ? 'up' : 'down'}" data-color="${color}">
        <div class="slot top">${up ? hw + card : ''}</div>
        <div class="stop"><span class="stem"></span><span class="dot" data-color="${color}">${l.extra ? '★' : l.number}</span></div>
        <div class="slot bottom">${up ? '' : card + hw}</div>
      </div>`;
  }

  // Um único caminho tracejado ligando a aula 1 até a última (em "zigue-zague": as fileiras
  // alternam o sentido e se ligam por uma curva na lateral), com o foguete percorrendo-o em loop.
  function drawPaths() {
    const wrap = $('map-rows');
    const svg = wrap.querySelector('.map-svg');
    const rocket = wrap.querySelector('.map-rocket');
    if (!svg) return;
    const box = wrap.getBoundingClientRect();
    const dots = [...wrap.querySelectorAll('.dot')];
    if (!dots.length || !box.width) return;
    const pts = dots.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, row: Number(el.closest('.map-row').dataset.row) };
    });
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const R = 112; // quanto a curva entre fileiras sai para a lateral (contorna os cards)
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let k = 1; k < pts.length; k += 1) {
      const a = pts[k - 1];
      const b = pts[k];
      if (a.row !== b.row) {
        const side = a.row % 2 === 0
          ? Math.min(box.width + 16, Math.max(a.x, b.x) + R)
          : Math.max(-16, Math.min(a.x, b.x) - R);
        d += ` C ${side} ${a.y}, ${side} ${b.y}, ${b.x} ${b.y}`;
      } else if (Math.abs(a.x - b.x) < 2) {
        d += ` L ${b.x} ${b.y}`; // celular: coluna única
      } else {
        const mx = (a.x + b.x) / 2;
        d += ` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
      }
    }
    svg.innerHTML = `<path d="${d}" class="map-path"/>`;
    if (rocket && pts.length > 1) {
      const len = svg.querySelector('path').getTotalLength();
      rocket.style.offsetPath = `path("${d}")`;
      rocket.style.animationDuration = `${Math.max(8, len / 110).toFixed(1)}s`;
      rocket.hidden = false;
    }
  }

  function renderMap() {
    const n = perRow();
    lastCols = n;
    const rows = [];
    if (!n) rows.push(lessons.map((l, i) => i));
    else for (let i = 0; i < lessons.length; i += n) rows.push(lessons.slice(i, i + n).map((_, k) => i + k));
    $('map-rows').innerHTML = `
      <svg class="map-svg" aria-hidden="true" preserveAspectRatio="none"></svg>
      <span class="map-rocket" aria-hidden="true" hidden>🚀</span>
      ${rows.map((idx, r) => `
      <div class="map-row ${n ? '' : 'vertical'}" data-row="${r}" ${n ? `data-cols="${idx.length}"` : ''}>
        ${idx.map((i) => nodeHtml(lessons[i], i)).join('')}
      </div>`).join('')}`;
    document.querySelectorAll('.map-row[data-cols]').forEach((row) => {
      row.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
      // Fileiras ímpares andam da direita para a esquerda (o caminho continua sem cortar a tela).
      const reverse = Number(row.dataset.row) % 2 === 1;
      [...row.querySelectorAll('.map-node')].forEach((node, k) => {
        node.style.gridRow = '1';
        node.style.gridColumn = String(reverse ? n - k : k + 1);
      });
    });
    document.querySelectorAll('[data-color]').forEach((el) => {
      if (el.classList.contains('dot') || el.classList.contains('lesson-card')) el.style.setProperty('--c', el.dataset.color);
      if (el.classList.contains('map-node')) el.style.setProperty('--c', el.dataset.color);
    });
    drawPaths();
    requestAnimationFrame(drawPaths);
  }

  // Redesenha ao mudar o tamanho (troca de colunas) e quando a altura muda (fontes carregando etc.).
  let resizeTimer;
  let lastCols = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!lessons.length) return;
      if (perRow() !== lastCols) renderMap(); else drawPaths();
    }, 150);
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => lessons.length && drawPaths()).observe($('map-rows'));

  $('map-rows').addEventListener('click', (e) => {
    const card = e.target.closest('[data-lesson]');
    if (card) {
      const l = lessons[Number(card.dataset.lesson)];
      if (l.embed) openPresentation(l);
      else if (l.url) window.open(l.url, '_blank', 'noopener');
      else toast('A apresentação desta aula estará disponível em breve.');
      return;
    }
    const hw = e.target.closest('[data-hw]');
    if (hw) openHomework(lessons[Number(hw.dataset.hw)]);
  });

  // ------------------------------------------------------------ apresentação (Canva, só visualização)
  function openPresentation(lesson) {
    const back = document.activeElement;
    const el = document.createElement('div');
    el.className = 'viewer';
    el.innerHTML = `
      <div class="viewer-panel" role="dialog" aria-modal="true" aria-label="${esc(lesson.title)}">
        <div class="viewer-head">
          <div class="mat-icon kind-video">AULA</div>
          <div class="grow">
            <strong>${esc(current)} · ${String(lesson.number).padStart(2, '0')} — ${esc(lesson.title)}</strong>
            <span class="meta">Use as setas para passar os slides · ⛶ no canto para tela cheia</span>
          </div>
          <div class="viewer-actions">
            <a class="btn btn-ghost btn-sm" href="${esc(lesson.url)}" target="_blank" rel="noopener">↗ <span class="btn-label">Abrir em nova aba</span></a>
            <button class="btn btn-ghost btn-icon" type="button" data-close aria-label="Fechar">✕</button>
          </div>
        </div>
        <div class="viewer-body">
          <div class="viewer-loading">Carregando apresentação…</div>
          <div class="viewer-message canva-fallback" hidden>
            <div class="mat-icon kind-video">AULA</div>
            <p><strong>Seu navegador não mostrou a apresentação aqui dentro.</strong></p>
            <p class="small">Sem problema: abra no modo de visualização em uma nova aba.</p>
            <a class="btn" href="${esc(lesson.url)}" target="_blank" rel="noopener">Abrir apresentação ↗</a>
          </div>
          <iframe class="canva-frame" src="${esc(lesson.embed)}" title="${esc(lesson.title)}"
                  allow="fullscreen" allowfullscreen loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
      </div>`;
    // Se o navegador bloquear o quadro (política de segurança, extensão, cache antigo…),
    // troca na hora pelo botão de abrir em nova aba: o aluno nunca fica sem a aula.
    const frame = el.querySelector('iframe');
    let loaded = false;
    const fallback = () => {
      if (!el.isConnected) return;
      frame.remove();
      el.querySelector('.viewer-loading')?.remove();
      el.querySelector('.canva-fallback').hidden = false;
    };
    const onViolation = (e) => {
      if (/canva\.com/.test(e.blockedURI || '') || e.violatedDirective?.startsWith('frame-src')) fallback();
    };
    document.addEventListener('securitypolicyviolation', onViolation);
    frame.addEventListener('load', () => { loaded = true; }, { once: true });
    const slow = setTimeout(() => { if (!loaded) fallback(); }, 20000);
    const close = () => {
      clearTimeout(slow);
      document.removeEventListener('securitypolicyviolation', onViolation);
      el.remove();
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('viewer-open');
      back?.focus();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) close(); });
    el.querySelector('iframe').addEventListener('load', () => el.querySelector('.viewer-loading')?.remove(), { once: true });
    document.addEventListener('keydown', onKey);
    document.body.classList.add('viewer-open');
    document.body.appendChild(el);
    el.querySelector('[data-close]').focus();
  }

  // ------------------------------------------------------------ homework
  const hwMaterial = (h) => ({
    title: `${h.code} — ${h.title}`, originalName: `${h.title}.pdf`, description: h.description, size: h.size || 0,
    kind: 'pdf', ext: 'pdf', preview: 'native',
    viewUrl: `/api/tracks/homework/${encodeURIComponent(h.key)}/file?inline=1`,
    downloadUrl: `/api/tracks/homework/${encodeURIComponent(h.key)}/file`,
  });

  // ---------- envio do homework pelo aluno (foto, PDF ou Word) ----------
  const HW_ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.pdf,.doc,.docx,image/*,application/pdf';
  const HW_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf', 'doc', 'docx'];
  const HW_MAX_MB = 10;
  const FILE_ICON = { image: '🖼️', pdf: '📄', document: '📝' };

  /** Link para abrir o arquivo enviado: foto e PDF na tela, Word (.docx) como página, o resto baixa. */
  const sentFileUrl = (f) => (f.ext === 'docx' ? `/api/homework/uploads/${f.id}/preview`
    : (f.kind === 'pdf' || (f.kind === 'image' && f.ext !== 'heic')) ? `${f.url}?inline=1` : f.url);

  function submissionHtml(h, i) {
    const s = h.submission || { files: [], review: null, pending: false };
    const r = s.review;
    let status = '';
    if (s.pending && r) status = '<p class="hw-status wait">⏳ Novo envio aguardando a correção da professora.</p>';
    else if (s.pending) status = '<p class="hw-status wait">⏳ Enviado! Aguardando a correção da professora.</p>';
    if (r && !s.pending) {
      status = r.verdict === 'correct'
        ? '<p class="hw-status ok">✅ <b>Correto!</b> A professora corrigiu o seu homework.</p>'
        : '<p class="hw-status redo">🔁 <b>Refazer.</b> Confira o comentário, refaça e envie de novo.</p>';
    }
    const note = r && r.note
      ? `<p class="hw-note"><b>Comentário da professora${r.at ? ` (${formatDate(r.at)})` : ''}:</b> <span></span></p>` : '';
    const files = s.files.length
      ? `<ul class="hw-files">${s.files.map((f) => `
          <li>${FILE_ICON[f.kind] || '📎'} <a href="${esc(sentFileUrl(f))}" target="_blank" rel="noopener">${esc(f.name)}</a>
            <span class="dim">· ${formatBytes(f.size)} · ${formatDate(f.at)}</span>
            ${f.canRemove ? `<button type="button" class="link-btn" data-remove-file="${f.id}" data-hw="${i}">remover</button>` : ''}</li>`).join('')}
        </ul>` : '';
    return `<div class="hw-send" data-hw-box="${i}">
        ${status}${note}${files}
        <p class="hw-progress small" role="status" aria-live="polite"></p>
      </div>`;
  }

  function hwItemHtml(h, i) {
    const sent = h.submission?.files?.length;
    return `
      <li class="hw-item ${h.available ? '' : 'soon'}" data-hw-item="${i}">
        <span class="hw-code">${esc(h.code)}</span>
        <div class="hw-info">
          <strong>${esc(h.title)}</strong>
          <span class="small muted">${esc(h.description)}</span>
          <span class="small dim">${h.pages} páginas${h.size ? ` · ${formatBytes(h.size)}` : ''}</span>
        </div>
        <div class="hw-actions">
          ${h.available
            ? `<button type="button" class="btn btn-ghost btn-sm" data-open-hw="${i}">Abrir</button>
               <a class="btn btn-sm" href="/api/tracks/homework/${encodeURIComponent(h.key)}/file" download>Baixar</a>
               ${isStudent ? `<label class="btn btn-sm btn-upload" title="Foto, PDF ou Word (até ${HW_MAX_MB} MB)">📤 ${sent ? 'Enviar mais' : 'Enviar Homework/Script'}
                 <input type="file" accept="${HW_ACCEPT}" multiple hidden data-upload-hw="${i}"></label>` : ''}`
            : '<span class="tag">Em breve</span>'}
        </div>
        ${isStudent && h.available ? submissionHtml(h, i) : ''}
      </li>`;
  }

  /** PUT do arquivo com progresso (fetch não informa progresso de envio). */
  function putFile(upload, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(upload.method || 'PUT', upload.url);
      Object.entries(upload.headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.addEventListener('progress', (ev) => { if (ev.lengthComputable) onProgress(ev.loaded / ev.total); });
      xhr.addEventListener('load', () => (xhr.status >= 200 && xhr.status < 300
        ? resolve() : reject(new Error(`Falha ao enviar o arquivo (erro ${xhr.status}). Tente de novo.`))));
      xhr.addEventListener('error', () => reject(new Error('Sem conexão durante o envio. Tente de novo.')));
      xhr.send(file);
    });
  }

  async function sendFiles(lesson, i, fileList) {
    const h = lesson.homework[i];
    const files = [...fileList];
    const box = () => $('hw-list').querySelector(`[data-hw-box="${i}"] .hw-progress`);
    let ok = 0;
    for (const [n, file] of files.entries()) {
      const label = files.length > 1 ? `(${n + 1} de ${files.length}) ` : '';
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!HW_EXTS.includes(ext)) { toast(`"${file.name}": envie foto, PDF ou Word.`); continue; }
      if (file.size > HW_MAX_MB * 1024 * 1024) { toast(`"${file.name}" tem mais de ${HW_MAX_MB} MB.`); continue; }
      try {
        box().textContent = `${label}Enviando ${file.name}…`;
        const start = await api(`/api/homework/${encodeURIComponent(h.key)}/uploads`, { method: 'POST', body: { originalName: file.name, size: file.size } });
        await putFile(start.upload, file, (p) => { box().textContent = `${label}Enviando ${file.name}… ${Math.round(p * 100)}%`; });
        h.submission = await api(`/api/homework/uploads/${start.id}/finish`, { method: 'POST' });
        ok += 1;
      } catch (err) {
        toast(err.message);
      }
    }
    renderHomeworkList(lesson);
    if (ok) toast(ok === 1 ? '✅ Homework enviado para a professora!' : `✅ ${ok} arquivos enviados para a professora!`);
  }

  function renderHomeworkList(lesson) {
    $('hw-list').innerHTML = lesson.homework.map(hwItemHtml).join('');
    // Comentário da professora entra como texto (nunca como HTML).
    lesson.homework.forEach((h, i) => {
      const span = $('hw-list').querySelector(`[data-hw-box="${i}"] .hw-note span`);
      if (span) span.textContent = h.submission.review.note;
    });
  }

  function openHomework(lesson) {
    $('hw-eyebrow').textContent = `${current} · Aula ${String(lesson.number).padStart(2, '0')}`;
    $('hw-title').textContent = `Home Work — ${lesson.title}`;
    renderHomeworkList(lesson);
    $('hw-overlay').hidden = false;
    document.body.classList.add('viewer-open');
    $('hw-close').focus();
    $('hw-list').onchange = (e) => {
      const input = e.target.closest('[data-upload-hw]');
      if (!input || !input.files.length) return;
      sendFiles(lesson, Number(input.dataset.uploadHw), input.files);
      input.closest('label').classList.add('is-busy');
    };
    $('hw-list').onclick = async (e) => {
      const rm = e.target.closest('[data-remove-file]');
      if (rm) {
        const h = lesson.homework[Number(rm.dataset.hw)];
        if (!confirm('Remover este arquivo? A professora não vai mais vê-lo.')) return;
        try {
          h.submission = await api(`/api/homework/uploads/${rm.dataset.removeFile}`, { method: 'DELETE' });
          renderHomeworkList(lesson);
        } catch (err) { toast(err.message); }
        return;
      }
      const b = e.target.closest('[data-open-hw]');
      if (!b) return;
      const avail = lesson.homework.filter((h) => h.available);
      const idx = avail.indexOf(lesson.homework[Number(b.dataset.openHw)]);
      closeHomework();
      openViewer(avail.map(hwMaterial), idx);
    };
  }
  function closeHomework() {
    $('hw-overlay').hidden = true;
    document.body.classList.remove('viewer-open');
  }
  $('hw-close').addEventListener('click', closeHomework);
  $('hw-overlay').addEventListener('click', (e) => { if (e.target.id === 'hw-overlay') closeHomework(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('hw-overlay').hidden) closeHomework(); });

  // ------------------------------------------------------------ carregar nível
  // Link da notificação (ex.: homework corrigido): /trilha?nivel=B2#hw=<chave> abre o homework.
  function openHomeworkFromHash() {
    const m = /^#hw=([a-z0-9-]+)$/.exec(location.hash);
    if (!m) return;
    const lesson = lessons.find((l) => l.homework.some((h) => h.key === m[1]));
    if (!lesson) return;
    history.replaceState(null, '', location.pathname + location.search);
    openHomework(lesson);
  }
  window.addEventListener('hashchange', openHomeworkFromHash);

  async function load() {
    document.querySelector('.space').className = `space lv-${current}`;
    document.querySelector('.lesson-map').className = `lesson-map lv-${current}`;
    renderPlanets();
    renderStatus();
    $('track-error').textContent = '';
    $('map-rows').innerHTML = '<p class="muted">Carregando…</p>';
    try {
      const map = await api(`/api/tracks/${current}/lessons`);
      document.title = `Novera · Trilha ${current}`;
      $('trail-level').textContent = `${current} · ${NAMES[current]}`;
      $('trail-desc').textContent = map.track.description;
      $('map-title').textContent = `${current} Lessons`;
      $('map-level-name').textContent = NAMES[current];
      lessons = map.lessons;
      renderMap();
      openHomeworkFromHash();
    } catch (err) {
      $('map-rows').innerHTML = '';
      if (err.code === 'PLACEMENT_REQUIRED') return window.location.replace('/nivelamento');
      $('track-error').textContent = err.message;
    }
  }

  load();
})();
