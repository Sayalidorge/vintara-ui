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

// Inverse of toLocalDateStr - parses a yyyy-MM-dd string into a Date set to
// LOCAL midnight on that day. Needed wherever a component stores the date as
// a yyyy-MM-dd string (for API calls/filenames) but a UI control like
// react-datepicker needs an actual Date object for its `selected` prop.
// Deliberately builds the Date from the individual y/m/d components rather
// than `new Date(str)`, which reads a bare yyyy-MM-dd as UTC midnight -
// harmless for IST (always rolls forward into the same local day) but wrong
// for any timezone behind UTC, where it rolls back a day.
export const parseLocalDateStr = (dateStr) => {
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd);
};

// Formats a date for display as dd/MM/yyyy. Accepts a yyyy-MM-dd string (the
// shape dates come back from the backend as) or a Date object. String inputs
// are rearranged directly rather than parsed via `new Date()`, which would
// read a bare yyyy-MM-dd as UTC midnight and roll it back a day in any
// timezone ahead of UTC.
export const formatDateDMY = (date) => {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [yyyy, mm, dd] = date.slice(0, 10).split("-");
    return `${dd}/${mm}/${yyyy}`;
  }
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
