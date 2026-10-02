// Aísla la integración con Firebase para no añadir variables temporales al ámbito global.
(function () {
  // Credenciales del proyecto; deben completarse para habilitar la conexión real.
  const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };

  // Conserva la API global si ya existe y centraliza el estado de la conexión.
  window.JiraFirebase = window.JiraFirebase || {};

  const state = {
    db: null,
    storage: null,
    initialized: false,
    mockMode: false
  };

  // Comprueba que las credenciales obligatorias estén presentes antes de iniciar Firebase.
  function isConfigReady() {
    return Boolean(
      firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.storageBucket &&
      firebaseConfig.appId
    );
  }

  // Inicializa Firestore y Storage una sola vez, o activa el modo local de pruebas.
  function initFirebase() {
    if (state.initialized) return true;

    if (!window.firebase) {
      console.warn("Firebase no está cargado. Revisa los scripts de Firebase en el HTML.");
      state.mockMode = true;
      state.initialized = true;
      return false;
    }

    if (!isConfigReady()) {
      console.warn("Firebase no está configurado. Se activará el modo mock para pruebas locales.");
      state.mockMode = true;
      state.initialized = true;
      return false;
    }

    try {
      firebase.initializeApp(firebaseConfig);
      state.db = firebase.firestore();
      state.storage = firebase.storage();
      state.initialized = true;
      state.mockMode = false;
      console.log("Firebase inicializado correctamente.");
      return true;
    } catch (error) {
      console.error("Error al inicializar Firebase:", error);
      state.mockMode = true;
      state.initialized = true;
      return false;
    }
  }

  // Completa campos ausentes y asegura tipos estables al recibir un caso de Firestore.
  function normalizeCaseRecord(item = {}) {
    return {
      ...item,
      caseId: String(item.caseId || ""),
      summary: item.summary || "Sin resumen",
      responsible: item.responsible || "Sin asignar",
      priority: item.priority || "Sin prioridad",
      escalated: Boolean(item.escalated),
      currentState: item.currentState || "Sin estado",
      history: Array.isArray(item.history) ? item.history : []
    };
  }

  // Sube el Excel a Storage; el modo mock devuelve metadatos de prueba sin conexión.
  async function uploadExcelToStorage(file) {
    if (state.mockMode || !state.storage) {
      return { uploadId: "mock-upload", url: "" };
    }

    // Usa una ruta única para reducir colisiones entre archivos con el mismo nombre.
    const storagePath = `uploads/${Date.now()}-${file.name}`;
    const ref = state.storage.ref(storagePath);
    await ref.put(file);
    const url = await ref.getDownloadURL();

    return { uploadId: storagePath, url };
  }

  // Registra en Firestore el nombre, número de filas y ubicación del archivo cargado.
  async function saveUploadRecord(fileName, rowCount, uploadId, url) {
    if (state.mockMode || !state.db) {
      return null;
    }

    const doc = await state.db.collection("uploads").add({
      fileName,
      rowCount,
      uploadId,
      url,
      uploadedAt: new Date().toISOString(),
      status: "processed"
    });

    return doc.id;
  }

  // Guarda cada caso y sus eventos de historial en colecciones de Firestore.
  async function saveCasesToFirebase(cases) {
    if (state.mockMode || !state.db) {
      console.warn("No se guardó en Firebase porque el proyecto está en modo mock. Configura firebaseConfig.");
      return { saved: false };
    }

    const batch = [];

    // Prepara las escrituras del caso y sus cambios antes de ejecutarlas en paralelo.
    for (const item of cases) {
      const docRef = state.db.collection("cases").doc(item.caseId);
      const baseData = {
        caseId: item.caseId,
        summary: item.summary,
        responsible: item.responsible,
        priority: item.priority || "Sin prioridad",
        createdAt: item.createdAt,
        initialState: item.initialState,
        currentState: item.currentState,
        lastUpdatedAt: item.lastUpdatedAt,
        ageDays: item.ageDays,
        escalated: Boolean(item.escalated),
        closed: Boolean(item.closed),
        updatedAt: new Date().toISOString()
      };

      batch.push(docRef.set(baseData));

      for (const historyEntry of item.history || []) {
        const historyRef = docRef.collection("history").doc(`${Date.now()}-${Math.random().toString(16).slice(2)}`);
        batch.push(historyRef.set({
          ...historyEntry,
          date: historyEntry.date || new Date().toISOString()
        }));
      }
    }

    await Promise.all(batch);
    return { saved: true, total: cases.length };
  }

  // Consulta casos en Firestore, aplica filtros disponibles e incorpora su historial.
  async function loadCasesFromFirebase(filters = {}) {
    if (state.mockMode || !state.db) {
      return [];
    }

    // Construye la consulta de forma incremental según los filtros recibidos.
    let queryRef = state.db.collection("cases");

    if (filters.responsible) {
      queryRef = queryRef.where("responsible", "==", filters.responsible);
    }

    if (filters.state) {
      queryRef = queryRef.where("currentState", "==", filters.state);
    }

    if (filters.priority) {
      queryRef = queryRef.where("priority", "==", filters.priority);
    }

    if (filters.escalatedOnly) {
      queryRef = queryRef.where("escalated", "==", true);
    }

    const snapshot = await queryRef.orderBy("lastUpdatedAt", "desc").get();
    const items = [];

    for (const doc of snapshot.docs) {
      const data = normalizeCaseRecord(doc.data());
      const historySnapshot = await doc.ref.collection("history").orderBy("date", "asc").get();
      items.push({
        ...data,
        history: historySnapshot.docs.map((item) => item.data())
      });
    }

    return items;
  }

  // Recupera un caso y sus cambios por identificador, con respaldo en modo local.
  async function loadCaseById(caseId) {
    if (!caseId) return null;

    if (state.mockMode || !state.db) {
      const stored = JSON.parse(localStorage.getItem("jira-dashboard-cases") || "[]");
      return stored.find((item) => String(item.caseId) === String(caseId)) || null;
    }

    const doc = await state.db.collection("cases").doc(caseId).get();
    if (!doc.exists) return null;

    const data = normalizeCaseRecord(doc.data());
    const historySnapshot = await doc.ref.collection("history").orderBy("date", "asc").get();
    data.history = historySnapshot.docs.map((item) => item.data());
    return data;
  }

  // Publica las operaciones que consumen las vistas y servicios del dashboard.
  window.JiraFirebase.init = initFirebase;
  window.JiraFirebase.uploadExcelToStorage = uploadExcelToStorage;
  window.JiraFirebase.saveUploadRecord = saveUploadRecord;
  window.JiraFirebase.saveCasesToFirebase = saveCasesToFirebase;
  window.JiraFirebase.loadCasesFromFirebase = loadCasesFromFirebase;
  window.JiraFirebase.loadCaseById = loadCaseById;
})();
