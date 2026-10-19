(() => {
  const element = (id) => document.getElementById(id);
  const labels = { new: 'Novo', 'new-directory': 'Nova pasta', directory: 'Pasta existente', changed: 'Alterado', equal: 'Igual', preserved: 'Existente preservado', conflict: 'Conflito', blocked: 'Bloqueado', integrity: 'Integridade divergente', extra: 'Extra preservado' };
  const statuses = { queued: 'Na fila', running: 'Em andamento', completed: 'Concluído', partial: 'Concluído com pendências', paused: 'Pausado', failed: 'Falhou', cancelled: 'Cancelado', interrupted: 'Interrompido' };
  let selectedRun;
  let selectedJob;
  let offset = 0;
  let timer;
  const visible = () => !document.hidden && element('fileops').classList.contains('active') && !element('sync-panel').hidden;
  async function api(url, method = 'GET', body) {
    const response = await fetch(`/api/sync${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload.error || 'Falha na sincronização'), { code: payload.code });
    return payload.data;
  }
  function message(error) {
    element('sync-message').textContent = error.message || error;
    if (element('backups').classList.contains('active')) element('sync-history-message').textContent = error.message || error;
  }
  function button(label, action) {
    const control = document.createElement('button');
    control.type = 'button'; control.className = 'btn btn-secondary'; control.textContent = label;
    control.addEventListener('click', async () => {
      control.disabled = true;
      try { await action(); } catch (error) { message(error); }
      finally { control.disabled = false; }
    });
    return control;
  }
  function text(parent, value, tag = 'p') { const node = document.createElement(tag); node.textContent = value; parent.append(node); return node; }
  async function start(job, kind, body) {
    const run = await api(`/jobs/${job.id}/${kind}`, 'POST', body);
    selectedRun = run.id; selectedJob = job; offset = 0;
    message('Execução na fila. Acompanhe o resultado abaixo.');
    await progress();
  }
  function select(options, value, label) {
    const control = document.createElement('select'); control.setAttribute('aria-label', label);
    for (const [key, title] of options) {
      const option = document.createElement('option'); option.value = key; option.textContent = title; control.append(option);
    }
    control.value = value;
    return control;
  }
  async function loadJobs() {
    const jobs = await api('/jobs');
    const container = element('sync-jobs'); container.replaceChildren();
    const history = element('sync-history-job'); const previous = history.value; history.replaceChildren();
    for (const job of jobs) {
      const option = document.createElement('option'); option.value = job.id; option.textContent = job.name; history.append(option);
      const card = document.createElement('article'); card.className = 'sync-job';
      text(card, job.name, 'h4'); text(card, `${job.sourcePath} → ${job.targetPath}`);
      if (job.sourceVolume && job.sourceVolume === job.targetVolume) text(card, 'Origem e destino estão no mesmo volume. Use outro HD para proteger contra falha física.');
      text(card, `${job.mode === 'versioned' ? `Backup versionado · ${job.retention} anteriores` : 'Copiar somente novos · Sem substituições'} · ${job.active ? 'Agendado' : 'Manual/pausado'}`);
      if (job.lastRun) text(card, `Última execução: ${statuses[job.lastRun.status] || job.lastRun.status} (${new Date(job.lastRun.finishedAt).toLocaleString('pt-BR')})`);
      const actions = document.createElement('div'); actions.className = 'form-actions';
      actions.append(button('Preview', () => start(job, 'preview')), button('Executar', () => start(job, 'run')),
        button('Verificação completa', () => start(job, 'verify')),
        button('Revisar discos importados', async () => {
          const sourcePath = window.prompt('Confirme a pasta de origem:', job.sourcePath);
          if (!sourcePath) return;
          const targetPath = window.prompt('Confirme a pasta de destino:', job.targetPath);
          if (!targetPath) return;
          const body = { sourcePath, targetPath };
          try { await api(`/jobs/${job.id}/review`, 'POST', body); }
          catch (error) {
            if (error.code !== 'VOLUME_CHANGED' || !window.confirm('A identidade dos discos mudou. Confirma vincular estas pastas aos discos atuais?')) throw error;
            await api(`/jobs/${job.id}/review`, 'POST', { ...body, confirmIdentityChange: true });
          }
          message('Discos revisados. Gere um preview.'); await loadJobs();
        }),
        button('Último resultado', async () => {
          const current = (await api('/jobs')).find((entry) => entry.id === job.id);
          selectedRun = current?.activeRun || current?.lastRun?.id; selectedJob = current; offset = 0;
          if (selectedRun) await progress();
        }));
      const frequency = select([['manual', 'Manual'], ['1h', 'A cada hora'], ['6h', 'A cada 6 horas'], ['1d', 'Diariamente']], job.frequency, `Frequência de ${job.name}`);
      const retention = select([[1, '1 anterior'], [3, '3 anteriores'], [5, '5 anteriores']], job.retention, `Versões de ${job.name}`);
      retention.hidden = job.mode !== 'versioned';
      actions.append(frequency, retention, button('Salvar agenda e retenção', async () => {
        await api(`/jobs/${job.id}`, 'PUT', { frequency: frequency.value, active: frequency.value !== 'manual', retention: Number(retention.value) }); await loadJobs();
      }), button('Pausar agenda', async () => { await api(`/jobs/${job.id}`, 'PUT', { active: false }); await loadJobs(); }),
      button('Remover job', async () => {
        if (window.confirm('Remover apenas o job? Arquivos e histórico serão mantidos.')) { await api(`/jobs/${job.id}`, 'DELETE'); await loadJobs(); }
      }));
      card.append(actions); container.append(card);
    }
    history.value = previous || jobs[0]?.id || '';
    if (!jobs.length) text(container, 'Nenhuma sincronização configurada.');
  }
  async function progress() {
    clearTimeout(timer);
    if (!selectedRun || !visible()) return;
    const run = await api(`/runs/${selectedRun}`);
    element('sync-progress').textContent = `${statuses[run.status] || run.status} · ${Object.entries(run.counts).map(([key, value]) => `${labels[key] || key}: ${value}`).join(' · ')} · ${(run.bytes / 1048576).toFixed(1)} MiB candidatos · ${run.processed || 0} copiados · ${((run.historyBytes || 0) / 1048576).toFixed(1)} MiB de histórico preservado${run.space ? ` · ${(run.space.freeBytes / 1073741824).toFixed(1)} GiB livres` : ''} ${run.error ? `· ${run.error}` : ''}`;
    const data = await api(`/runs/${selectedRun}/results?offset=${offset}`);
    const container = element('sync-results'); container.replaceChildren();
    if (['running', 'queued'].includes(run.status) || run.status === 'paused' && run.code === 'RESOURCE_CONSTRAINED') {
      container.append(button('Cancelar execução ou retomada', async () => { await api(`/runs/${run.id}/cancel`, 'POST'); await progress(); }));
    }
    for (const item of data.items) {
      const row = document.createElement('div'); row.className = 'sync-result';
      text(row, `${labels[item.type] || item.type}: ${item.relative}${item.error ? ` — ${item.error}` : ''}`);
      if (['conflict', 'integrity'].includes(item.type) && item.sourceHash && item.targetHash) {
        for (const [choice, label] of [['source', 'Usar origem e preservar destino'], ['target', 'Manter destino nesta execução']]) {
          row.append(button(label, () => start(selectedJob, 'resolve', { relative: item.relative, sourceHash: item.sourceHash, targetHash: item.targetHash, choice })));
        }
      }
      container.append(row);
    }
    element('sync-more').hidden = data.nextOffset === null;
    element('sync-more').onclick = () => { offset = data.nextOffset; progress().catch(message); };
    if (['queued', 'running'].includes(run.status)) timer = setTimeout(() => progress().catch(message), 1500);
    else await loadJobs();
  }
  function mode(sync) {
    element('sync-panel').hidden = !sync; element('operation-config-zone').hidden = sync;
    element('single-mode').setAttribute('aria-pressed', String(!sync)); element('sync-mode').setAttribute('aria-pressed', String(sync));
    clearTimeout(timer);
    if (sync) { loadJobs().catch(message); progress().catch(message); }
  }
  element('single-mode').addEventListener('click', () => mode(false));
  element('sync-policy').addEventListener('change', () => { element('sync-retention').parentElement.hidden = element('sync-policy').value !== 'versioned'; });
  element('sync-mode').addEventListener('click', () => mode(true));
  element('sync-create').addEventListener('submit', async (event) => {
    event.preventDefault(); const control = event.submitter; control.disabled = true;
    try {
      await api('/jobs', 'POST', { name: element('sync-name').value, sourcePath: element('sync-source').value,
        targetPath: element('sync-target').value, mode: element('sync-policy').value, retention: Number(element('sync-retention').value) });
      message('Sincronização salva. Gere o preview antes de executar.'); await loadJobs();
    } catch (error) { message(error); } finally { control.disabled = false; }
  });
  element('sync-history-load').addEventListener('click', async () => {
    const jobId = element('sync-history-job').value; const relative = element('sync-history-path').value;
    try {
      const versions = await api(`/jobs/${jobId}/history?relative=${encodeURIComponent(relative)}`);
      const container = element('sync-history-list'); container.replaceChildren();
      element('sync-history-message').textContent = `${versions.length} versões anteriores encontradas.`;
      for (const version of [...versions].reverse()) {
        const row = document.createElement('div'); text(row, `${version.createdAt} · ${version.size} bytes`);
        const restore = async (body) => {
          const run = await api(`/jobs/${jobId}/restore`, 'POST', { relative, versionId: version.id, ...body });
          selectedRun = run.id; selectedJob = { id: jobId }; offset = 0;
          element('sync-history-message').textContent = 'Restauração iniciada. Consulte o último resultado em Sincronização local.';
        };
        row.append(button('Restaurar em outro caminho', async () => {
          const targetPath = window.prompt('Caminho completo para um arquivo que ainda não exista:');
          if (targetPath) await restore({ targetPath });
        }), button('Restaurar sobre o atual', async () => {
          if (window.confirm('Preservar o atual no histórico e restaurar esta versão?')) await restore({ replace: true, confirm: true });
        })); container.append(row);
      }
    } catch (error) { element('sync-history-message').textContent = error.message; }
  });
  element('sync-history-review').addEventListener('click', async () => {
    try {
      const job = (await api('/jobs')).find((entry) => entry.id === element('sync-history-job').value);
      if (!job) throw new Error('Selecione uma sincronização');
      const targetPath = window.prompt('Pasta do backup existente, mesmo sem o HD de origem:', job.targetPath);
      if (!targetPath) return;
      const body = { targetPath, destinationOnly: true };
      try { await api(`/jobs/${job.id}/review`, 'POST', body); }
      catch (error) {
        if (error.code !== 'VOLUME_CHANGED' || !window.confirm('Confirma vincular o repositório existente ao disco atual para recuperação?')) throw error;
        await api(`/jobs/${job.id}/review`, 'POST', { ...body, confirmIdentityChange: true });
      }
      element('sync-history-message').textContent = 'Destino revisado. Você pode consultar e restaurar versões sem a origem.';
    } catch (error) { message(error); }
  });
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    if (visible()) progress().catch(message);
    if (element('backups').classList.contains('active')) loadJobs().catch(message);
  });
  for (const id of ['fileops', 'backups']) observer.observe(element(id), { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (visible()) progress().catch(message); });
})();
