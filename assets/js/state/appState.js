// Centraliza datos compartidos entre las vistas: casos, gráficos y valores de filtros.
window.appState = {
  cases: [],
  charts: {},
  filters: {
    state: "",
    responsible: "",
    escalated: false
  }
};
