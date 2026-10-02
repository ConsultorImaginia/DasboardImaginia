// Espera a que el DOM exista antes de buscar los elementos de la vista de detalle.
document.addEventListener("DOMContentLoaded", () => {
  initDetailPage();
});

// Recupera los casos locales y devuelve una lista vacía si el JSON está dañado.
function readStoredCases() {
  try {
    return JSON.parse(localStorage.getItem("jira-dashboard-cases") || "[]");
  } catch (error) {
    return [];
  }
}

// Obtiene el identificador de la URL, carga el caso y coordina el renderizado de la página.
async function initDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("caseId");

  const detailCard = document.getElementById("detailCaseCard");
  const timeline = document.getElementById("detailTimeline");
  const status = document.getElementById("detailStatus");

  if (!caseId) {
    status.textContent = "No se indicó un caso para consultar.";
    status.className = "status-message error";
    return;
  }

  // Busca primero en el almacenamiento local y consulta Firebase si no hay coincidencia.
  let caseRecord = readStoredCases().find((item) => String(item.caseId) === String(caseId));

  if (!caseRecord && window.JiraFirebase?.loadCaseById) {
    caseRecord = await window.JiraFirebase.loadCaseById(caseId);
  }

  if (!caseRecord) {
    status.textContent = `No se encontró información para el caso ${caseId}.`;
    status.className = "status-message error";
    return;
  }

  renderDetailCard(caseRecord, detailCard);
  renderTimeline(caseRecord.history || [], timeline);
  status.textContent = `Trazabilidad cargada para ${caseId}.`;
  status.className = "status-message success";
}

// Muestra los campos principales del caso y sus distintivos de prioridad y escalamiento.
function renderDetailCard(caseRecord, element) {
  if (!element) return;

  const priority = caseRecord.priority || "Sin prioridad";
  const escalated = Boolean(caseRecord.escalated);
  const stateLabel = caseRecord.currentState || "Sin estado";

  element.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Caso Jira</p>
        <h1>${escapeHtml(caseRecord.caseId || "Sin identificador")}</h1>
      </div>
      <div class="detail-badges">
        <span class="badge ${escalated ? "danger" : "success"}">${escalated ? "Escalado" : "Normal"}</span>
        <span class="badge warning">${escapeHtml(priority)}</span>
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <span class="detail-label">Resumen</span>
        <strong>${escapeHtml(caseRecord.summary || "Sin resumen")}</strong>
      </div>
      <div>
        <span class="detail-label">Responsable</span>
        <strong>${escapeHtml(caseRecord.responsible || "Sin asignar")}</strong>
      </div>
      <div>
        <span class="detail-label">Estado actual</span>
        <strong>${escapeHtml(stateLabel)}</strong>
      </div>
      <div>
        <span class="detail-label">Última revisión</span>
        <strong>${escapeHtml(caseRecord.lastUpdatedAt ? new Date(caseRecord.lastUpdatedAt).toLocaleDateString("es-ES") : "Sin fecha")}</strong>
      </div>
      <div>
        <span class="detail-label">Fecha de creación</span>
        <strong>${escapeHtml(caseRecord.createdAt ? new Date(caseRecord.createdAt).toLocaleDateString("es-ES") : "Sin fecha")}</strong>
      </div>
      <div>
        <span class="detail-label">Días en estado actual</span>
        <strong>${Number(caseRecord.ageDays || 0)}</strong>
      </div>
    </div>
  `;
}

// Dibuja la secuencia de transiciones de estado o indica que no hay cambios registrados.
function renderTimeline(history, element) {
  if (!element) return;

  if (!history.length) {
    element.innerHTML = '<div class="empty-state">No hay trazabilidad registrada para este caso.</div>';
    return;
  }

  element.innerHTML = history
    .map((entry) => `
      <article class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-topline">
            <strong>${escapeHtml(entry.toState || "Cambio de estado")}</strong>
            <span>${escapeHtml(formatDate(entry.date))}</span>
          </div>
          <p>${escapeHtml(entry.fromState || "Sin estado inicial")} → ${escapeHtml(entry.toState || "Sin estado final")}</p>
          <small>Responsable: ${escapeHtml(entry.responsible || "Sin responsable")}</small>
        </div>
      </article>
    `)
    .join("");
}

// Presenta una fecha válida en formato local y conserva el valor si no puede interpretarse.
function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-ES");
}

// Escapa caracteres especiales antes de insertar datos del caso dentro de HTML.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
