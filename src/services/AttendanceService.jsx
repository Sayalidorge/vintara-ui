import config from "../config";

/**
 * Generic safe fetch wrapper - same pattern as LeaveService.jsx
 */
const safeFetch = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: config.getHeaders(),
    ...options,
  });

  const contentType = res.headers.get("content-type");

  if (!res.ok) {
    const errorText = await res.text();
    console.error("API Error:", errorText);
    let message = errorText;
    try {
      const parsed = JSON.parse(errorText);
      message = parsed.message || errorText;
    } catch {
      // not JSON - fall back to raw text
    }
    throw new Error(message || "API request failed");
  }

  if (!contentType || !contentType.includes("application/json")) {
    const text = await res.text();
    console.error("Non-JSON response:", text);
    throw new Error("Server did not return JSON");
  }

  return res.json();
};

/**
 * Check in - lat/lng may be null if geolocation was denied/unavailable;
 * check-in still succeeds either way, server falls back to IP matching.
 */
export const checkIn = async (latitude, longitude) => {
  return safeFetch(`${config.BASE_URL}/api/attendance/checkin`, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  });
};

export const checkOut = async (latitude, longitude) => {
  return safeFetch(`${config.BASE_URL}/api/attendance/checkout`, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  });
};

/**
 * Today's attendance record for the current user, or null if not checked in yet.
 */
export const getTodayStatus = async () => {
  return safeFetch(`${config.BASE_URL}/api/attendance/today`);
};

export const getAttendanceHistory = async (userId, year, month) => {
  return safeFetch(
    `${config.BASE_URL}/api/attendance/user/${userId}/month?year=${year}&month=${month}`
  );
};

/**
 * Admin/team view - everyone's attendance status for a given date (default today).
 */
export const getTeamAttendance = async (date) => {
  const url = date
    ? `${config.BASE_URL}/api/attendance/team?date=${date}`
    : `${config.BASE_URL}/api/attendance/team`;
  return safeFetch(url);
};

/**
 * "I forgot to check in" backfill request - date must be in the past,
 * requestedStatus is "PRESENT" or "WFH". Needs admin approval before it
 * shows up as the real attendance status for that day.
 */
export const submitCorrection = async (date, requestedStatus, reason) => {
  return safeFetch(`${config.BASE_URL}/api/attendance/correction`, {
    method: "POST",
    body: JSON.stringify({ date, requestedStatus, reason }),
  });
};

export const getMyCorrections = async (userId) => {
  return safeFetch(`${config.BASE_URL}/api/attendance/correction/user/${userId}`);
};

/**
 * Admin review queue - filters by status ("PENDING"/"APPROVED"/"REJECTED"), omit for all.
 */
export const getCorrections = async (status) => {
  const url = status
    ? `${config.BASE_URL}/api/attendance/correction/all?status=${status}`
    : `${config.BASE_URL}/api/attendance/correction/all`;
  return safeFetch(url);
};

export const approveCorrection = async (id) => {
  return safeFetch(`${config.BASE_URL}/api/attendance/correction/${id}/approve`, {
    method: "PUT",
  });
};

export const rejectCorrection = async (id) => {
  return safeFetch(`${config.BASE_URL}/api/attendance/correction/${id}/reject`, {
    method: "PUT",
  });
};
