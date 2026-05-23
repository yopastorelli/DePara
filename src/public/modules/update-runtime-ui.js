(function attachDeParaUpdateRuntimeUI(windowRef) {
  function render(data, helpers) {
    const {
      getUpdateStateBadgeClass,
      getUpdateFrequencyLabel
    } = helpers;

    const statusText = document.getElementById('update-status-text');
    const versionText = document.getElementById('update-version-text');
    const lastCheckText = document.getElementById('update-last-check-text');
    const lastResultText = document.getElementById('update-last-result-text');
    const stateBadge = document.getElementById('update-state-badge');
    const updateActions = document.getElementById('update-actions');
    const updateMessage = document.getElementById('update-message');
    const updateCommits = document.getElementById('update-commits');
    const autoCheckUpdates = document.getElementById('auto-check-updates');
    const updateCheckFrequency = document.getElementById('update-check-frequency');
    const autoApplyUpdates = document.getElementById('auto-apply-updates');

    const state = data.state || {};
    const config = data.config || {};
    const runtime = data.runtime || {};
    const supervisor = runtime.supervisor || {};
    const scheduler = runtime.scheduler || {};
    const worktree = runtime.worktree || {};
    const hasUpdates = Boolean(
      state.targetCommit &&
      state.currentCommit &&
      state.targetCommit !== state.currentCommit
    );

    if (statusText) {
      if (state.lastError) {
        statusText.textContent = `Erro: ${state.lastError}`;
      } else if (scheduler.stale) {
        statusText.textContent = 'Alerta: scheduler de auto-update está sem ciclos recentes';
      } else if (runtime.autoUpdateOperationallyReady === false) {
        statusText.textContent = 'Alerta: auto-update não está operacionalmente apto neste runtime';
      } else {
        statusText.textContent = `Status: ${state.status || 'idle'}`;
      }
    }

    if (lastCheckText) {
      lastCheckText.textContent = `Última verificação: ${state.lastCheckAt ? new Date(state.lastCheckAt).toLocaleString('pt-BR') : '-'}`;
    }

    if (lastResultText) {
      const supervisorLabel = supervisor.supervisor || 'desconhecido';
      const failureStage = runtime.lastFailureStage || state.lastFailureStage || '-';
      lastResultText.textContent = `Último resultado: ${state.lastEvent || '-'} | supervisor: ${supervisorLabel} | etapa: ${failureStage}`;
    }

    if (versionText) {
      const current = state.currentCommit ? state.currentCommit.slice(0, 8) : 'desconhecida';
      const target = state.targetCommit ? state.targetCommit.slice(0, 8) : current;
      const schedulerLabel = scheduler.lastCycleAt
        ? new Date(scheduler.lastCycleAt).toLocaleString('pt-BR')
        : 'sem ciclo registrado';
      versionText.textContent = `Commit atual: ${current} | alvo: ${target} | último ciclo: ${schedulerLabel}`;
    }

    if (stateBadge) {
      const status = state.status || 'idle';
      stateBadge.textContent = status;
      stateBadge.className = `badge ${getUpdateStateBadgeClass(status)}`;
    }

    if (autoCheckUpdates) {
      autoCheckUpdates.checked = Boolean(config.enabled);
    }

    if (autoApplyUpdates) {
      autoApplyUpdates.checked = Boolean(config.autoApply);
    }

    if (updateCheckFrequency) {
      updateCheckFrequency.value = getUpdateFrequencyLabel(Number(config.checkIntervalMinutes) || 0);
    }

    if (updateActions) {
      updateActions.style.display = 'block';
    }

    if (updateMessage) {
      if (runtime.autoUpdateOperationallyReady === false) {
        const reasons = Array.isArray(supervisor.reasons) ? supervisor.reasons.join(', ') : 'sem detalhes';
        updateMessage.textContent = `Runtime não apto para auto-update automático: ${reasons}`;
      } else if (scheduler.stale) {
        updateMessage.textContent = 'Scheduler sem ciclos recentes. Verifique PM2, restart e persistência do processo.';
      } else {
        updateMessage.textContent = hasUpdates
          ? 'Ha atualizacao disponivel no origin/main'
          : 'Aplicacao atualizada. Voce ainda pode executar ciclo manual para diagnostico.';
      }
    }

    if (updateCommits) {
      updateCommits.textContent = hasUpdates
        ? `Atual: ${(state.currentCommit || '').slice(0, 8)} -> Alvo: ${(state.targetCommit || '').slice(0, 8)}`
        : '';
    }
  }

  windowRef.DeParaUpdateRuntimeUI = {
    render
  };
}(window));
