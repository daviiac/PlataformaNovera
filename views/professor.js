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

  // ------------------------------------------------------------ números gerais
  function renderStats() {
    const inactive = students.filter((s) => s.active === false).length;
    const practiced = students.filter((s) => s.attempts > 0 || s.done > 0 || s.categories.placement);
    const H = students.reduce((n, s) => n + s.hits, 0);
    const M = students.reduce((n, s) => n + s.misses, 0);
    const totalAttempts = students.reduce((n, s) => n + s.attempts, 0);
    const g = pct(H, M);
    $('t-stats').innerHTML = `
      <div class="t-stat"><strong>${students.length}</strong><span>alunos cadastrados${inactive ? ` (${students.length - inactive} ativos · ${inactive} inativo${inactive > 1 ? 's' : ''})` : ''}</span></div>
      <div class="t-stat"><strong>${practiced.length}</strong><span>já fizeram atividades</span></div>
      <div class="t-stat"><strong>${totalAttempts}</strong><span>atividades realizadas</span></div>
      <div class="t-stat"><strong class="${pctClass(g)}">${g === null ? '—' : `${g}%`}</strong><span>aproveitamento geral (✓ ${H} · ✗ ${M})</span></div>`;
  }

  // ------------------------------------------------------------ carregar / atualizar
  async function load() {
    const btn = $('t-refresh');
    btn.disabled = true;
    btn.textContent = '⟳ Atualizando…';
    try {
      const data = await api('/api/teacher/overview');
      if (!categories.length) {
        $('t-cat').innerHTML += data.categories.map((c) => `<option value="${c.key}">${c.icon} ${esc(c.label)}</option>`).join('');
      }
      ({ categories, students } = data);
      detailCache.clear();
      $('t-error').textContent = '';
      $('t-updated').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      renderStats();
      render();
      return true;
    } catch (err) {
      $('t-error').textContent = err.message;
      if (!students.length) $('t-list').innerHTML = '';
      return false;
    } finally {
      btn.disabled = false;
      btn.textContent = '⟳ Atualizar';
    }
  }

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
    const off = s.active === false;
    const statusBadge = off
      ? `<span class="tag tag-off" title="Não consegue entrar na plataforma">⏸ Inativo${s.deactivated_at ? ` desde ${formatDate(s.deactivated_at)}` : ''}</span>`
      : '';
    return `
      <article class="card t-student${off ? ' is-inactive' : ''}" data-id="${s.id}">
        <header class="t-student-head">
          <div class="t-who">
            <span class="t-avatar" aria-hidden="true">${esc((s.name || '?').trim().charAt(0).toUpperCase())}</span>
            <div><strong>${esc(s.name)}</strong> ${levelBadge} ${statusBadge}<br><span class="small dim">${s.username ? `<b class="t-login">login: ${esc(s.username)}</b> · ` : ''}${esc(s.email || '')} · cadastro ${formatDate(s.created_at)}</span></div>
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
          <button type="button" class="btn btn-ghost btn-sm" data-reset-pw title="Gera uma senha provisória para o aluno">🔑 Redefinir senha</button>
          <button type="button" class="btn btn-ghost btn-sm" data-set-pw title="Você escolhe o login e a senha do aluno">✏️ Definir login e senha</button>
        </div>
        <div class="t-access">
          <span class="small"><b>Acesso:</b> ${off
            ? '<span class="t-miss">inativo — o aluno não consegue entrar na plataforma</span>'
            : '<span class="t-hit">ativo</span>'}</span>
          ${off
            ? '<button type="button" class="btn btn-sm" data-toggle-active>▶ Reativar acesso</button>'
            : '<button type="button" class="btn btn-ghost btn-sm" data-toggle-active title="O aluno não consegue mais entrar; o histórico é mantido">⏸ Inativar acesso</button>'}
          <button type="button" class="btn btn-danger btn-sm" data-delete title="Apaga o cadastro e todo o histórico do aluno">🗑 Excluir cadastro</button>
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

  // ------------------------------------------------------------ redefinir senha
  async function resetPassword(art) {
    const id = Number(art.dataset.id);
    const s = students.find((x) => x.id === id);
    const msg = `Redefinir a senha de ${s.name}?\n\nVou gerar uma senha provisória para você passar ao aluno. A senha antiga deixa de funcionar e, no próximo login, ele cria uma senha nova.`;
    if (!confirm(msg)) return;
    let r;
    try {
      r = await api(`/api/teacher/students/${id}/reset-password`, { method: 'POST' });
    } catch (err) {
      return Novera.toast(err.message);
    }
    const first = s.name.split(' ')[0];
    const text = `Olá, ${first}! Sua senha provisória da Plataforma Novera é:\n\n${r.tempPassword}\n\n`
      + `Entre em ${location.origin} com o ${s.username ? `login ${s.username}` : `seu e-mail (${s.email})`} e essa senha, com letras maiúsculas e minúsculas exatamente como estão. `
      + 'Logo depois, o sistema vai pedir para você criar uma senha nova.';
    const el = document.createElement('div');
    el.className = 'viewer';
    el.innerHTML = `
      <div class="card reset-card" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <h2 id="reset-title">🔑 Senha provisória de ${esc(first)}</h2>
        <p class="small muted">Copie e envie para o aluno. <b>Ela aparece só agora</b> — se fechar sem copiar, é só redefinir de novo.
          Atenção: cada vez que você redefine, <b>só a senha mais nova vale</b> (as anteriores param de funcionar).</p>
        <div class="temp-pw"><code>${esc(r.tempPassword)}</code>
          <button type="button" class="btn btn-sm" data-copy="pw">Copiar senha</button></div>
        <p class="small dim">${s.username ? `Login: <b>${esc(s.username)}</b> · ` : ''}E-mail: ${esc(s.email || '')}</p>
        <button type="button" class="btn btn-ghost btn-block" data-copy="msg">Copiar mensagem pronta para o WhatsApp</button>
        <p class="small dim">Ao entrar, o aluno é obrigado a criar uma senha nova (você não fica sabendo qual).</p>
        <button type="button" class="btn btn-block" data-close>Fechar</button>
      </div>`;
    const close = () => { el.remove(); document.body.classList.remove('viewer-open'); };
    el.addEventListener('click', async (e) => {
      if (e.target === el || e.target.closest('[data-close]')) return close();
      const c = e.target.closest('[data-copy]');
      if (!c) return;
      try {
        await navigator.clipboard.writeText(c.dataset.copy === 'pw' ? r.tempPassword : text);
        Novera.toast(c.dataset.copy === 'pw' ? 'Senha copiada ✓' : 'Mensagem copiada ✓');
      } catch {
        Novera.toast('Não consegui copiar — selecione a senha e copie manualmente.');
      }
    });
    document.body.classList.add('viewer-open');
    document.body.appendChild(el);
    el.querySelector('[data-copy="pw"]').focus();
  }

  // ------------------------------------------------------------ definir senha escolhida
  function setPassword(art) {
    const id = Number(art.dataset.id);
    const s = students.find((x) => x.id === id);
    const first = s.name.split(' ')[0];
    const USER_RE = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;
    const suggested = s.username || first.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    const el = document.createElement('div');
    el.className = 'viewer';
    el.innerHTML = `
      <div class="card reset-card setpw-card" role="dialog" aria-modal="true" aria-labelledby="setpw-title">
        <h2 id="setpw-title">✏️ Login e senha de ${esc(first)}</h2>
        <p class="small muted">${esc(first)} vai entrar com este <b>login</b> e esta <b>senha</b>. O e-mail (${esc(s.email || '')}) também continua funcionando.</p>
        <div class="field">
          <label for="setpw-user" class="small">Login (só letras minúsculas, sem espaço)</label>
          <input id="setpw-user" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="30" value="${esc(suggested)}">
          <span class="hint" id="setpw-user-hint"></span>
        </div>
        <div class="field">
          <label for="setpw-input" class="small">Senha nova</label>
          <div class="setpw-row">
            <input id="setpw-input" type="text" autocomplete="off" spellcheck="false" maxlength="128">
          </div>
          <ul class="pw-checks small" id="setpw-checks"></ul>
        </div>
        <label class="setpw-check small"><input type="checkbox" id="setpw-change">
          Pedir para ${esc(first)} criar uma senha própria no próximo login</label>
        <p class="alert alert-error" id="setpw-error" role="alert"></p>
        <div class="delete-actions">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="button" class="btn" data-save disabled>Salvar senha</button>
        </div>
      </div>`;
    const close = () => { el.remove(); document.body.classList.remove('viewer-open'); };
    const input = el.querySelector('#setpw-input');
    const user = el.querySelector('#setpw-user');
    const save = el.querySelector('[data-save]');
    user.addEventListener('input', () => {
      const v = user.value.toLowerCase().replace(/\s/g, '');
      if (v !== user.value) user.value = v;
      evaluate();
    });
    const evaluate = () => {
      const u = user.value.trim();
      const userOk = !u || USER_RE.test(u);
      el.querySelector('#setpw-user-hint').textContent = !u
        ? `Sem login: ${first} entra só com o e-mail.`
        : userOk ? `${first} vai entrar com: ${u}` : 'Use de 3 a 30 letras minúsculas, números, ponto, hífen ou _ (sem acento).';
      el.querySelector('#setpw-user-hint').className = `hint ${u && !userOk ? 'hint-bad' : 'hint-ok'}`;
      const r = PasswordPolicy.check(input.value, { name: s.name, email: s.email });
      const spaces = input.value !== input.value.trim();
      el.querySelector('#setpw-checks').innerHTML = r.checks
        .map((c) => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✓' : '•'} ${esc(c.id === 'personal' ? `Sem o nome ou e-mail de ${first}` : c.label)}</li>`).join('')
        + (spaces ? '<li>• Sem espaço no começo ou no fim</li>' : '');
      save.disabled = !r.ok || spaces || !userOk;
      return !save.disabled;
    };
    input.addEventListener('input', evaluate);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && e.target === input && evaluate()) save.click();
    });
    el.addEventListener('click', async (e) => {
      if (e.target === el || e.target.closest('[data-close]')) return close();
      if (!e.target.closest('[data-save]') || save.disabled) return;
      save.disabled = true;
      save.textContent = 'Salvando…';
      el.querySelector('#setpw-error').textContent = '';
      const requireChange = el.querySelector('#setpw-change').checked;
      try {
        const r = await api(`/api/teacher/students/${id}/set-password`, {
          method: 'POST', body: { password: input.value, requireChange, username: user.value.trim() },
        });
        s.username = r.student.username;
        close();
        render();
        const how = s.username ? `login "${s.username}"` : 'o e-mail';
        Novera.toast(requireChange
          ? `Pronto! ${first} entra com ${how} e essa senha, e depois cria uma senha própria.`
          : `Pronto! ${first} já pode entrar com ${how} e essa senha ✓`);
      } catch (err) {
        el.querySelector('#setpw-error').textContent = err.message;
        save.textContent = 'Salvar senha';
        evaluate();
      }
    });
    document.body.classList.add('viewer-open');
    document.body.appendChild(el);
    evaluate();
    user.focus();
    user.select();
  }

  // ------------------------------------------------------------ inativar / reativar acesso
  async function toggleActive(art) {
    const id = Number(art.dataset.id);
    const s = students.find((x) => x.id === id);
    const turnOn = s.active === false;
    const msg = turnOn
      ? `Reativar o acesso de ${s.name}?\n\nO aluno volta a entrar na plataforma com a mesma senha, e o histórico continua igual.`
      : `Inativar o acesso de ${s.name}?\n\nO aluno é desconectado na hora e não consegue mais entrar. Os resultados e o histórico ficam guardados, e você pode reativar quando quiser.`;
    if (!confirm(msg)) return;
    try {
      const r = await api(`/api/teacher/students/${id}/active`, { method: 'PATCH', body: { active: turnOn } });
      s.active = r.active;
      s.deactivated_at = r.deactivatedAt;
      Novera.toast(turnOn ? `Acesso de ${s.name} reativado ✓` : `Acesso de ${s.name} inativado.`);
      renderStats();
      render();
    } catch (err) {
      Novera.toast(err.message);
    }
  }

  // ------------------------------------------------------------ excluir cadastro
  function deleteStudent(art) {
    const id = Number(art.dataset.id);
    const s = students.find((x) => x.id === id);
    const WORD = 'EXCLUIR';
    const el = document.createElement('div');
    el.className = 'viewer';
    el.innerHTML = `
      <div class="card reset-card delete-card" role="dialog" aria-modal="true" aria-labelledby="del-title">
        <h2 id="del-title">🗑 Excluir o cadastro de ${esc(s.name)}?</h2>
        <p class="small">Vai ser apagado <b>para sempre</b>: a conta (${esc(s.email || '')}), os resultados de todas as atividades,
          os nivelamentos e o histórico de nível. <b>Isso não pode ser desfeito.</b></p>
        <p class="small muted">Se o aluno só saiu ou trancou o curso, prefira <b>⏸ Inativar acesso</b>: ele não entra mais, mas o histórico fica guardado.</p>
        <div class="field">
          <label for="del-confirm" class="small">Para confirmar, digite <b>${WORD}</b>:</label>
          <input id="del-confirm" type="text" autocomplete="off" spellcheck="false">
        </div>
        <div class="delete-actions">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="button" class="btn btn-danger" data-confirm disabled>Excluir cadastro</button>
        </div>
      </div>`;
    const close = () => { el.remove(); document.body.classList.remove('viewer-open'); };
    const input = el.querySelector('#del-confirm');
    const go = el.querySelector('[data-confirm]');
    input.addEventListener('input', () => { go.disabled = input.value.trim().toUpperCase() !== WORD; });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    el.addEventListener('click', async (e) => {
      if (e.target === el || e.target.closest('[data-close]')) return close();
      if (!e.target.closest('[data-confirm]') || go.disabled) return;
      go.disabled = true;
      go.textContent = 'Excluindo…';
      try {
        await api(`/api/teacher/students/${id}`, { method: 'DELETE' });
        students = students.filter((x) => x.id !== id);
        detailCache.delete(id);
        close();
        Novera.toast(`Cadastro de ${s.name} excluído.`);
        renderStats();
        render();
      } catch (err) {
        go.disabled = false;
        go.textContent = 'Excluir cadastro';
        Novera.toast(err.message);
      }
    });
    document.body.classList.add('viewer-open');
    document.body.appendChild(el);
    input.focus();
  }

  function render() {
    const q = $('t-search').value.trim().toLowerCase();
    const cat = $('t-cat').value;
    const sort = $('t-sort').value;
    const status = $('t-status').value;
    let list = students.filter((s) => (!q || s.name.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.username || '').includes(q))
      && (!level || (level === '-' ? !s.level : s.level === level))
      && (!status || (status === 'inactive') === (s.active === false)));
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
    const reset = e.target.closest('[data-reset-pw]');
    if (reset) return resetPassword(reset.closest('.t-student'));
    const setPw = e.target.closest('[data-set-pw]');
    if (setPw) return setPassword(setPw.closest('.t-student'));
    const toggle = e.target.closest('[data-toggle-active]');
    if (toggle) return toggleActive(toggle.closest('.t-student'));
    const del = e.target.closest('[data-delete]');
    if (del) return deleteStudent(del.closest('.t-student'));
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
  $('t-status').addEventListener('change', render);
  $('t-refresh').addEventListener('click', async () => {
    if (await load()) Novera.toast('Dados atualizados ✓');
  });
  $('t-level').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-level]');
    if (!b) return;
    level = b.dataset.level;
    document.querySelectorAll('#t-level button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  });

  load();
})();
