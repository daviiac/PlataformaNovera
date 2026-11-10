(async () => {
  const { api, requireUser, renderTopbar, esc, formatBytes, formatDate, iconLabel, openViewer, toast } = Novera;
  const user = await requireUser();
  if (user.role === 'student' && !user.level) return window.location.replace('/nivelamento');
  renderTopbar(user, 'trilha');

  const $ = (id) => document.getElementById(id);
  const isStudent = user.role === 'student';
  const NAMES = { A1: 'Iniciante', A2: 'Básico', B2: 'Intermediário superior' };
  const PALETTE = ['#f9d56e', '#7ed6a5', '#7ec8d6', '#8ab6f9', '#b9b4f5', '#d8a7f2', '#f2a7c8', '#f9b48a', '#a3e4a6', '#e88b8b', '#f6c178', '#9ad1f5'];

  const overview = await api('/api/tracks');
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

  function drawPaths() {
    document.querySelectorAll('.map-row').forEach((row) => {
      const svg = row.querySelector('svg');
      const box = row.getBoundingClientRect();
      const pts = [...row.querySelectorAll('.dot')].map((d) => {
        const r = d.getBoundingClientRect();
        return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
      });
      if (!pts.length) return;
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      const vertical = row.classList.contains('vertical');
      let d;
      if (vertical) {
        d = `M ${pts[0][0]} 0 ` + pts.map(([x, y]) => `L ${x} ${y}`).join(' ') + ` L ${pts[pts.length - 1][0]} ${box.height}`;
      } else {
        const all = [[0, pts[0][1] + (pts[0][1] < box.height / 2 ? 18 : -18)], ...pts, [box.width, pts[pts.length - 1][1] + (pts[pts.length - 1][1] < box.height / 2 ? 18 : -18)]];
        d = `M ${all[0][0]} ${all[0][1]}`;
        for (let k = 1; k < all.length; k += 1) {
          const [x0, y0] = all[k - 1];
          const [x1, y1] = all[k];
          const mx = (x0 + x1) / 2;
          d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
        }
      }
      svg.innerHTML = `<path d="${d}" class="map-path"/>`;
    });
  }

  function renderMap() {
    const n = perRow();
    lastCols = n;
    const rows = [];
    if (!n) rows.push(lessons.map((l, i) => i));
    else for (let i = 0; i < lessons.length; i += n) rows.push(lessons.slice(i, i + n).map((_, k) => i + k));
    $('map-rows').innerHTML = rows.map((idx) => `
      <div class="map-row ${n ? '' : 'vertical'}" ${n ? `data-cols="${idx.length}"` : ''}>
        <svg class="map-svg" aria-hidden="true" preserveAspectRatio="none"></svg>
        ${idx.map((i) => nodeHtml(lessons[i], i)).join('')}
      </div>`).join('');
    document.querySelectorAll('.map-row[data-cols]').forEach((r) => { r.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`; });
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
      if (l.url) window.open(l.url, '_blank', 'noopener');
      else toast('A apresentação desta aula estará disponível em breve.');
      return;
    }
    const hw = e.target.closest('[data-hw]');
    if (hw) openHomework(lessons[Number(hw.dataset.hw)]);
  });

  // ------------------------------------------------------------ homework
  const hwMaterial = (h) => ({
    title: `${h.code} — ${h.title}`, originalName: `${h.title}.pdf`, description: h.description, size: h.size || 0,
    kind: 'pdf', ext: 'pdf', preview: 'native',
    viewUrl: `/api/tracks/homework/${encodeURIComponent(h.key)}/file?inline=1`,
    downloadUrl: `/api/tracks/homework/${encodeURIComponent(h.key)}/file`,
  });

  function openHomework(lesson) {
    $('hw-eyebrow').textContent = `${current} · Aula ${String(lesson.number).padStart(2, '0')}`;
    $('hw-title').textContent = `Home Work — ${lesson.title}`;
    $('hw-list').innerHTML = lesson.homework.map((h, i) => `
      <li class="hw-item ${h.available ? '' : 'soon'}">
        <span class="hw-code">${esc(h.code)}</span>
        <div class="hw-info">
          <strong>${esc(h.title)}</strong>
          <span class="small muted">${esc(h.description)}</span>
          <span class="small dim">${h.pages} páginas${h.size ? ` · ${formatBytes(h.size)}` : ''}</span>
        </div>
        <div class="hw-actions">
          ${h.available
            ? `<button type="button" class="btn btn-ghost btn-sm" data-open-hw="${i}">Abrir</button>
               <a class="btn btn-sm" href="/api/tracks/homework/${encodeURIComponent(h.key)}/file" download>Baixar</a>`
            : '<span class="tag">Em breve</span>'}
        </div>
      </li>`).join('');
    $('hw-overlay').hidden = false;
    document.body.classList.add('viewer-open');
    $('hw-close').focus();
    $('hw-list').onclick = (e) => {
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

  // ------------------------------------------------------------ materiais extras (módulos)
  let extraMaterials = [];
  function materialHtml(m) {
    return `
      <div class="material">
        <div class="mat-icon kind-${m.kind}">${esc(iconLabel(m))}</div>
        <div class="mat-info">
          <button class="mat-title-btn" type="button" data-open="${m.id}">${esc(m.title)}</button>
          <span class="small dim">${esc(m.originalName)} · ${formatBytes(m.size)} · ${formatDate(m.createdAt)}</span>
        </div>
        <div class="mat-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-open="${m.id}">Visualizar</button>
          <a class="btn btn-sm" href="${m.downloadUrl}" download>Baixar</a>
        </div>
      </div>`;
  }
  $('modules').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    const i = extraMaterials.findIndex((m) => String(m.id) === b.dataset.open);
    if (i >= 0) openViewer(extraMaterials, i);
  });

  // ------------------------------------------------------------ carregar nível
  async function load() {
    document.querySelector('.space').className = `space lv-${current}`;
    document.querySelector('.lesson-map').className = `lesson-map lv-${current}`;
    renderPlanets();
    renderStatus();
    $('track-error').textContent = '';
    $('map-rows').innerHTML = '<p class="muted">Carregando…</p>';
    try {
      const [map, extras] = await Promise.all([api(`/api/tracks/${current}/lessons`), api(`/api/tracks/${current}`)]);
      document.title = `Novera · Trilha ${current}`;
      $('trail-level').textContent = `${current} · ${NAMES[current]}`;
      $('trail-desc').textContent = map.track.description;
      $('map-title').textContent = `${current} Lessons`;
      $('map-level-name').textContent = NAMES[current];
      lessons = map.lessons;
      renderMap();

      extraMaterials = extras.modules.flatMap((m) => m.materials);
      const withMat = extras.modules.filter((m) => m.materials.length);
      $('extras').hidden = !withMat.length;
      $('extras-count').textContent = `${extraMaterials.length} arquivo(s)`;
      $('modules').innerHTML = withMat.map((m) => `
        <article class="module open"><div class="module-body">
          <p class="mod-title">${esc(m.title)}</p>${m.materials.map(materialHtml).join('')}
        </div></article>`).join('');
    } catch (err) {
      $('map-rows').innerHTML = '';
      if (err.code === 'PLACEMENT_REQUIRED') return window.location.replace('/nivelamento');
      $('track-error').textContent = err.message;
    }
  }

  load();
})();
