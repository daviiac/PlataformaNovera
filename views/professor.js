(async () => {
  const { api, requireUser, renderTopbar, esc, formatDate } = Novera;
  const user = await requireUser();
  if (user.role !== 'teacher' && user.role !== 'admin') return window.location.replace('/');
  renderTopbar(user, 'professor');

  const $ = (id) => document.getElementById(id);
  let categories = [];
  let students = [];
  let level = '';
  const detailCache = new Map();

  const pct = (h, m) => (h + m ? Math.round((h / (h + m)) * 100) : null);
  const pctClass = (p) => (p === null ? '' : p >= 70 ? 'good' : p >= 40 ? 'mid' : 'low');
  const catOf = (k) => categories.find((c) => c.key === k) || { label: 'Outra', icon: '•' };
  const dateTime = (v) => (v ? `${formatDate(v)} ${new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—');

  try {
    ({ categories, students } = await api('/api/teacher/overview'));
  } catch (err) {
    $('t-error').textContent = err.message;
    $('t-list').innerHTML = '';
    return;
  }

  $('t-cat').innerHTML += categories.map((c) => `<option value="${c.key}">${c.icon} ${esc(c.label)}</option>`).join('');

  // ------------------------------------------------------------ números gerais
  const active = students.filter((s) => s.attempts > 0 || s.categories.placement);
  const H = students.reduce((n, s) => n + s.hits, 0);
  const M = students.reduce((n, s) => n + s.misses, 0);
  const totalAttempts = students.reduce((n, s) => n + s.attempts, 0);
  const g = pct(H, M);
  $('t-stats').innerHTML = `
    <div class="t-stat"><strong>${students.length}</strong><span>alunos cadastrados</span></div>
    <div class="t-stat"><strong>${active.length}</strong><span>já fizeram atividades</span></div>
    <div class="t-stat"><strong>${totalAttempts}</strong><span>atividades realizadas</span></div>
    <div class="t-stat"><strong class="${pctClass(g)}">${g === null ? '—' : `${g}%`}</strong><span>aproveitamento geral (✓ ${H} · ✗ ${M})</span></div>`;

  // ------------------------------------------------------------ lista
  function chip(c, d) {
    const p = pct(d.hits, d.misses);
    const unit = c.key === 'placement' ? 'pts' : '';
    return `
      <div class="t-chip">
        <span class="t-chip-name">${c.icon} ${esc(c.label)}</span>
        <span class="t-chip-nums"><span class="t-hit">✓ ${d.hits}${unit}</span><span class="t-miss">✗ ${d.misses}${unit}</span></span>
        <span class="t-chip-meta"><span class="t-pct ${pctClass(p)}">${p === null ? '—' : `${p}%`}</span> · ${d.attempts} ${d.attempts === 1 ? 'vez' : 'vezes'}</span>
      </div>`;
  }

  function card(s, cat) {
    const p = pct(s.hits, s.misses);
    const cats = categories.filter((c) => s.categories[c.key] && (!cat || c.key === cat));
    const levelBadge = s.level ? `<span class="level-badge level-${esc(s.level)}">${esc(s.level)}</span>` : '<span class="tag">Sem nível</span>';
    return `
      <article class="card t-student" data-id="${s.id}">
        <header class="t-student-head">
          <div class="t-who">
            <span class="t-avatar" aria-hidden="true">${esc((s.name || '?').trim().charAt(0).toUpperCase())}</span>
            <div><strong>${esc(s.name)}</strong> ${levelBadge}<br><span class="small dim">${esc(s.email || '')} · cadastro ${formatDate(s.created_at)}</span></div>
          </div>
          <div class="t-total">
            <span class="t-pct ${pctClass(p)}">${p === null ? '—' : `${p}%`}</span>
            <span class="small dim">✓ ${s.hits} · ✗ ${s.misses} · última: ${s.lastAt ? formatDate(s.lastAt) : 'nunca'}</span>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-detail aria-expanded="false">Ver detalhes</button>
        </header>
        ${cats.length
          ? `<div class="t-chips">${cats.map((c) => chip(c, s.categories[c.key])).join('')}</div>`
          : `<p class="small dim t-empty">${cat ? 'Nenhuma atividade nesta categoria.' : 'Ainda não fez nenhuma atividade.'}</p>`}
        ${s.done ? `<p class="small dim">📖 ${s.done} lição(ões)/videoaula(s) concluída(s).</p>` : ''}
        <div class="t-level">
          <span class="small"><b>Nível do aluno:</b> ${s.level ? esc(s.level) : 'sem nível'}${s.previous_level ? ` <span class="dim">(antes: ${esc(s.previous_level)} · ${formatDate(s.level_changed_at)})</span>` : ''}</span>
          <label class="sr-only" for="lvl-${s.id}">Novo nível de ${esc(s.name)}</label>
          <select id="lvl-${s.id}" data-level-select>
            ${['A1', 'A2', 'B2'].map((l) => `<option value="${l}" ${l === s.level ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-sm" data-save-level>Alterar nível</button>
        </div>
        <div class="t-detail" hidden></div>
      </article>`;
  }

  async function saveLevel(art) {
    const id = Number(art.dataset.id);
    const s = students.find((x) => x.id === id);
    const level = art.querySelector('[data-level-select]').value;
    if (level === s.level) return Novera.toast(`${s.name} já está no nível ${level}.`);
    const msg = `Mudar ${s.name} de ${s.level || 'sem nível'} para ${level}?\n\nO aluno continua vendo o nível anterior e passa a ver o novo. Os níveis seguintes continuam bloqueados até você liberar.`;
    if (!confirm(msg)) return;
    try {
      const r = await api(`/api/teacher/students/${id}/level`, { method: 'PATCH', body: { level } });
      s.previous_level = r.from;
      s.level = r.to;
      s.level_changed_at = new Date().toISOString();
      detailCache.delete(id);
      Novera.toast(`Nível de ${s.name} alterado: ${r.from || '—'} → ${r.to}.`);
      render();
    } catch (err) {
      Novera.toast(err.message);
    }
  }

  function render() {
    const q = $('t-search').value.trim().toLowerCase();
    const cat = $('t-cat').value;
    const sort = $('t-sort').value;
    let list = students.filter((s) => (!q || s.name.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q))
      && (!level || (level === '-' ? !s.level : s.level === level)));
    const acc = (s) => {
      const d = cat ? s.categories[cat] : s;
      return d ? pct(d.hits, d.misses) : null;
    };
    list = list.slice().sort((a, b) => {
      if (sort === 'recent') return new Date(b.lastAt || 0) - new Date(a.lastAt || 0);
      if (sort.startsWith('accuracy')) {
        const x = acc(a); const y = acc(b);
        if (x === null && y === null) return a.name.localeCompare(b.name);
        if (x === null) return 1;
        if (y === null) return -1;
        return sort === 'accuracy-asc' ? x - y : y - x;
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    $('t-list').innerHTML = list.length
      ? list.map((s) => card(s, cat)).join('')
      : `<div class="card empty-state"><p class="muted">${students.length ? 'Nenhum aluno com esses filtros.' : 'Nenhum aluno cadastrado ainda.'}</p></div>`;
  }

  // ------------------------------------------------------------ detalhes do aluno
  function detailHtml(d, cat) {
    const hist = d.levelHistory?.length
      ? `<section class="t-group"><h3>🪐 Histórico de nível</h3><ul class="small">${d.levelHistory.map((h) => `<li>${h.from ? `${esc(h.from)} → ` : 'Nível inicial: '}<b>${esc(h.to)}</b> · ${dateTime(h.at)} · ${esc(h.by)}</li>`).join('')}</ul></section>`
      : '';
    const rows = d.attempts.filter((a) => a.scored && (!cat || a.category === cat));
    if (!rows.length) return `${hist}<p class="small dim">Sem registros de atividades para mostrar.</p>`;
    const groups = categories.filter((c) => rows.some((r) => r.category === c.key));
    return hist + groups.map((c) => {
      const rs = rows.filter((r) => r.category === c.key);
      const h = rs.reduce((n, r) => n + r.hits, 0);
      const m = rs.reduce((n, r) => n + r.misses, 0);
      return `
        <section class="t-group">
          <h3>${c.icon} ${esc(c.label)} <span class="small dim">· ✓ ${h} · ✗ ${m} · ${pct(h, m)}%</span></h3>
          <div class="table-wrap"><table>
            <thead><tr><th>Atividade</th><th>Nível</th><th>Acertos</th><th>Erros</th><th>Nota</th><th>Data</th></tr></thead>
            <tbody>${rs.map((r) => {
              const p = pct(r.hits, r.misses);
              return `<tr>
                <td>${esc(r.title)}</td>
                <td>${r.level ? `<span class="level-badge level-${esc(r.level)}">${esc(r.level)}</span>` : '—'}</td>
                <td class="t-hit">${r.hits}${r.points ? ' pts' : ''}</td>
                <td class="t-miss">${r.misses}${r.points ? ' pts' : ''}</td>
                <td><span class="t-pct ${pctClass(p)}">${p}%</span></td>
                <td class="small dim">${dateTime(r.at)}</td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>
        </section>`;
    }).join('');
  }

  $('t-list').addEventListener('click', async (e) => {
    const save = e.target.closest('[data-save-level]');
    if (save) return saveLevel(save.closest('.t-student'));
    const btn = e.target.closest('[data-detail]');
    if (!btn) return;
    const art = btn.closest('.t-student');
    const box = art.querySelector('.t-detail');
    const open = box.hidden;
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Fechar' : 'Ver detalhes';
    if (!open) return;
    const id = Number(art.dataset.id);
    box.innerHTML = '<p class="small dim">Carregando…</p>';
    try {
      if (!detailCache.has(id)) detailCache.set(id, await api(`/api/teacher/students/${id}`));
      box.innerHTML = detailHtml(detailCache.get(id), $('t-cat').value);
    } catch (err) {
      box.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
    }
  });

  $('t-search').addEventListener('input', render);
  $('t-cat').addEventListener('change', render);
  $('t-sort').addEventListener('change', render);
  $('t-level').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-level]');
    if (!b) return;
    level = b.dataset.level;
    document.querySelectorAll('#t-level button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  });

  render();
})();
