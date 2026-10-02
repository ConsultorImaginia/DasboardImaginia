// Proporciona operaciones sencillas de persistencia JSON sobre el almacenamiento local.
window.JiraStorage = {
  // Serializa y guarda un valor bajo la clave indicada.
  async save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  },
  // Lee la clave y devuelve null cuando todavía no existe.
  async load(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
};
