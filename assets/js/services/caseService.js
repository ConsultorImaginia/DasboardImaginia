// Agrupa las operaciones de dominio relacionadas con los casos Jira.
window.caseService = {
  // Devuelve una estructura válida para que otros módulos trabajen con el caso.
  normalizeCase(item) {
    return item || {};
  }
};
