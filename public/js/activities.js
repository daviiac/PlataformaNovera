(async () => {
  const { api, requireUser, renderTopbar, esc } = Novera;
  const user = await requireUser();
  if (user.role === 'student' && !user.level) return window.location.replace('/nivelamento');

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const tipo = params.get('tipo');
  renderTopbar(user, tipo === 'worksheet' ? 'worksheets' : 'atividades');

  const { types, isAdmin } = await api('/api/activities/types');

  // ---------------------------------------------------------------- hub
  if (!tipo || !types.some((t) => t.key === tipo)) {
    $('hub').hidden = false;
    $('type-grid').innerHTML = types.map((t) => `
      <a class="type-card" href="/atividades?tipo=${t.key}">
        <span class="type-ico" aria-hidden="true">${t.icon}</span>
        <span class="type-name">${esc(t.label)}</span>
        <span class="type-desc">${esc(t.description)}</span>
        <span class="type-count">${t.total ? `${t.total} ${t.total === 1 ? 'atividade' : 'atividades'}` : (t.adminCreated ? 'Em breve' : '—')}</span>
      </a>`).join('');
    return;
  }

  // ---------------------------------------------------------------- lista
  const type = types.find((t) => t.key === tipo);
  document.title = `Novera · ${type.label}`;
  $('list').hidden = false;
  $('list-ico').textContent = type.icon;
  $('list-title').textContent = type.label;
  $('list-desc').textContent = type.description;
  $('list-eyebrow').textContent = tipo === 'worksheet' ? 'Folhas interativas' : 'Atividades';
  if (tipo === 'worksheet') $('back-hub').hidden = true;

  let level = params.has('nivel') ? (params.get('nivel') || '').toUpperCase() : (user.level || '');
  let all = [];

  function setLevel(l) {
    level = l;
    document.querySelectorAll('#level-filter button').forEach((b) => {
      b.classList.toggle('active', b.dataset.level === l);
      b.setAttribute('aria-pressed', String(b.dataset.level === l));
    });
    const p = new URLSearchParams(location.search);
    if (l) p.set('nivel', l); else p.set('nivel', '');
    history.replaceState(null, '', `?${p}`);
    render();
  }

  function card(a) {
    const best = a.best ? `<span class="tag ${a.best.score === a.best.total ? 'tag-own' : ''}">✓ ${a.best.score}/${a.best.total}</span>` : '';
    const count = a.count ? `<span class="small dim">${a.count.n} ${a.count.unit}</span>` : '';
    const visual = a.youtubeId
      ? `<img class="act-thumb" src="${Novera.esc(Act.thumb(a.youtubeId))}" alt="" loading="lazy">`
      : `<span class="act-cover" aria-hidden="true">${a.cover || type.icon}</span>`;
    const own = a.level === user.level ? '<span class="tag tag-own">Seu nível</span>' : '';
    return `
      <a class="act-card ${a.locked ? 'is-locked' : ''}" href="${a.locked ? '#' : `/atividade?id=${encodeURIComponent(a.key)}`}" ${a.locked ? 'aria-disabled="true" data-locked="1"' : ''}>
        <span class="act-visual">${visual}${a.locked ? '<span class="act-lock" aria-hidden="true">🔒</span>' : ''}</span>
        <span class="act-body">
          <span class="act-tags"><span class="level-badge level-${esc(a.level)}">${esc(a.level)}</span>${own}${best}${a.locked ? '<span class="tag">Liberado pela professora</span>' : ''}</span>
          <span class="act-title">${esc(a.title)}</span>
          <span class="act-desc">${esc(a.description || '')}</span>
          ${count}
        </span>
      </a>`;
  }

  function render() {
    const q = $('search').value.trim().toLowerCase();
    const list = all.filter((a) => (!level || a.level === level) && (!q || a.title.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)));
    if (!list.length) {
      const adminHint = isAdmin && type.adminCreated ? ' Crie a primeira no <a href="/admin#atividades">Painel admin</a>.' : '';
      const msg = all.length
        ? 'Nenhuma atividade com esses filtros.'
        : type.adminCreated
          ? `Ainda não há atividades de ${esc(type.label.toLowerCase())} publicadas.${adminHint}`
          : 'Nenhuma atividade disponível.';
      $('act-grid').innerHTML = `<div class="card empty-state"><p class="muted">${msg}</p></div>`;
      return;
    }
    $('act-grid').innerHTML = list.map(card).join('');
  }

  document.querySelector('#level-filter').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-level]');
    if (b) setLevel(b.dataset.level);
  });
  $('search').addEventListener('input', render);
  $('act-grid').addEventListener('click', (e) => {
    if (e.target.closest('[data-locked]')) { e.preventDefault(); Novera.toast('🔒 Este nível será liberado pela sua professora.'); }
  });

  try {
    ({ activities: all } = await api(`/api/activities?type=${encodeURIComponent(tipo)}`));
    setLevel(level);
  } catch (err) {
    $('list-error').textContent = err.message;
  }
})();
