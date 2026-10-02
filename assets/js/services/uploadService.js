// Agrupa las operaciones relacionadas con archivos cargados desde la interfaz.
window.uploadService = {
  // Devuelve el nombre del archivo como metadato básico de la carga.
  async uploadFile(file) {
    return { fileName: file?.name || "archivo" };
  }
};
