/* Painel admin: links das apresentações (Canva) e importação dos homeworks. */
(async () => {
  const { api, esc, toast } = Novera;
  const $ = (id) => document.getElementById(id);
  const user = await Novera.currentUser();
  if (user?.role !== 'admin') return;

  let data = null;
  let level = 'A1';

  async function load() {
    data = await api('/api/admin/lessons');
    $('hw-totals').textContent = `${data.totals.uploaded} de ${data.totals.homework} homeworks publicados`;
    render();
  }

  function render() {
    $('lesson-admin').innerHTML = data.levels[level].map((l) => `
      <div class="lesson-row" data-n="${l.number}">
        <span class="lesson-num">${String(l.number).padStart(2, '0')}</span>
        <div class="lesson-main">
          <strong>${esc(l.title)}</strong>
          <div class="lesson-link">
            <label class="sr-only" for="link-${level}-${l.number}">Link da aula ${l.number}</label>
            <input id="link-${level}-${l.number}" type="url" placeholder="https://www.canva.com/design/…/view" value="${esc(l.url)}">
            <button type="button" class="btn btn-ghost btn-sm" data-save>Salvar</button>
            ${l.url ? `<a class="btn btn-ghost btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener">Testar</a>` : ''}
          </div>
          <div class="lesson-hw">${l.homework.length
            ? l.homework.map((h) => `<span class="tag ${h.uploaded ? 'tag-own' : ''}" title="${esc(h.file)}">${h.uploaded ? '✓' : '…'} ${esc(h.code.replace(`${level} · `, ''))} ${esc(h.title)}</span>`).join('')
            : '<span class="small dim">Sem homework nesta aula</span>'}</div>
        </div>
      </div>`).join('');
  }

  $('lesson-level').addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    level = b.dataset.level;
    document.querySelectorAll('#lesson-level button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  });

  $('lesson-admin').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-save]');
    if (!b) return;
    const row = b.closest('.lesson-row');
    const n = Number(row.dataset.n);
    const url = row.querySelector('input').value.trim();
    b.disabled = true;
    try {
      await api(`/api/admin/lessons/${level}/${n}/link`, { method: 'PUT', body: { url } });
      toast(url ? `Link da aula ${n} salvo.` : `Link da aula ${n} removido.`);
      await load();
    } catch (err) {
      toast(err.message);
    } finally {
      b.disabled = false;
    }
  });

  // ---------------------------------------------------------------- importação em lote
  function putFile(upload, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(upload.method || 'PUT', upload.url);
      Object.entries(upload.headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.addEventListener('progress', (ev) => { if (ev.lengthComputable) onProgress(ev.loaded / ev.total); });
      xhr.addEventListener('load', () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`erro ${xhr.status}`))));
      xhr.addEventListener('error', () => reject(new Error('falha de rede')));
      xhr.send(file);
    });
  }

  $('hw-files').addEventListener('change', async (e) => {
    const files = [...e.target.files].filter((f) => /\.pdf$/i.test(f.name));
    e.target.value = '';
    if (!files.length) return toast('Selecione arquivos PDF.');
    const bar = $('hw-progress');
    const report = $('hw-report');
    const ok = [];
    const skipped = [];
    const failed = [];
    bar.hidden = false;
    report.innerHTML = '';
    for (const [i, file] of files.entries()) {
      $('hw-status').textContent = `Enviando ${i + 1} de ${files.length}: ${file.name}`;
      try {
        const start = await api('/api/admin/homework/uploads', { method: 'POST', body: { fileName: file.name, size: file.size } });
        await putFile(start.upload, file, (p) => { bar.firstElementChild.style.width = `${((i + p) / files.length) * 100}%`; });
        await api('/api/admin/homework', { method: 'POST', body: { key: start.key, objectPath: start.objectPath } });
        ok.push(`${start.code} — ${start.title}`);
      } catch (err) {
        if (err.code === 'UNKNOWN_FILE') skipped.push(file.name);
        else failed.push(`${file.name}: ${err.message}`);
      }
      bar.firstElementChild.style.width = `${((i + 1) / files.length) * 100}%`;
    }
    bar.hidden = true;
    $('hw-status').textContent = `Concluído: ${ok.length} publicado(s)${skipped.length ? ` · ${skipped.length} fora da lista` : ''}${failed.length ? ` · ${failed.length} com erro` : ''}.`;
    report.innerHTML = [
      ...failed.map((f) => `<li class="t-miss">✗ ${esc(f)}</li>`),
      ...skipped.map((f) => `<li class="dim">• Não reconhecido (fica de fora): ${esc(f)}</li>`),
    ].join('');
    await load();
  });

  load();
})();
