(async () => {
  const { api, requireUser, renderTopbar, esc, formatBytes, formatDate, iconLabel, openViewer } = Novera;
  const user = await requireUser();

  // Aluno sem nível ainda precisa fazer o nivelamento.
  if (user.role !== 'admin' && !user.level) return window.location.replace('/nivelamento');

  renderTopbar(user, 'trilha');
  const $ = (id) => document.getElementById(id);
  if (user.role === 'admin') $('redo-link').hidden = true;

  const { tracks } = await api('/api/tracks');
  const params = new URLSearchParams(window.location.search);
  let current = (params.get('nivel') || user.level || 'A1').toUpperCase();
  if (!tracks.some((t) => t.level === current)) current = user.level || 'A1';

  function renderTabs() {
    $('level-tabs').innerHTML = tracks.map((t) => `
      <a class="level-tab ${t.level === current ? 'active' : ''}" href="?nivel=${t.level}" data-level="${t.level}">
        <span class="row">
          <span class="level-badge level-${t.level}">${t.level}</span>
          <strong>${esc(t.name)}</strong>
          ${t.level === user.level ? '<span class="tag tag-own">Seu nível</span>' : ''}
        </span>
        <span class="small dim">${t.modules} módulos · ${t.materials} materiais</span>
      </a>`).join('');
  }

  $('level-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.level-tab');
    if (!tab) return;
    e.preventDefault();
    current = tab.dataset.level;
    history.replaceState(null, '', `?nivel=${current}`);
    load();
  });

  const PREVIEW_LABEL = { audio: 'Ouvir', video: 'Assistir' };

  function materialHtml(m) {
    const action = m.preview === 'none' ? 'Detalhes' : (PREVIEW_LABEL[m.kind] || 'Visualizar');
    return `
      <div class="material">
        <div class="mat-icon kind-${m.kind}">${esc(iconLabel(m))}</div>
        <div class="mat-info">
          <button class="mat-title-btn" type="button" data-open="${m.id}">${esc(m.title)}</button>
          ${m.description ? `<span class="small muted">${esc(m.description)}</span><br>` : ''}
          <span class="small dim">${esc(m.originalName)} · ${formatBytes(m.size)} · ${formatDate(m.createdAt)}</span>
        </div>
        <div class="mat-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-open="${m.id}">${action}</button>
          <a class="btn btn-sm" href="${m.downloadUrl}" download>Baixar</a>
        </div>
      </div>`;
  }

  let allMaterials = [];

  async function load() {
    renderTabs();
    $('track-error').textContent = '';
    $('modules').innerHTML = '<p class="empty">Carregando…</p>';
    try {
      const data = await api(`/api/tracks/${current}`);
      document.title = `Novera · Trilha ${data.track.level}`;
      $('track-eyebrow').textContent = data.isOwnLevel ? 'Sua trilha de estudos' : 'Trilha de estudos';
      $('track-title').innerHTML = `Trilha ${data.track.level} · <span class="hl">${esc(data.track.name)}</span>`;
      $('track-desc').textContent = data.track.description;

      const notice = $('other-level-notice');
      if (user.role !== 'admin' && !data.isOwnLevel) {
        notice.hidden = false;
        notice.innerHTML = `Você está explorando a trilha <strong>${data.track.level}</strong>. Seu nível é <strong>${esc(user.level)}</strong> — <a href="?nivel=${esc(user.level)}">voltar para minha trilha</a>.`;
      } else {
        notice.hidden = true;
      }

      // Ordem da trilha: usada para navegar (←/→) dentro do visualizador.
      allMaterials = data.modules.flatMap((mod) => mod.materials);

      if (!data.modules.length) {
        $('modules').innerHTML = '<p class="empty">Esta trilha ainda não tem módulos.</p>';
        return;
      }

      $('modules').innerHTML = data.modules.map((mod, i) => `
        <article class="module ${i === 0 ? 'open' : ''}">
          <button class="module-head" type="button" aria-expanded="${i === 0}">
            <span class="module-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="grow">
              <span class="mod-title">${esc(mod.title)}</span>
              <span class="mod-desc">${esc(mod.description)}</span>
            </span>
            <span class="tag">${mod.materials.length} ${mod.materials.length === 1 ? 'material' : 'materiais'}</span>
            <span class="chev" aria-hidden="true">▶</span>
          </button>
          <div class="module-body" ${i === 0 ? '' : 'hidden'}>
            ${mod.materials.length ? mod.materials.map(materialHtml).join('') : '<p class="empty">Nenhum material publicado neste módulo ainda.</p>'}
          </div>
        </article>`).join('');
    } catch (err) {
      $('modules').innerHTML = '';
      if (err.code === 'PLACEMENT_REQUIRED') return window.location.replace('/nivelamento');
      $('track-error').textContent = err.message;
    }
  }

  $('modules').addEventListener('click', (e) => {
    const head = e.target.closest('.module-head');
    if (head) {
      const mod = head.closest('.module');
      const open = !mod.classList.contains('open');
      mod.classList.toggle('open', open);
      head.setAttribute('aria-expanded', String(open));
      mod.querySelector('.module-body').hidden = !open;
      return;
    }

    const opener = e.target.closest('[data-open]');
    if (opener) {
      const index = allMaterials.findIndex((m) => String(m.id) === opener.dataset.open);
      if (index >= 0) openViewer(allMaterials, index);
    }
  });

  load();
})();
