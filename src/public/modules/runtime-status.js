(function attachDeParaRuntimeStatus(windowRef) {
  const api = {
    async fetchSystemResources() {
      const response = await fetch('/api/status/resources');
      if (!response.ok) {
        throw new Error('Falha ao carregar recursos do sistema');
      }
      return response.json();
    },

    async fetchRecentActivities() {
      const response = await fetch('/api/files/stats');
      if (!response.ok) {
        throw new Error('Falha ao carregar atividades recentes');
      }
      return response.json();
    },

    async fetchScheduledOperations() {
      const response = await fetch('/api/files/scheduled');
      if (!response.ok) {
        throw new Error('Falha ao carregar operações agendadas');
      }
      return response.json();
    }
  };

  windowRef.DeParaRuntimeStatus = api;
}(window));
