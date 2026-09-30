import config from "../config";

/**
 * Generic safe fetch wrapper - mirrors ReviewService.jsx's convention.
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

// SUPER_ADMIN only (see ResortController.updateGuestFacingInfo) - the
// WhatsApp chatbot's FAQ-grounding text for a resort.
export const setResortGuestFacingInfo = async (resortId, guestFacingInfo) => {
  return safeFetch(`${config.BASE_URL}/api/resorts/${resortId}/guest-facing-info`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guestFacingInfo }),
  });
};

// Seasonal (date-range) rate overrides on a room category - see
// SeasonalRate/SeasonalRateController on the backend.
export const fetchSeasonalRates = async (roomCategoryId) => {
  return safeFetch(`${config.BASE_URL}/api/resorts/room-categories/${roomCategoryId}/seasonal-rates`);
};

export const addSeasonalRate = async (roomCategoryId, { fromDate, toDate, nightlyRate }) => {
  return safeFetch(`${config.BASE_URL}/api/resorts/room-categories/${roomCategoryId}/seasonal-rates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromDate, toDate, nightlyRate }),
  });
};

export const deleteSeasonalRate = async (roomCategoryId, rateId) => {
  return safeFetch(`${config.BASE_URL}/api/resorts/room-categories/${roomCategoryId}/seasonal-rates/${rateId}`, {
    method: "DELETE",
  });
};
