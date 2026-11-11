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

  let lastUser = null;

  async function currentUser() {
    try {
      lastUser = (await api('/api/auth/me')).user;
      if (lastUser) flushPendingAttempts(lastUser);
      return lastUser;
    } catch {
      return null;
    }
  }

  // ---------- Resultados que não puderam ser salvos (sessão encerrada, sem internet) ----------
  // Ficam guardados neste navegador e são enviados assim que o MESMO aluno entrar de novo.
  const PENDING_KEY = 'novera_pending_attempts';
  const PENDING_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  function readPending() {
    try {
      const list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      return Array.isArray(list) ? list.filter((it) => it && Date.now() - it.at < PENDING_MAX_AGE) : [];
    } catch { return []; }
  }
  function writePending(list) {
    try {
      if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-50)));
      else localStorage.removeItem(PENDING_KEY);
    } catch { /* navegador sem armazenamento: não há o que fazer */ }
  }
  function queueAttempt(key, score, total) {
    if (!lastUser) return false;
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, userId: lastUser.id, key, score, total, at: Date.now() };
    writePending([...readPending(), item]);
    return true;
  }
  /** Aviso ao aluno: atividades que ele começou e não terminou, com o % já feito. */
  async function showPendingBanner(user, container) {
    if (!user || user.role !== 'student' || !container) return;
    let pending = [];
    try { ({ pending } = await api('/api/activities/pending')); } catch { return; }
    document.querySelector('.pending-banner')?.remove();
    if (!pending.length) return;
    const box = document.createElement('section');
    box.className = 'pending-banner';
    box.setAttribute('aria-labelledby', 'pending-title');
    box.innerHTML = `
      <h2 id="pending-title">⏳ ${pending.length === 1 ? 'Você tem 1 atividade pendente' : `Você tem ${pending.length} atividades pendentes`}</h2>
      <p class="small muted">Você começou e não terminou. Continue de onde parou para sua professora ver o seu resultado.</p>
      <ul>${pending.map((p) => `
        <li><a href="/atividade?id=${encodeURIComponent(p.key)}">
          <span>${esc(p.icon || '•')} <b>${esc(p.title)}</b> <span class="level-badge level-${esc(p.level)}">${esc(p.level)}</span>
            <br><span class="small dim">${esc(p.typeLabel || '')} · ${p.percent}% feito (${p.answered} de ${p.total})</span></span>
          <span class="t-pend-bar" aria-hidden="true"><span data-w="${p.percent}"></span></span>
          <span class="pb-go">Continuar →</span>
        </a></li>`).join('')}
      </ul>`;
    box.querySelectorAll('[data-w]').forEach((el) => { el.style.width = `${el.dataset.w}%`; });
    container.prepend(box);
  }

  let flushing = false;
  async function flushPendingAttempts(user) {
    if (flushing || !user || user.mustChangePassword || user.role !== 'student') return;
    const mine = readPending().filter((it) => it.userId === user.id);
    if (!mine.length) return;
    flushing = true;
    const done = new Set();
    for (const it of mine) {
      try {
        await api(`/api/activities/${encodeURIComponent(it.key)}/attempts`, { method: 'POST', body: { score: it.score, total: it.total } });
        done.add(it.id);
      } catch (err) {
        // Erro definitivo (atividade removida, resultado inválido, nível bloqueado): descarta.
        if ([400, 403, 404].includes(err.status)) done.add(it.id);
      }
    }
    writePending(readPending().filter((it) => !done.has(it.id)));
    flushing = false;
    const sent = mine.filter((it) => done.has(it.id)).length;
    if (sent) toast(`✓ ${sent === 1 ? '1 resultado guardado foi salvo' : `${sent} resultados guardados foram salvos`} — sua professora já pode ver.`);
  }

  /** Página inicial adequada ao perfil/estado do usuário. */
  function homeFor(user) {
    if (!user) return '/';
    if (user.mustChangePassword) return '/nova-senha';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'teacher') return '/professor';
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
    // Senha provisória: primeiro cria a senha nova.
    if (user.mustChangePassword && window.location.pathname !== '/nova-senha') {
      window.location.replace('/nova-senha');
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

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignora */ }
    window.location.replace('/');
  }

  function renderTopbar(user, active) {
    const el = document.getElementById('topbar');
    if (!el) return;
    const isAdmin = user.role === 'admin';
    const isTeacher = user.role === 'teacher';
    const isStaff = isAdmin || isTeacher;
    const placed = isStaff || Boolean(user.level);
    const link = (key, href, label) => `<a href="${href}" class="${key === active ? 'active' : ''}">${label}</a>`;
    const items = [];
    if (isAdmin) items.push(link('admin', '/admin', 'Painel admin'));
    // A aba "Controle Professor(a)" existe só para o professor(a) e o administrador.
    if (isStaff) items.push(link('professor', '/professor', 'Controle Professor(a)'));
    items.push(link('trilha', '/trilha', isStaff ? 'Trilhas' : 'Minha trilha'));
    if (placed) {
      items.push(`
        <div class="nav-dd">
          <button type="button" class="nav-dd-btn ${active === 'atividades' ? 'active' : ''}" aria-expanded="false" aria-haspopup="true">
            Atividades <span class="nav-caret" aria-hidden="true">▾</span>
          </button>
          <div class="nav-menu" role="menu" hidden>
            ${ACTIVITY_MENU.map((t) => `<a role="menuitem" href="/atividades?tipo=${t.key}"><span class="nav-menu-ico" aria-hidden="true">${t.icon}</span>${t.label}</a>`).join('')}
          </div>
        </div>`);
      items.push(link('worksheets', '/atividades?tipo=worksheet', 'Worksheets'));
    }
    if (!isStaff) items.push(link('nivelamento', '/nivelamento', 'Nivelamento'));
    const levelBadge = user.level ? `<span class="level-badge level-${esc(user.level)}">${esc(user.level)}</span>` : '';
    const roleTag = isAdmin ? '<span class="tag">Admin</span>' : isTeacher ? '<span class="tag">Professor(a)</span>' : '';

    el.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="${homeFor(user)}">${BRAND_INNER}</a>
        <nav class="nav">
          ${items.join('')}
        </nav>
        <div class="user-box">
          ${levelBadge}${roleTag}
          <span class="name">${esc(user.name)}</span>
          <button class="btn btn-ghost btn-sm" id="logout-btn" type="button">Sair</button>
        </div>
      </div>`;
    el.querySelector('#logout-btn').addEventListener('click', logout);
    setupDropdown(el.querySelector('.nav-dd'));
    renderFooter();
  }

  /** Rodapé com os Termos de uso / Privacidade e os Termos do YouTube (exigência do YouTube). */
  function renderFooter() {
    if (document.querySelector('.site-foot')) return;
    const foot = document.createElement('footer');
    foot.className = 'site-foot';
    foot.innerHTML = `Plataforma Novera · gratuita para alunos ·
      <a href="/termos">Termos de uso e Privacidade</a> ·
      Vídeos fornecidos pelo YouTube (<a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">Termos do YouTube</a>)`;
    document.body.appendChild(foot);
  }

  /** Submenu do topo: abre por clique/teclado e fica dentro da tela (inclusive no celular). */
  function setupDropdown(dd) {
    if (!dd) return;
    const btn = dd.querySelector('.nav-dd-btn');
    const menu = dd.querySelector('.nav-menu');
    // A barra do topo usa backdrop-filter, que faz "position: fixed" ficar relativo a ela.
    // Movendo o menu para o <body>, ele fica alinhado à tela, logo abaixo de "Atividades".
    document.querySelectorAll('body > .nav-menu').forEach((old) => old.remove());
    document.body.appendChild(menu);
    const place = () => {
      const r = btn.getBoundingClientRect();
      const w = Math.min(280, window.innerWidth - 16);
      menu.style.width = `${w}px`;
      menu.style.top = `${Math.round(r.bottom + 8)}px`;
      menu.style.left = `${Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8)))}px`;
    };
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    const open = () => { place(); menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); if (menu.hidden) open(); else close(); });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); open(); menu.querySelector('a')?.focus(); }
    });
    menu.addEventListener('keydown', (e) => {
      const links = [...menu.querySelectorAll('a')];
      const i = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
      if (e.key === 'Escape') { close(); btn.focus(); }
    });
    document.addEventListener('click', (e) => { if (!dd.contains(e.target) && !menu.contains(e.target)) close(); });
    window.addEventListener('resize', () => { if (!menu.hidden) place(); });
    window.addEventListener('scroll', () => { if (!menu.hidden) place(); }, { passive: true });
  }

  /** Itens do submenu "Atividades" (Worksheets fica como link próprio no menu). */
  const ACTIVITY_MENU = [
    { key: 'quiz', icon: '🎬', label: 'Quiz em vídeo' },
    { key: 'song', icon: '🎵', label: 'Música' },
    { key: 'listen', icon: '🎧', label: 'Listen' },
    { key: 'dictation', icon: '✍️', label: 'Ditado' },
    { key: 'grammar_lesson', icon: '📖', label: 'Estudo de Gramática' },
    { key: 'grammar_quiz', icon: '🧠', label: 'Quiz de Gramática' },
    { key: 'word_order', icon: '🧩', label: 'Monte a Frase' },
    { key: 'text_correction', icon: '🔍', label: 'Corrigir Textos' },
    { key: 'video_lesson', icon: '📺', label: 'Videoaulas' },
  ];

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

  /**
   * Fundo espacial de todas as páginas (o mesmo clima da trilha): imagem do cosmos fixa
   * + estrelas piscando, estrelas cadentes e foguetes cruzando a tela.
   */
  function mountCosmos() {
    if (document.querySelector('.cosmos')) return;
    const el = document.createElement('div');
    el.className = 'cosmos';
    el.setAttribute('aria-hidden', 'true');
    const rnd = (a, b) => a + Math.random() * (b - a);
    let html = '<div class="cosmos-img"></div>';
    for (let i = 0; i < 46; i += 1) html += `<i class="star${Math.random() < 0.18 ? ' big' : ''}"></i>`;
    html += '<i class="shooting s1"></i><i class="shooting s2"></i><i class="shooting s3"></i>';
    html += '<span class="rocket r1">🚀</span><span class="rocket r2">🚀</span><span class="rocket r3">🛸</span>';
    el.innerHTML = html;
    // Posições via CSSOM (a CSP não permite estilo inline no HTML).
    el.querySelectorAll('.star').forEach((s) => {
      s.style.left = `${rnd(0, 100).toFixed(1)}%`;
      s.style.top = `${rnd(0, 100).toFixed(1)}%`;
      s.style.animationDelay = `${rnd(0, 4).toFixed(2)}s`;
    });
    document.body.prepend(el);
  }
  if (document.body) mountCosmos(); else document.addEventListener('DOMContentLoaded', mountCosmos);

  return {
    api, ApiError, currentUser, requireUser, queueAttempt, showPendingBanner, homeFor, esc, formatBytes, formatDate, logout, renderTopbar, toast,
    KIND_LABEL, iconLabel, openViewer, BRAND_INNER,
  };
})();
