// Publica el adaptador de lectura de hojas de cálculo para el resto de la aplicación.
window.ExcelAdapter = {
  // Convierte la primera hoja del libro en una lista de objetos JavaScript.
  parseWorkbook(workbook) {
    // Devuelve una lista vacía si el libro no contiene hojas utilizables.
    if (!workbook || !workbook.Sheets) return [];
    // Selecciona la primera hoja declarada en el archivo Excel.
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Convierte cada fila en un objeto y conserva vacías las celdas sin valor.
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }
};
