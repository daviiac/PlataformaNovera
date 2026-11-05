/* Utilitários compartilhados entre as páginas da Plataforma Novera. */
const Novera = (() => {
  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function api(path, { method = 'GET', body } = {}) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch { /* sem corpo JSON */ }
    if (!res.ok) throw new ApiError(data?.error || `Erro ${res.status}`, res.status, data?.code);
    return data;
  }

  async function currentUser() {
    try {
      return (await api('/api/auth/me')).user;
    } catch {
      return null;
    }
  }

  /** Página inicial adequada ao perfil/estado do usuário. */
  function homeFor(user) {
    if (!user) return '/';
    if (user.role === 'admin') return '/admin';
    if (!user.level) return '/nivelamento';
    return '/trilha';
  }

  /** Garante que há um usuário logado; senão volta para o login. */
  async function requireUser() {
    const user = await currentUser();
    if (!user) {
      window.location.replace('/');
      return new Promise(() => {});
    }
    return user;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function formatDate(sqlDate) {
    if (!sqlDate) return '';
    const d = new Date(`${sqlDate.replace(' ', 'T')}Z`);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignora */ }
    window.location.replace('/');
  }

  function renderTopbar(user, active) {
    const el = document.getElementById('topbar');
    if (!el) return;
    const links = [];
    if (user.role === 'admin') {
      links.push(['admin', '/admin', 'Painel admin']);
      links.push(['trilha', '/trilha', 'Trilhas']);
    } else {
      links.push(['trilha', '/trilha', 'Minha trilha']);
      links.push(['nivelamento', '/nivelamento', 'Nivelamento']);
    }
    const levelBadge = user.level ? `<span class="level-badge level-${esc(user.level)}">${esc(user.level)}</span>` : '';
    const roleTag = user.role === 'admin' ? '<span class="tag">Admin</span>' : '';

    el.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="${homeFor(user)}">${BRAND_INNER}</a>
        <nav class="nav">
          ${links.map(([key, href, label]) => `<a href="${href}" class="${key === active ? 'active' : ''}">${label}</a>`).join('')}
        </nav>
        <div class="user-box">
          ${levelBadge}${roleTag}
          <span class="name">${esc(user.name)}</span>
          <button class="btn btn-ghost btn-sm" id="logout-btn" type="button">Sair</button>
        </div>
      </div>`;
    el.querySelector('#logout-btn').addEventListener('click', logout);
  }

  let toastTimer;
  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  const KIND_LABEL = { pdf: 'PDF', audio: 'ÁUDIO', video: 'VÍDEO', document: 'DOC' };

  /** Rótulo curto do ícone: extensão para documentos (DOCX, PPTX…), tipo para o resto. */
  function iconLabel(m) {
    return m.kind === 'document' ? (m.ext || 'doc').toUpperCase().slice(0, 4) : (KIND_LABEL[m.kind] || 'ARQ');
  }

  // ---------- Visualizador de materiais (modal) ----------
  let viewerState = null;

  function viewerContent(m) {
    if (m.preview === 'none') {
      return `
        <div class="viewer-message">
          <div class="mat-icon kind-${m.kind}">${esc(iconLabel(m))}</div>
          <p><strong>Pré-visualização indisponível para arquivos .${esc(m.ext)}</strong></p>
          <p class="small">Formatos antigos do Office não podem ser exibidos no navegador. Baixe o arquivo para abrir no seu computador.</p>
          <a class="btn" href="${esc(m.downloadUrl)}" download>Baixar arquivo</a>
        </div>`;
    }
    if (m.kind === 'video') return `<video controls autoplay preload="metadata" src="${esc(m.viewUrl)}"></video>`;
    if (m.kind === 'audio') {
      return `
        <div class="viewer-audio">
          <div class="mat-icon kind-audio">ÁUDIO</div>
          <strong>${esc(m.title)}</strong>
          <audio controls autoplay preload="metadata" src="${esc(m.viewUrl)}"></audio>
        </div>`;
    }
    // PDF usa o leitor nativo do navegador. Documentos convertidos já chegam com
    // CSP "sandbox" + "default-src 'none'" do servidor: isolados e sem scripts.
    return `<div class="viewer-loading">Carregando pré-visualização…</div>
            <iframe src="${esc(m.viewUrl)}" title="${esc(m.title)}"></iframe>`;
  }

  function renderViewer() {
    const { list, index, el } = viewerState;
    const m = list[index];
    const multi = list.length > 1;
    el.innerHTML = `
      <div class="viewer-panel" role="dialog" aria-modal="true" aria-label="${esc(m.title)}">
        <div class="viewer-head">
          <div class="mat-icon kind-${m.kind}">${esc(iconLabel(m))}</div>
          <div class="grow">
            <strong>${esc(m.title)}</strong>
            <span class="meta">${esc(m.originalName)} · ${formatBytes(m.size)}${multi ? ` · ${index + 1} de ${list.length}` : ''}</span>
          </div>
          <div class="viewer-actions">
            ${multi ? `
              <button class="btn btn-ghost btn-icon" type="button" data-nav="-1" aria-label="Material anterior" ${index === 0 ? 'disabled' : ''}>←</button>
              <button class="btn btn-ghost btn-icon" type="button" data-nav="1" aria-label="Próximo material" ${index === list.length - 1 ? 'disabled' : ''}>→</button>` : ''}
            <a class="btn btn-sm" href="${esc(m.downloadUrl)}" download>↓ <span class="btn-label">Baixar</span></a>
            <button class="btn btn-ghost btn-icon" type="button" data-close aria-label="Fechar">✕</button>
          </div>
        </div>
        <div class="viewer-body">${viewerContent(m)}</div>
        ${m.description ? `<div class="viewer-desc">${esc(m.description)}</div>` : ''}
      </div>`;

    const frame = el.querySelector('iframe');
    if (frame) frame.addEventListener('load', () => el.querySelector('.viewer-loading')?.remove(), { once: true });
    el.querySelector('[data-close]').focus();
  }

  function closeViewer() {
    if (!viewerState) return;
    viewerState.el.remove();
    document.removeEventListener('keydown', viewerState.onKey);
    document.body.classList.remove('viewer-open');
    viewerState.returnFocus?.focus();
    viewerState = null;
  }

  function moveViewer(delta) {
    const next = viewerState.index + delta;
    if (next < 0 || next >= viewerState.list.length) return;
    viewerState.index = next;
    renderViewer();
  }

  /** Abre o visualizador em `list[index]`, com navegação entre os materiais da lista. */
  function openViewer(list, index = 0) {
    closeViewer();
    const el = document.createElement('div');
    el.className = 'viewer';
    const onKey = (e) => {
      if (e.key === 'Escape') closeViewer();
      else if (e.key === 'ArrowLeft') moveViewer(-1);
      else if (e.key === 'ArrowRight') moveViewer(1);
    };
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('[data-close]')) return closeViewer();
      const nav = e.target.closest('[data-nav]');
      if (nav) moveViewer(Number(nav.dataset.nav));
    });
    viewerState = { list, index, el, onKey, returnFocus: document.activeElement };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('viewer-open');
    document.body.appendChild(el);
    renderViewer();
  }

  const BRAND_INNER = '<span class="brand-mark">N</span><span class="brand-text"><strong>NOVERA</strong><span>ACADEMY</span></span>';

  return {
    api, ApiError, currentUser, requireUser, homeFor, esc, formatBytes, formatDate, logout, renderTopbar, toast,
    KIND_LABEL, iconLabel, openViewer, BRAND_INNER,
  };
})();
