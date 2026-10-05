# Dashboard de casos Jira ImaginIA

Aplicación web estática para importar casos Jira desde Excel, consultar indicadores y dar seguimiento a cambios de estado. Los datos se procesan en el navegador; se pueden conservar en el almacenamiento local y, si se configura Firebase, guardar el archivo y los casos en la nube.

## Contenido

- [Funciones principales](#funciones-principales)
- [Requisitos y ejecución](#requisitos-y-ejecución)
- [Uso del dashboard](#uso-del-dashboard)
- [Formato del Excel](#formato-del-excel)
- [Cómo se calculan los días](#cómo-se-calculan-los-días)
- [Arquitectura y archivos](#arquitectura-y-archivos)
- [Modelo de datos](#modelo-de-datos)
- [Funciones JavaScript](#funciones-javascript)
- [Firebase](#firebase)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Solución de problemas](#solución-de-problemas)

## Funciones principales

- Importar archivos `.xlsx`, `.xls` y `.csv` desde el dashboard.
- Agrupar filas de una exportación por identificador Jira y mostrar el registro más reciente de cada caso.
- Consultar totales, casos activos y cerrados, promedio de días en el estado actual y cambios detectados.
- Filtrar el dashboard por estado, responsable, fechas y escalamiento.
- Ver una lista histórica y abrir el detalle de un caso con su cronología de cambios.
- Exportar la tabla actual como CSV e imprimir el dashboard desde el navegador.
- Conservar los casos en `localStorage` y ofrecer integración opcional con Firestore y Firebase Storage.

## Requisitos y ejecución

El proyecto no tiene un proceso de compilación ni un `package.json`: es HTML, CSS y JavaScript del lado del cliente. Las bibliotecas externas se cargan desde CDN, por lo que se requiere conexión a Internet para cargar SheetJS, Chart.js y el SDK de Firebase.

1. Abre la carpeta del proyecto en VS Code.
2. Sirve la carpeta con una extensión de servidor estático, por ejemplo Live Server.
3. Abre `index.html` desde ese servidor.
4. Selecciona **Cargar Excel** y elige el archivo que quieres analizar.

También puede abrirse `index.html` directamente en algunos navegadores, pero se recomienda un servidor HTTP local para evitar diferencias de seguridad y carga entre navegadores. Firebase es opcional para la consulta local, pero requiere configuración para guardar o consultar datos en la nube.

## Uso del dashboard

1. **Cargar Excel** abre el selector de archivos. La aplicación lee la primera hoja del libro y actualiza la tabla, los indicadores y los gráficos.
2. Los filtros reducen simultáneamente los indicadores, gráficos y filas de la tabla. El filtro de fechas compara la fecha de creación del caso.
3. **Ver historial** abre la lista de casos guardados y sus filtros. La fecha del historial se compara con la última revisión, o con la fecha de creación cuando no hay última revisión.
4. **Ver trazabilidad** abre `detail.html` para el caso seleccionado.
5. **Exportar CSV** descarga los casos que se cargaron, con sus campos y valores calculados.
6. **Imprimir PDF** abre el diálogo de impresión del navegador; desde allí se puede elegir una impresora PDF.
7. **Guardar en Firebase** intenta guardar los casos actuales en Firestore. El archivo Excel se sube a Storage automáticamente después de una importación correcta cuando Firebase está configurado.

Los casos también se guardan en el almacenamiento local del navegador bajo la clave `jira-dashboard-cases`. Estos datos pertenecen a ese navegador y perfil; no se sincronizan entre equipos salvo que se use Firebase.

## Formato del Excel

La primera fila de la primera hoja debe contener los encabezados. La aplicación normaliza mayúsculas, minúsculas y acentos, pero no elimina palabras, barras ni otros signos. Cada registro debe tener un identificador Jira no vacío para que se incluya.

La plantilla incluida contiene estos encabezados:

| Encabezado de la plantilla | Uso en el dashboard |
| --- | --- |
| `ID JIRA` | Identificador y clave para agrupar registros del mismo caso. Obligatorio. |
| `RESUMEN` | Descripción breve del caso. |
| `RESPONSABLE` | Persona responsable; si falta, se muestra “Sin asignar”. |
| `FECHA DE CREACIÓN` | Fecha de creación del caso. |
| `ESTADO INICIAL` | Estado de referencia para detectar transiciones. |
| `FECHA DE ACTUALIZACIÓN` | Fecha de la revisión del registro. Se usa para ordenar y calcular días en el estado actual. |
| `ESTADO ACTUAL` | Estado del caso en ese registro. |
| `ANTIGÜEDAD / DÍAS` | Resultado calculado en Excel. La plantilla lo guarda como una fórmula. |

### Compatibilidad del encabezado de antigüedad

El código actual busca la clave normalizada `ANTIGUEDAD` para llenar la columna “Antigüedad” de la tabla. La plantilla incluida usa `ANTIGÜEDAD / DÍAS`, que se normaliza como `ANTIGUEDAD / DIAS`; no es la misma clave. Por ello, el valor de la fórmula no se asigna a `ageText` y la celda “Antigüedad” de la aplicación queda vacía aunque Excel muestre un número. Para que aparezca sin cambiar el código, renombra el encabezado de la plantilla a `ANTIGÜEDAD`. Otra solución es ampliar el mapeo de encabezados en `buildCasesFromRows()`.

Los siguientes campos también se reconocen si están presentes: `PRIORIDAD`, `PRIORITY`, `SEVERIDAD`, `CRITICIDAD` o `NIVEL DE PRIORIDAD`; y `ESCALADO` para indicar explícitamente un escalamiento. La prioridad se puede deducir además de expresiones en el estado o resumen.

Las fechas pueden ser fechas de Excel, números seriales de Excel o textos de fecha que el navegador pueda interpretar. Conviene mantener fechas reales en las columnas de fecha, no texto ambiguo como `03/04/25` si no está definido si representa 3 de abril o 4 de marzo.

## Cómo se calculan los días

La tabla tiene dos conceptos diferentes:

- **Antigüedad** (`ageText`): se lee del valor de la columna de antigüedad del Excel. No se calcula en JavaScript; en la plantilla proviene de una fórmula como `=SI(D2="";"";HOY()-D2)`. SheetJS lee el resultado guardado de la fórmula, no ejecuta fórmulas de Excel. Abre y guarda el libro en Excel o en una aplicación compatible para actualizar los resultados de fórmula antes de importarlo.
- **Días en estado actual** (`ageDays`): se calcula desde la fecha de la última transición de estado registrada en `history` hasta hoy. Si no hay transiciones, se usa la fecha de creación de la primera fila del caso; si falta, la fecha de actualización de esa primera fila y, como último recurso, la fecha actual. El cálculo usa días calendario. Cuando no hay historial suficiente, la fecha de creación es solo una aproximación y no garantiza cuándo entró realmente al estado actual.

El indicador “Promedio días en estado actual” usa `ageDays` de los casos activos; no usa la columna de antigüedad calculada en Excel.

## Arquitectura y archivos

### Páginas

- `index.html`: entrada del dashboard, controles de filtros, indicadores, gráficos y tabla. Carga SheetJS, Chart.js, Firebase y `assets/js/main.js`.
- `history.html`: listado histórico y controles de filtro. Usa `assets/js/main.js` para cargar y mostrar los casos.
- `detail.html`: detalle individual del caso y cronología de cambios. Carga `assets/js/detail.js`.

### JavaScript ejecutado por las páginas

- `assets/js/main.js`: flujo principal del dashboard y del historial: importación, normalización, agrupación, cálculos, filtros, renderizado, exportación y persistencia local.
- `assets/js/detail.js`: lectura del identificador de la URL, búsqueda del caso y renderizado del detalle y la cronología.
- `assets/js/api/firebase.js`: inicialización y operaciones de Firestore y Storage. Lo cargan las tres páginas antes de sus controladores.

### Estilos y recursos

- `assets/css/styles.css`: estilos compartidos, colores, controles, tarjetas, filtros y estructura base.
- `assets/css/dashboard.css`: cuadrícula de indicadores, gráficos, tabla y detalle.
- `assets/css/history.css`: estilos específicos del historial.
- `assets/img/`: recursos gráficos de la interfaz, incluido el logotipo.

En `styles.css`, las propiedades CSS de `:root` centralizan los colores de fondo y panel (`--bg`, `--panel`, `--panel-alt`), bordes (`--line`), texto (`--text`, `--muted`), color principal (`--primary`, `--primary-soft`), estados (`--success`, `--warning`, `--danger`) y sombra (`--shadow`).

### Adaptadores y módulos auxiliares

- `assets/js/api/excel.js`: `ExcelAdapter.parseWorkbook(workbook)` convierte la primera hoja a objetos con SheetJS.
- `assets/js/api/storage.js`: `JiraStorage.save(key, value)` serializa y guarda JSON; `JiraStorage.load(key)` recupera el valor guardado.
- `assets/js/config.js`: `appConfig` contiene `appName`, `firebaseProjectId` de ejemplo y `defaultLocale`. Firebase no toma sus credenciales de aquí.
- `assets/js/services/caseService.js`: `caseService.normalizeCase(item)` devuelve el caso recibido o un objeto vacío.
- `assets/js/services/historyService.js`: `historyService.fetchHistory()` es una implementación inicial que devuelve una lista vacía.
- `assets/js/services/uploadService.js`: `uploadService.uploadFile(file)` solo devuelve el nombre del archivo; no sube datos.
- `assets/js/state/appState.js`: estado de ejemplo `appState` con `cases`, `charts` y los filtros `state`, `responsible` y `escalated`. El estado activo está definido en `main.js`.
- `assets/js/ui/charts.js`, `dashboard.js`, `filters.js` y `table.js`: `chartsUI.render()`, `dashboardUI.render()`, `filtersUI.init()` y `tableUI.render()` solo devuelven `true`; los componentes reales se implementan en `main.js`.
- `assets/js/utils.js`: `dashboardUtils.isObject(value)` comprueba si el valor es un objeto no nulo y `dashboardUtils.safeText(value)` lo convierte a texto. No está incluido por las páginas actuales.

### Configuración de Firebase

- `firebase.json`: señala los archivos de reglas e índices de Firestore; no configura Hosting.
- `firestore.rules`: reglas de lectura y escritura para Firestore.
- `firestore.indexes.json`: actualmente no declara índices adicionales.
- `plantilla-casos-jira.xlsx`: libro de plantilla incluido en el proyecto.

## Modelo de datos

Después de leer una fila, `buildCasesFromRows()` normaliza estos campos y agrupa las filas por `caseId`:

| Propiedad | Significado |
| --- | --- |
| `caseId` | Identificador Jira convertido a texto. |
| `summary` | Resumen del caso. |
| `responsible` | Responsable, o “Sin asignar”. |
| `createdAt` | Fecha de creación convertida a `Date`. |
| `updatedAt` | Fecha de actualización convertida a `Date`. |
| `initialState` | Estado inicial del registro. |
| `currentState` | Estado actual del registro más reciente. |
| `priority` | Prioridad normalizada, o “Sin prioridad”. |
| `ageText` | Valor de antigüedad leído desde Excel. |
| `escalated` | Indicador explícito de escalamiento o coincidencia con términos críticos. |

El caso agrupado añade estos campos derivados:

| Propiedad | Significado |
| --- | --- |
| `lastUpdatedAt` | Última fecha de actualización o, en su defecto, fecha de creación. |
| `ageDays` | Días calendario desde la última transición de estado detectada; si no hay transición, usa la primera fecha disponible del caso como aproximación. |
| `closed` | Resultado de comparar el estado con palabras de cierre reconocidas. |
| `totalChanges` | Número de transiciones de estado detectadas entre las filas del caso. |
| `history` | Lista de transiciones con fecha, estado anterior/nuevo, responsable e identificador. |

Si un archivo tiene varias filas para el mismo `ID JIRA`, se ordenan por fecha de actualización (o creación). La fila más reciente aporta el estado y los datos visibles; los cambios de estado encontrados entre filas forman `history`.

## Funciones JavaScript

### `assets/js/main.js`

El objeto `state` mantiene las filas originales (`rawRows`), los casos procesados (`cases`), instancias de gráficos (`charts`), colores (`chartPalette`) y filtros (`currentFilters`). `CLOSED_PATTERN` reconoce términos de cierre en español e inglés.

Funciones de interfaz y conversión:

- `bindUi()`: conecta botones, selector de archivo y filtros con sus manejadores.
- `setStatus(message, type)`: muestra mensajes informativos, de éxito o error.
- `normalizeText(value)`: quita acentos y espacios exteriores y convierte a mayúsculas.
- `toDate(value)`: interpreta objetos `Date`, seriales de Excel y texto de fecha.
- `fmtDate(date)`: prepara fechas como `AAAA-MM-DD`.
- `daysBetween(dateA, dateB)`: calcula días completos no negativos.
- `normalizePriority(value)` y `getPriorityBadge(priority)`: normalizan prioridad y asignan una clase visual.
- `escapeHtml(value)`: escapa texto de origen externo antes de insertarlo en HTML.

Funciones de datos y renderizado:

- `persistCases(cases)` / `loadCasesFromStorage()`: escriben y leen casos en `localStorage`.
- `getCaseById(caseId)`: busca un caso en memoria y luego en el almacenamiento local.
- `handleExcelUpload(event)`: lee la primera hoja, procesa las filas, guarda los casos, actualiza la interfaz y registra la carga en Firebase si está disponible.
- `buildCasesFromRows(rows)`: normaliza encabezados y campos, agrupa filas por caso, detecta cambios y calcula las propiedades derivadas.
- `populateDropdowns(cases)`: crea opciones de estado, responsable y prioridad para los filtros.
- `applyFilters()`: aplica los filtros actuales y vuelve a dibujar el dashboard.
- `renderDashboard(cases)`: calcula indicadores y coordina gráficos y tabla.
- `renderEstadoChart(cases)`: crea el gráfico de casos por estado.
- `renderResponsibleChart(cases)`: compara casos activos y cerrados por responsable.
- `renderMovementChart(cases)`: muestra casos revisados por fecha.
- `createOrUpdateChart(chartId, config)`: destruye el gráfico anterior con el mismo identificador y crea el nuevo.
- `renderTable(cases)`: ordena y dibuja la tabla de casos.
- `exportCurrentCsv()`: descarga los casos cargados como CSV.
- `saveCurrentCasesToFirebase()`: solicita guardar los casos en Firestore y muestra el resultado.
- `initHistoryPage()`: configura la vista histórica. Su función interna `loadHistory()` consulta casos, aplica filtros y renderiza la lista.

Al final del archivo se publican métodos en `window.JiraDashboard` para compartir algunas funciones y, en `DOMContentLoaded`, se conectan eventos, se inicia Firebase, se restauran casos locales y se selecciona el inicializador de página.

### `assets/js/detail.js`

- `readStoredCases()`: lee casos locales de forma segura.
- `initDetailPage()`: obtiene `caseId` de la URL, localiza el caso y coordina el renderizado.
- `renderDetailCard(caseRecord, element)`: presenta los datos principales del caso.
- `renderTimeline(history, element)`: muestra transiciones de estado o un mensaje vacío.
- `formatDate(value)`: convierte fechas a formato local español cuando son válidas.
- `escapeHtml(value)`: protege el HTML generado con datos del caso.

### `assets/js/api/firebase.js`

- `isConfigReady()`: comprueba que se hayan indicado credenciales.
- `initFirebase()`: inicializa Firebase o activa `mockMode` para uso local sin nube.
- El estado interno de Firebase conserva `db` (Firestore), `storage` (Firebase Storage), `initialized` (inicialización realizada) y `mockMode` (operaciones simuladas/locales).
- `normalizeCaseRecord(item)`: completa valores predeterminados al leer un caso.
- `uploadExcelToStorage(file)`: sube el archivo a `uploads/` y devuelve su ruta y URL; en modo local devuelve metadatos simulados.
- `saveUploadRecord(...)`: registra el nombre, filas y ubicación del archivo en `uploads` de Firestore.
- `saveCasesToFirebase(cases)`: guarda documentos de caso y subcolecciones de historial.
- `loadCasesFromFirebase(filters)`: consulta casos, aplica filtros compatibles y recupera los eventos de historial.
- `loadCaseById(caseId)`: recupera un caso y su historial por identificador.

## Firebase

### Configuración

Las credenciales usadas por la integración se definen dentro de `assets/js/api/firebase.js`, en el objeto `firebaseConfig`. Los valores del repositorio están vacíos; hay que completarlos con la configuración del proyecto Firebase. El `firebaseProjectId` de `assets/js/config.js` no configura esta conexión y actualmente no se consume.

Las páginas cargan Firebase SDK 10.12.2 desde Google CDN. La aplicación usa las APIs compat de Firestore y Storage.

### Datos guardados

- `cases/{caseId}`: resumen, responsable, prioridad, fechas, estados, `ageDays`, escalamiento y estado de cierre.
- `cases/{caseId}/history/{historyId}`: transiciones de estado detectadas.
- `uploads/{uploadId}`: nombre, número de filas, ruta/URL del Excel y fecha de carga.
- Firebase Storage: archivos Excel dentro de `uploads/` con un prefijo temporal para reducir colisiones de nombre.

El guardado de casos en Firestore no incluye actualmente `ageText`, las filas originales del Excel ni todos los campos que se mantienen en memoria. La vista local conserva más campos mientras existan en `localStorage`.

### Seguridad

Las reglas actuales permiten lectura pública de `cases` y de su subcolección `history`, pero requieren autenticación para crear, modificar o borrar esos documentos. `uploads` requiere autenticación tanto para leer como para escribir. La interfaz no implementa un flujo de inicio de sesión; por tanto, con estas reglas, las operaciones de escritura no funcionarán hasta configurar autenticación y permitir que el cliente inicie sesión.

No publiques datos sensibles mientras las reglas de lectura de casos sean públicas. Ajusta `firestore.rules` al modelo de usuarios y permisos requerido antes de desplegar con datos reales.

## Limitaciones conocidas

- La plantilla incluida usa `ANTIGÜEDAD / DÍAS`, pero la lectura actual busca `ANTIGUEDAD`; ese campo se mostrará vacío hasta que se renombre el encabezado o se amplíe el mapeo en `buildCasesFromRows()`.
- SheetJS no ejecuta las fórmulas de Excel. La importación depende del resultado calculado que Excel haya guardado en el libro.
- `ageDays` representa días desde la última transición de estado registrada. Si la plantilla no conserva filas suficientes para detectar una transición, se aproxima con la fecha de creación; no es necesariamente igual a la antigüedad total de la fórmula de Excel.
- En el dashboard, las etiquetas visibles del filtro “Escalado” están intercambiadas respecto de los valores que procesa el código. La opción que dice “Solo escalados” filtra los no escalados, y viceversa.
- En `history.html`, el control de prioridad está comentado, pero `initHistoryPage()` accede a ese elemento sin comprobar si existe. La carga del historial puede detenerse con un error hasta que se restaure el control o se haga opcional en el JavaScript.
- El proyecto no incluye pruebas automatizadas ni configuración de build. La validación de cambios se realiza manualmente en el navegador.
- Los módulos auxiliares listados arriba son esqueletos o utilidades independientes; no sustituyen las implementaciones activas de `main.js` y `detail.js`.
- Si Firebase está configurado, la importación intenta subir el archivo. Revisa permisos, cuota y reglas de Storage/Firestore al probar esa integración.

## Solución de problemas

| Síntoma | Qué revisar |
| --- | --- |
| No aparecen casos | Comprueba que estás importando la hoja correcta, que `ID JIRA` está en la primera fila y que sus valores no están vacíos. |
| La columna “Antigüedad” queda vacía | Cambia el encabezado de la plantilla de `ANTIGÜEDAD / DÍAS` a `ANTIGÜEDAD`, o agrega ese alias al mapeo del importador. Guarda el libro para actualizar los resultados de las fórmulas antes de volver a cargarlo. |
| Las fechas aparecen vacías o incorrectas | Verifica que las celdas sean fechas reconocidas por Excel o textos con formato no ambiguo. Revisa también que los encabezados coincidan con `FECHA DE CREACIÓN` y `FECHA DE ACTUALIZACIÓN`. |
| No se guardan casos en Firebase | Verifica `firebaseConfig`, carga de los SDK, reglas de Firestore y autenticación. Las reglas actuales no permiten escrituras anónimas. |
| El historial aparece vacío | Comprueba si los casos se guardaron en Firebase o en el mismo navegador. El detalle histórico se genera a partir de cambios de estado entre varias filas con el mismo `ID JIRA`. |
| Los gráficos no aparecen | Comprueba la conexión a Internet y que Chart.js se haya cargado desde el CDN. |
