// Reúne conversiones pequeñas reutilizables por los módulos del dashboard.
window.dashboardUtils = {
  // Comprueba que un valor sea un objeto distinto de null.
  isObject(value) {
    return value !== null && typeof value === "object";
  },
  // Convierte cualquier valor a texto y trata null o undefined como cadena vacía.
  safeText(value) {
    return String(value ?? "");
  }
};
