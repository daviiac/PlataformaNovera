(async () => {
  const { api, requireUser, renderTopbar, esc, formatBytes, formatDate, toast, iconLabel, openViewer } = Novera;
  const user = await requireUser();
  if (user.role !== 'admin') return window.location.replace('/trilha');
  renderTopbar(user, 'admin');

  const $ = (id) => document.getElementById(id);
  let filterTrack = 'A1';
  let modulesCache = [];

  // ---------- Configuração ----------
  const cfg = await api('/api/admin/config');
  $('allowed-types').textContent = `${cfg.allowedExtensions.join(' ')} · até ${cfg.maxUploadMb} MB`;
  $('up-file').accept = cfg.allowedExtensions.join(',');

  // ---------- Módulos (select do upload) ----------
  async function fillModuleSelect(track, selectedId) {
    const { modules } = await api(`/api/admin/modules?track=${track}`);
    $('up-module').innerHTML = modules.length
      ? modules.map((m) => `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${esc(m.title)}</option>`).join('')
      : '<option value="">Crie um módulo nesta trilha primeiro</option>';
  }
  $('up-track').addEventListener('change', () => fillModuleSelect($('up-track').value));

  // ---------- Seleção de arquivo / arrastar e soltar ----------
  const drop = $('drop');
  const fileInput = $('up-file');
  function updateDrop() {
    const f = fileInput.files[0];
    drop.classList.toggle('has-file', !!f);
    $('drop-text').innerHTML = f
      ? `<strong>${esc(f.name)}</strong><br><span class="small">${formatBytes(f.size)} · clique para trocar</span>`
      : `Clique ou arraste um arquivo aqui<br><span class="small">${esc(cfg.allowedExtensions.join(' '))} · até ${cfg.maxUploadMb} MB</span>`;
  }
  fileInput.addEventListener('change', updateDrop);
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('has-file'); }));
  drop.addEventListener('dragleave', () => updateDrop());
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) fileInput.files = e.dataTransfer.files;
    updateDrop();
  });

  // ---------- Upload ----------
  // 1) pede ao servidor uma URL de envio (só admin) · 2) envia o arquivo direto para o
  // armazenamento (Supabase em produção) com barra de progresso · 3) registra o material.

  /** PUT do arquivo com progresso (fetch não informa progresso de upload). */
  function putFile(upload, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(upload.method || 'PUT', upload.url);
      Object.entries(upload.headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.addEventListener('progress', (ev) => { if (ev.lengthComputable) onProgress(ev.loaded / ev.total); });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let detail = '';
        try { const d = JSON.parse(xhr.responseText); detail = d.error || d.message || ''; } catch { /* vazio */ }
        reject(new Error(`Falha ao enviar o arquivo (erro ${xhr.status})${detail ? `: ${detail}` : '.'}`));
      });
      xhr.addEventListener('error', () => reject(new Error('Falha de rede durante o envio do arquivo.')));
      xhr.send(file);
    });
  }

  $('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('upload-msg');
    const setMsg = (type, text) => { msg.className = type ? `alert alert-${type}` : 'alert'; msg.textContent = text; };
    setMsg('', '');

    const file = fileInput.files[0];
    const moduleId = $('up-module').value;
    if (!moduleId) return setMsg('error', 'Escolha um módulo.');
    if (!file) return setMsg('error', 'Selecione um arquivo.');
    if (file.size > cfg.maxUploadMb * 1024 * 1024) return setMsg('error', `Arquivo maior que ${cfg.maxUploadMb} MB.`);

    const bar = $('up-progress');
    const btn = $('upload-btn');
    bar.hidden = false;
    bar.firstElementChild.style.width = '0%';
    btn.disabled = true;

    try {
      const { objectPath, upload } = await api('/api/admin/uploads', {
        method: 'POST', body: { fileName: file.name, size: file.size, moduleId },
      });
      setMsg('', 'Enviando arquivo…');
      await putFile(upload, file, (p) => { bar.firstElementChild.style.width = `${Math.round(p * 100)}%`; });
      setMsg('', 'Publicando…');
      const data = await api('/api/admin/materials', {
        method: 'POST',
        body: {
          objectPath,
          originalName: file.name,
          moduleId,
          track: $('up-track').value,
          title: $('up-title').value,
          description: $('up-desc').value,
        },
      });

      setMsg('success', `“${data.material.title}” publicado em ${data.module.track} › ${data.module.title}.`);
      $('up-title').value = '';
      $('up-desc').value = '';
      fileInput.value = '';
      updateDrop();
      if (data.module.track === filterTrack) loadModules();
      else setFilter(data.module.track);
    } catch (err) {
      setMsg('error', err.message);
    } finally {
      btn.disabled = false;
      bar.hidden = true;
    }
  });

  // ---------- Lista de módulos/materiais ----------
  function setFilter(track) {
    filterTrack = track;
    document.querySelectorAll('#track-filter button').forEach((b) => b.classList.toggle('active', b.dataset.track === track));
    loadModules();
  }
  $('track-filter').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-track]');
    if (b) setFilter(b.dataset.track);
  });

  async function loadModules() {
    const el = $('admin-modules');
    try {
      const data = await api(`/api/tracks/${filterTrack}`);
      modulesCache = data.modules;
      if (!data.modules.length) {
        el.innerHTML = '<p class="empty">Nenhum módulo nesta trilha. Crie o primeiro acima.</p>';
        return;
      }
      el.innerHTML = data.modules.map((mod) => `
        <div class="admin-module">
          <div class="admin-module-head">
            <div>
              <h3>${esc(mod.title)}</h3>
              <span class="small muted">${esc(mod.description) || 'Sem descrição'} · ${mod.materials.length} ${mod.materials.length === 1 ? 'material' : 'materiais'}</span>
            </div>
            <button class="btn btn-danger btn-sm" type="button" data-del-module="${mod.id}">Excluir módulo</button>
          </div>
          <div class="admin-module-body">
            ${mod.materials.length ? mod.materials.map((m) => `
              <div class="material">
                <div class="mat-icon kind-${m.kind}">${esc(iconLabel(m))}</div>
                <div class="mat-info">
                  <button class="mat-title-btn" type="button" data-open="${m.id}">${esc(m.title)}</button>
                  <span class="small dim">${esc(m.originalName)} · ${formatBytes(m.size)} · ${formatDate(m.createdAt)}</span>
                </div>
                <div class="mat-actions">
                  <button class="btn btn-ghost btn-sm" type="button" data-open="${m.id}">Visualizar</button>
                  <a class="btn btn-ghost btn-sm" href="${m.downloadUrl}" download>Baixar</a>
                  <button class="btn btn-danger btn-sm" type="button" data-del-material="${m.id}">Remover</button>
                </div>
              </div>`).join('') : '<p class="empty">Sem materiais.</p>'}
          </div>
        </div>`).join('');
    } catch (err) {
      el.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
    }
  }

  $('admin-modules').addEventListener('click', async (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      const list = modulesCache.flatMap((mod) => mod.materials);
      const index = list.findIndex((m) => String(m.id) === opener.dataset.open);
      if (index >= 0) openViewer(list, index);
      return;
    }
    const delMat = e.target.closest('[data-del-material]');
    const delMod = e.target.closest('[data-del-module]');
    try {
      if (delMat) {
        if (!confirm('Remover este material? O arquivo será apagado do servidor.')) return;
        await api(`/api/admin/materials/${delMat.dataset.delMaterial}`, { method: 'DELETE' });
        toast('Material removido.');
      } else if (delMod) {
        const mod = modulesCache.find((m) => String(m.id) === delMod.dataset.delModule);
        const n = mod?.materials.length || 0;
        if (!confirm(`Excluir o módulo “${mod?.title}”${n ? ` e seus ${n} materiais` : ''}? Esta ação não pode ser desfeita.`)) return;
        await api(`/api/admin/modules/${delMod.dataset.delModule}`, { method: 'DELETE' });
        toast('Módulo excluído.');
      } else {
        return;
      }
      await loadModules();
      if ($('up-track').value === filterTrack) await fillModuleSelect(filterTrack);
    } catch (err) {
      toast(err.message);
    }
  });

  $('module-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('module-msg').textContent = '';
    try {
      const { module } = await api('/api/admin/modules', {
        method: 'POST',
        body: { track: filterTrack, title: $('mod-title').value, description: $('mod-desc').value },
      });
      $('mod-title').value = '';
      $('mod-desc').value = '';
      toast(`Módulo “${module.title}” criado em ${module.track}.`);
      await loadModules();
      if ($('up-track').value === module.track) await fillModuleSelect(module.track, module.id);
    } catch (err) {
      $('module-msg').textContent = err.message;
    }
  });

  // ---------- Alunos ----------
  async function loadStudents() {
    const { students } = await api('/api/admin/students');
    $('students-count').textContent = `${students.length} no total`;
    $('students').innerHTML = students.length ? `
      <div class="table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Nível</th><th>Testes</th><th>Cadastro</th></tr></thead>
        <tbody>
          ${students.map((s) => `
            <tr>
              <td>${esc(s.name)}</td>
              <td>${esc(s.email)}</td>
              <td>${s.level ? `<span class="level-badge level-${esc(s.level)}">${esc(s.level)}</span>` : '<span class="tag">Pendente</span>'}</td>
              <td>${s.attempts}</td>
              <td>${formatDate(s.created_at)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>` : '<p class="empty">Nenhum aluno cadastrado ainda.</p>';
  }

  await Promise.all([fillModuleSelect('A1'), loadModules(), loadStudents()]);
})();
