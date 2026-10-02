window.dashboardUtils = {
  isObject(value) {
    return value !== null && typeof value === "object";
  },
  safeText(value) {
    return String(value ?? "");
  }
};
