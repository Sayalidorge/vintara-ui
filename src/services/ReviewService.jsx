import config from "../config";

/**
 * Generic safe fetch wrapper - mirrors LeaveService.jsx's convention.
 */
const safeFetch = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: config.getHeaders(),
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("API Error:", errorText);
    let message = errorText;
    try {
      const parsed = JSON.parse(errorText);
      message = parsed.message || parsed.error || errorText;
    } catch {
      // not JSON - fall back to raw text
    }
    throw new Error(message || "API request failed");
  }

  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return null;
  }
  return res.json();
};

/** Paginated, filterable review list. filters: {resortId, ratingMin, ratingMax, status, fromDate, toDate} (dates as yyyy-MM-dd) */
export const getReviews = async (filters = {}, page = 0, size = 20) => {
  const params = new URLSearchParams({ page, size });
  if (filters.resortId) params.append("resortId", filters.resortId);
  if (filters.ratingMin) params.append("ratingMin", filters.ratingMin);
  if (filters.ratingMax) params.append("ratingMax", filters.ratingMax);
  if (filters.status) params.append("status", filters.status);
  if (filters.fromDate) params.append("fromDate", filters.fromDate);
  if (filters.toDate) params.append("toDate", filters.toDate);
  return safeFetch(`${config.BASE_URL}/api/reviews/manage?${params.toString()}`);
};

export const approveReply = async (id, editedText) => {
  return safeFetch(`${config.BASE_URL}/api/reviews/manage/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ editedText }),
  });
};

export const discardDraft = async (id, reason) => {
  return safeFetch(`${config.BASE_URL}/api/reviews/manage/${id}/discard`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

export const regenerateDraft = async (id) => {
  return safeFetch(`${config.BASE_URL}/api/reviews/manage/${id}/regenerate`, {
    method: "POST",
  });
};

export const triggerSync = async () => {
  return safeFetch(`${config.BASE_URL}/api/reviews/manage/sync`, { method: "POST" });
};

export const getTemplates = async () => {
  return safeFetch(`${config.BASE_URL}/api/reviews/manage/templates`);
};

export const saveTemplate = async (template) => {
  const isEdit = Boolean(template.id);
  const url = isEdit
    ? `${config.BASE_URL}/api/reviews/manage/templates/${template.id}`
    : `${config.BASE_URL}/api/reviews/manage/templates`;
  return safeFetch(url, {
    method: isEdit ? "PUT" : "POST",
    body: JSON.stringify({ ratingBand: "FOUR_TO_FIVE", text: template.text, active: template.active }),
  });
};

export const deactivateTemplate = async (id) => {
  return safeFetch(`${config.BASE_URL}/api/reviews/manage/templates/${id}`, { method: "DELETE" });
};

export const setResortGbpLocation = async (resortId, gbpLocationId) => {
  const params = new URLSearchParams();
  if (gbpLocationId) params.append("gbpLocationId", gbpLocationId);
  return safeFetch(`${config.BASE_URL}/api/resorts/${resortId}/gbp-location?${params.toString()}`, {
    method: "PUT",
  });
};
