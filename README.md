# Dashboard Jira + trazabilidad

Este proyecto separa la vista del dashboard y la vista de historial para facilitar la trazabilidad de casos Jira.

## Estructura

- `index.html`: dashboard principal
- `history.html`: historial y filtros
- `styles.css`: estilos compartidos
- `firebase.js`: inicialización y acceso a Firebase
- `app.js`: lógica de carga de Excel, filtros y renderizado

## Requisitos

1. Configurar `firebaseConfig` dentro de `firebase.js` con las credenciales reales de Firebase.
2. Abrir `index.html` en el navegador.
3. Cargar un archivo Excel con columnas como:
   - Id JIRA
   - Resumen
   - Responsable
   - Fecha de creación
   - Estado inicial
   - Fecha de actualización
   - Estado actual
   - Antigüedad

## Uso con Firebase

- `Guardar en Firebase` guarda los casos actuales en Firestore.
- `Ver historial` abre la vista de trazabilidad histórica.
- Los casos escalados pueden filtrarse desde la vista de historial.

## Sugerencia importante

Para un sistema real de trazabilidad, conviene crear una vista adicional `detail.html` para cada caso con su timeline completa. Este proyecto base te da la estructura inicial para hacerlo.
