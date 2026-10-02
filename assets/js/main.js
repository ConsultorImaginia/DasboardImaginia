const state = {
  rawRows: [],
  cases: [],
  charts: {},
  chartPalette: ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#475569"],
  currentFilters: {}
};

const CLOSED_PATTERN = /CERRAD|RESUELT|DONE|CLOSED|FINALIZ|COMPLET|ENTREGAD/i;

function bindUi() {
  const btnLoad = document.getElementById("btnLoadFile");
  const inputFile = document.getElementById("excelInput");
  const btnSaveFirebase = document.getElementById("btnSaveFirebase");
  const btnHistory = document.getElementById("btnHistory");
  const filterState = document.getElementById("filterState");
  const filterResponsible = document.getElementById("filterResponsible");
  const filterPriority = document.getElementById("filterPriority");
  const dateFrom = document.getElementById("dateFrom");
  const dateTo = document.getElementById("dateTo");
  const filterEscalated = document.getElementById("filterEscalated");
  const btnExportCsv = document.getElementById("btnExportCsv");

  btnLoad?.addEventListener("click", () => inputFile?.click());
  inputFile?.addEventListener("change", handleExcelUpload);
  btnSaveFirebase?.addEventListener("click", saveCurrentCasesToFirebase);
  btnHistory?.addEventListener("click", () => window.location.href = "history.html");
  btnExportCsv?.addEventListener("click", exportCurrentCsv);

  [filterState, filterResponsible, filterPriority, dateFrom, dateTo, filterEscalated].forEach((element) => {
    element?.addEventListener("change", applyFilters);
  });
}

