// Escapes a value for CSV per RFC 4180 (quotes fields containing commas,
// quotes, or newlines; doubles any embedded quotes).
const escapeCsvValue = (value) => {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// Triggers a browser download for an already-built Blob (e.g. a PDF fetched
// from the backend) via a temporary <a download>. Shared tail of downloadCsv
// below — pulled out so other blob downloads (GST invoice PDFs, etc.) don't
// have to duplicate it.
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Builds a CSV from `rows` using `columns` ([{ key, header }]) and triggers
// a browser download. No library needed — a Blob + temporary <a> covers it.
export const downloadCsv = (filename, rows, columns) => {
  if (!rows || rows.length === 0) {
    alert("No data to export");
    return;
  }

  const header = columns.map((c) => escapeCsvValue(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(","))
    .join("\n");
  const csv = `${header}\n${body}`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
};
