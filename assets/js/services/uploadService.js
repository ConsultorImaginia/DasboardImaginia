window.uploadService = {
  async uploadFile(file) {
    return { fileName: file?.name || "archivo" };
  }
};
