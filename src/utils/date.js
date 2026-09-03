// Formats a Date object as a local yyyy-MM-dd string.
// Date.prototype.toISOString() converts to UTC first, which rolls a
// locally-picked midnight date back to the previous calendar day for any
// timezone ahead of UTC (e.g. IST, UTC+5:30) — this avoids that shift.
export const toLocalDateStr = (date) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
