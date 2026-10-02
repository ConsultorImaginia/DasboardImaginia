window.JiraStorage = {
  async save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  },
  async load(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
};