function setStatus(message, type = "info") {
  const el = document.getElementById("statusMessage");
  if (!el) return;

  el.textContent = message;
  el.style.background = type === "error" ? "#fef2f2" : type === "success" ? "#ecfdf5" : "#eff6ff";
  el.style.borderColor = type === "error" ? "#fecaca" : type === "success" ? "#a7f3d0" : "#bfdbfe";
  el.style.color = type === "error" ? "#b91c1c" : type === "success" ? "#166534" : "#1d4ed8";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "number") {
    return new Date(Math.round((value - 25569) * 86400000));
  }

  if (typeof value === "string" && value.trim()) {
    const match = value.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) {
      let year = Number(match[3]);
      if (year < 100) year += 2000;
      return new Date(year, Number(match[2]) - 1, Number(match[1]));
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function fmtDate(date) {
  if (!date) return "";
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  if (typeof date === "string") {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return "";
}

function daysBetween(dateA, dateB) {
  if (!(dateA instanceof Date) || !(dateB instanceof Date)) return 0;
  return Math.max(0, Math.floor((dateB - dateA) / 86400000));
}

function normalizePriority(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Sin prioridad";

  const normalized = normalizeText(text);
  if (["P1", "CRITICO", "BLOCKER", "SEV1"].includes(normalized)) return "P1";
  if (["P2", "ALTA", "HIGH", "SEV2"].includes(normalized)) return "Alta";
  if (["P3", "MEDIA", "MEDIUM"].includes(normalized)) return "Media";
  if (["BAJA", "LOW"].includes(normalized)) return "Baja";
  return text;
}

function getPriorityBadge(priority) {
  const value = String(priority || "Sin prioridad").trim();
  const normalized = normalizeText(value);

  if (["P1", "CRITICO", "BLOCKER", "SEV1"].includes(normalized)) {
    return { label: value || "P1", className: "danger" };
  }

  if (["P2", "ALTA", "HIGH", "SEV2"].includes(normalized)) {
    return { label: value || "Alta", className: "warning" };
  }

  if (["P3", "MEDIA", "MEDIUM"].includes(normalized)) {
    return { label: value || "Media", className: "success" };
  }

  if (["BAJA", "LOW"].includes(normalized)) {
    return { label: value || "Baja", className: "success" };
  }

  return { label: value || "Sin prioridad", className: "success" };
}

function persistCases(cases) {
  try {
    localStorage.setItem("jira-dashboard-cases", JSON.stringify(cases));
  } catch (error) {
    console.warn("No se pudo guardar el estado local de casos.", error);
  }
}

function loadCasesFromStorage() {
  try {
    return JSON.parse(localStorage.getItem("jira-dashboard-cases") || "[]");
  } catch (error) {
    return [];
  }
}

function getCaseById(caseId) {
  const stored = state.cases.length ? state.cases : loadCasesFromStorage();
  return stored.find((item) => String(item.caseId) === String(caseId)) || null;
}

async function handleExcelUpload(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    state.rawRows = rawRows;
    const cases = buildCasesFromRows(rawRows);
    state.cases = cases;
    persistCases(cases);

    renderDashboard(cases);
    populateDropdowns(cases);

    setStatus(`${file.name} cargado correctamente. ${cases.length} casos únicos detectados.`, "success");

    if (window.JiraFirebase?.uploadExcelToStorage) {
      const uploadMeta = await window.JiraFirebase.uploadExcelToStorage(file);
      await window.JiraFirebase.saveUploadRecord(file.name, rawRows.length, uploadMeta.uploadId, uploadMeta.url || "");
    }
  } catch (error) {
    console.error(error);
    setStatus("No se pudo cargar el archivo. Revisa el formato o columnas del Excel.", "error");
  }
}

function buildCasesFromRows(rows) {
  const normalized = rows
    .map((row) => {
      const normalizedRow = {};
      Object.keys(row).forEach((header) => {
        normalizedRow[normalizeText(header)] = row[header];
      });

      const priorityValue = [
        normalizedRow["PRIORIDAD"],
        normalizedRow["PRIORITY"],
        normalizedRow["SEVERIDAD"],
        normalizedRow["CRITICIDAD"],
        normalizedRow["NIVEL DE PRIORIDAD"]
      ].find((value) => value !== undefined && value !== null && String(value).trim() !== "");

      return {
        caseId: String(normalizedRow["ID JIRA"] ?? "").trim(),
        summary: normalizedRow["RESUMEN"] ?? "",
        responsible: String(normalizedRow["RESPONSABLE"] ?? "").trim() || "Sin asignar",
        createdAt: toDate(normalizedRow["FECHA DE CREACION"]),
        updatedAt: toDate(normalizedRow["FECHA DE ACTUALIZACION"]),
        initialState: String(normalizedRow["ESTADO INICIAL"] ?? "").trim(),
        currentState: String(normalizedRow["ESTADO ACTUAL"] ?? "").trim(),
        priority: normalizePriority(priorityValue),
        ageText: normalizedRow["ANTIGUEDAD"] ?? "",
        escalated: String(normalizedRow["ESCALADO"] ?? "").toLowerCase() === "true" || /ESCALAD|URGENT|CRITIC|SEV1|SEV2|HOTFIX/i.test(String(normalizedRow["ESTADO ACTUAL"] ?? "") + " " + String(normalizedRow["RESUMEN"] ?? ""))
      };
    })
    .filter((row) => row.caseId);

  const grouped = {};

  normalized.forEach((item) => {
    if (!grouped[item.caseId]) grouped[item.caseId] = [];
    grouped[item.caseId].push(item);
  });

  return Object.values(grouped).map((group) => {
    group.sort((a, b) => {
      const left = a.updatedAt || a.createdAt || new Date(0);
      const right = b.updatedAt || b.createdAt || new Date(0);
      return left - right;
    });

    const latest = group[group.length - 1];
    const history = [];
    let prevState = group[0]?.initialState || group[0]?.currentState || "";

    group.forEach((entry) => {
      const nextState = entry.currentState || entry.initialState || prevState;
      if (entry.currentState && prevState && nextState !== prevState) {
        history.push({
          date: (entry.updatedAt || entry.createdAt || new Date()).toISOString(),
          fromState: prevState,
          toState: nextState,
          responsible: entry.responsible,
          caseId: latest.caseId
        });
      }
      prevState = nextState;
    });

    const latestStateDate = latest.updatedAt || latest.createdAt || new Date();
    const currentDayCount = daysBetween(latestStateDate, new Date());
    const closed = CLOSED_PATTERN.test(latest.currentState || "");

    return {
      caseId: latest.caseId,
      summary: latest.summary,
      responsible: latest.responsible,
      createdAt: latest.createdAt || new Date(),
      initialState: group[0]?.initialState || "",
      currentState: latest.currentState || "",
      lastUpdatedAt: latest.updatedAt || latest.createdAt || new Date(),
      ageDays: currentDayCount,
      priority: latest.priority || "Sin prioridad",
      escalated: Boolean(latest.escalated || (latest.currentState && /ESCALAD|URGENT|CRITIC|SEV1|SEV2|HOTFIX/i.test(latest.currentState))),
      closed,
      totalChanges: history.length,
      ageText: latest.ageText || "",
      history
    };
  });
}

function populateDropdowns(cases) {
  const filterState = document.getElementById("filterState");
  const filterResponsible = document.getElementById("filterResponsible");
  const filterPriority = document.getElementById("filterPriority");

  if (!filterState || !filterResponsible) return;

  const stateList = [...new Set(cases.map((item) => item.currentState).filter(Boolean))].sort();
  const responsibleList = [...new Set(cases.map((item) => item.responsible).filter(Boolean))].sort();
  const priorityList = [...new Set(cases.map((item) => item.priority).filter(Boolean))].sort();

  filterState.innerHTML = '<option value="">Todos</option>' + stateList.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  filterResponsible.innerHTML = '<option value="">Todos</option>' + responsibleList.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");

  if (filterPriority) {
    const options = ["P1", "Alta", "Media", "Baja", "Sin prioridad"];
    const uniqueOptions = [...new Set([...options, ...priorityList])];
    filterPriority.innerHTML = '<option value="">Todas</option>' + uniqueOptions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function applyFilters() {
  const filterState = document.getElementById("filterState")?.value || "";
  const filterResponsible = document.getElementById("filterResponsible")?.value || "";
  const filterPriority = document.getElementById("filterPriority")?.value || "";
  const dateFromValue = document.getElementById("dateFrom")?.value || "";
  const dateToValue = document.getElementById("dateTo")?.value || "";
  const escalatedMode = document.getElementById("filterEscalated")?.value || "all";

  const filtered = state.cases.filter((item) => {
    const matchesState = !filterState || item.currentState === filterState;
    const matchesResponsible = !filterResponsible || item.responsible === filterResponsible;
    const matchesPriority = !filterPriority || normalizeText(item.priority || "Sin prioridad") === normalizeText(filterPriority);
    const matchesEscalated = escalatedMode === "all" ? true : escalatedMode === "escalados" ? Boolean(item.escalated) : !item.escalated;

    const createdDate = fmtDate(item.createdAt);
    const matchesFrom = !dateFromValue || createdDate >= dateFromValue;
    const matchesTo = !dateToValue || createdDate <= dateToValue;

    return matchesState && matchesResponsible && matchesPriority && matchesEscalated && matchesFrom && matchesTo;
  });

  renderDashboard(filtered);
}

function renderDashboard(cases) {
  const dashboardContent = document.getElementById("dashboardContent");
  if (!dashboardContent) return;

  dashboardContent.hidden = false;

  const active = cases.filter((item) => !item.closed);
  const total = cases.length;
  const closed = cases.length - active.length;

  const averageDays = active.length
    ? Math.round(active.reduce((sum, item) => sum + Number(item.ageDays || 0), 0) / active.length)
    : 0;

  const totalChanges = cases.reduce((sum, item) => sum + Number(item.totalChanges || 0), 0);

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiActive").textContent = active.length;
  document.getElementById("kpiClosed").textContent = closed;
  document.getElementById("kpiAvgDays").textContent = averageDays;
  document.getElementById("kpiChanges").textContent = totalChanges;

  renderEstadoChart(cases);
  renderResponsibleChart(cases);
  renderMovementChart(cases);
  renderTable(cases);
}

function renderEstadoChart(cases) {
  const counts = {};
  cases.forEach((item) => {
    counts[item.currentState || "Sin estado"] = (counts[item.currentState || "Sin estado"] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const data = Object.values(counts);

  createOrUpdateChart("chartEstado", {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: state.chartPalette.slice(0, labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right" }
      }
    }
  });
}

function renderResponsibleChart(cases) {
  const responsableMap = {};
  cases.forEach((item) => {
    if (!responsableMap[item.responsible]) {
      responsableMap[item.responsible] = { active: 0, closed: 0 };
    }
    if (item.closed) responsableMap[item.responsible].closed += 1;
    else responsableMap[item.responsible].active += 1;
  });

  const labels = Object.keys(responsableMap);
  const activeData = labels.map((key) => responsableMap[key].active);
  const closedData = labels.map((key) => responsableMap[key].closed);

  createOrUpdateChart("chartResponsable", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Activos", data: activeData, backgroundColor: state.chartPalette[0] },
        { label: "Cerrados", data: closedData, backgroundColor: state.chartPalette[2] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function renderMovementChart(cases) {
  const groups = {};
  cases.forEach((item) => {
    const key = item.lastUpdatedAt ? fmtDate(item.lastUpdatedAt) : "";
    if (!key) return;
    groups[key] = (groups[key] || 0) + 1;
  });

  const labels = Object.keys(groups).sort();
  const data = labels.map((label) => groups[label]);

  createOrUpdateChart("chartMovimientos", {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Casos revisados",
        data,
        borderColor: state.chartPalette[3],
        backgroundColor: "rgba(220, 38, 38, 0.15)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function createOrUpdateChart(chartId, config) {
  if (!document.getElementById(chartId)) return;

  if (state.charts[chartId]) {
    state.charts[chartId].destroy();
  }

  state.charts[chartId] = new Chart(document.getElementById(chartId), config);
}

function renderTable(cases) {
  const table = document.getElementById("tableCases");
  if (!table) return;

  if (!cases.length) {
    table.innerHTML = '<tr><td colspan="12" class="empty-state">No hay registros para mostrar con los filtros actuales.</td></tr>';
    return;
  }

  const rows = cases
    .slice()
    .sort((a, b) => Number(b.ageDays || 0) - Number(a.ageDays || 0))
    .map((item) => {
      const statusClass = item.closed ? "success" : item.ageDays >= 30 ? "danger" : item.ageDays >= 15 ? "warning" : "success";
      const priorityBadge = getPriorityBadge(item.priority);

      return `
        <tr>
          <td>${escapeHtml(item.caseId)}</td>
          <td>${escapeHtml(item.summary)}</td>
          <td>${escapeHtml(item.responsible)}</td>
          <td><span class="badge ${priorityBadge.className}">${escapeHtml(priorityBadge.label)}</span></td>
          <td>${fmtDate(item.createdAt)}</td>
          <td>${escapeHtml(item.initialState)}</td>
          <td><span class="badge ${statusClass}">${escapeHtml(item.currentState || "Sin estado")}</span></td>
          <td>${fmtDate(item.lastUpdatedAt)}</td>
          <td>${item.ageDays}</td>
          <td>${item.totalChanges}</td>
          <td>${escapeHtml(item.ageText || "")}</td>
          <td><a class="secondary small" href="detail.html?caseId=${encodeURIComponent(item.caseId)}">Ver trazabilidad</a></td>
        </tr>
      `;
    })
    .join("");

  table.innerHTML = rows;
}

function exportCurrentCsv() {
  const rows = state.cases;
  const headers = ["Id JIRA", "Resumen", "Responsable", "Prioridad", "Fecha creación", "Estado inicial", "Estado actual", "Última revisión", "Días estado actual", "Cambios", "Antigüedad"];

  const csvRows = [headers.join(",")].concat(
    rows.map((item) => [
      item.caseId,
      item.summary,
      item.responsible,
      item.priority || "Sin prioridad",
      fmtDate(item.createdAt),
      item.initialState,
      item.currentState,
      fmtDate(item.lastUpdatedAt),
      item.ageDays,
      item.totalChanges,
      item.ageText
    ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
  );

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reporte-casos-jira.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function saveCurrentCasesToFirebase() {
  if (!state.cases.length) {
    setStatus("No hay casos cargados todavía.", "error");
    return;
  }

  const result = await window.JiraFirebase?.saveCasesToFirebase?.(state.cases);

  if (result && result.saved) {
    setStatus(`Se guardaron ${result.total} casos en Firebase.`, "success");
  } else {
    setStatus("No se pudo guardar en Firebase. Configura tus credenciales en firebase.js.", "error");
  }
}

function initHistoryPage() {
  const listEl = document.getElementById("historyList");
  const filterState = document.getElementById("historyFilterState");
  const filterResponsible = document.getElementById("historyFilterResponsible");
  const filterPriority = document.getElementById("historyFilterPriority");
  const filterDateFrom = document.getElementById("historyDateFrom");
  const filterDateTo = document.getElementById("historyDateTo");
  const filterEscalated = document.getElementById("historyEscalatedOnly");

  async function loadHistory() {
    const items = await window.JiraFirebase?.loadCasesFromFirebase?.({
      state: filterState.value,
      responsible: filterResponsible.value,
      priority: filterPriority.value,
      escalatedOnly: filterEscalated.value === "escalados"
    }) || loadCasesFromStorage();

    const filtered = items.filter((item) => {
      if (filterState.value && item.currentState !== filterState.value) return false;
      if (filterResponsible.value && item.responsible !== filterResponsible.value) return false;
      if (filterPriority.value && normalizeText(item.priority || "Sin prioridad") !== normalizeText(filterPriority.value)) return false;
      if (filterDateFrom.value && fmtDate(new Date(item.lastUpdatedAt || item.createdAt)) < filterDateFrom.value) return false;
      if (filterDateTo.value && fmtDate(new Date(item.lastUpdatedAt || item.createdAt)) > filterDateTo.value) return false;
      if (filterEscalated.value === "escalados" && !item.escalated) return false;
      if (filterEscalated.value === "no-escalados" && item.escalated) return false;
      return true;
    });

    if (!listEl) return;

    if (!filtered.length) {
      listEl.innerHTML = '<div class="empty-state">No hay registros históricos con los filtros actuales.</div>';
      return;
    }

    listEl.innerHTML = filtered
      .map((item) => `
        <article class="history-item">
          <div class="history-topline">
            <strong>${escapeHtml(item.caseId)}</strong>
            <span class="badge ${item.escalated ? "danger" : "success"}">${item.escalated ? "Escalado" : "Normal"}</span>
          </div>
          <p>${escapeHtml(item.summary || "Sin resumen")}</p>
          <div class="history-meta">
            <span>Responsable: ${escapeHtml(item.responsible)}</span>
            <span>Estado: ${escapeHtml(item.currentState)}</span>
            <span>Prioridad: ${escapeHtml(item.priority || "Sin prioridad")}</span>
            <span>Última act.: ${fmtDate(new Date(item.lastUpdatedAt || item.createdAt))}</span>
          </div>
          <div class="history-actions">
            <a class="secondary small" href="detail.html?caseId=${encodeURIComponent(item.caseId)}">Ver trazabilidad</a>
          </div>
        </article>
      `)
      .join("");
  }

  [filterState, filterResponsible, filterPriority, filterDateFrom, filterDateTo, filterEscalated].forEach((element) => {
    element?.addEventListener("change", loadHistory);
  });

  loadHistory();
}

window.JiraDashboard = window.JiraDashboard || {};
window.JiraDashboard.buildCasesFromRows = buildCasesFromRows;
window.JiraDashboard.renderDashboard = renderDashboard;
window.JiraDashboard.initHistoryPage = initHistoryPage;
window.JiraDashboard.getCaseById = getCaseById;
window.JiraDashboard.persistCases = persistCases;
window.JiraDashboard.loadCasesFromStorage = loadCasesFromStorage;

document.addEventListener("DOMContentLoaded", () => {
  bindUi();
  window.JiraFirebase?.init?.();

  const storedCases = loadCasesFromStorage();
  if (storedCases.length) {
    state.cases = storedCases;
    renderDashboard(storedCases);
    populateDropdowns(storedCases);
  }

  if (document.body.dataset.page === "history") {
    initHistoryPage();
  }

  if (document.body.dataset.page === "detail" && window.initDetailPage) {
    window.initDetailPage();
  }
});
