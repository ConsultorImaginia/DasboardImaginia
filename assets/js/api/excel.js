window.ExcelAdapter = {
  parseWorkbook(workbook) {
    if (!workbook || !workbook.Sheets) return [];
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }
};
