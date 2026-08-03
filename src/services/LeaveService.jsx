import config from "../config";

/**
 * Generic safe fetch wrapper
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
    throw new Error(errorText || "API request failed");
  }

  if (!contentType || !contentType.includes("application/json")) {
    const text = await res.text();
    console.error("Non-JSON response:", text);
    throw new Error("Server did not return JSON");
  }

  return res.json();
};

/**
 * Get Leave Balance
 */
export const getLeaveBalance = async (userId) => {
  return safeFetch(
    `${config.BASE_URL}/api/leave/user/${userId}/balance`
  );
};

/**
 * Get Leave Requests for User
 */
export const getLeaveRequests = async (userId) => {
  return safeFetch(
    `${config.BASE_URL}/api/leave/user/${userId}`
  );
};

/**
 * Get Leave Requests for Month
 */
export const getLeaveRequestsForMonth = async (userId, year, month) => {
  const url = userId
    ? `${config.BASE_URL}/api/leave/user/${userId}/month?year=${year}&month=${month}`
    : `${config.BASE_URL}/api/leave/all/month?year=${year}&month=${month}`;

  return safeFetch(url); // safeFetch will include JWT headers automatically
};

/**
 * Apply Leave
 */
export const applyLeaveRequest = async (userId, form) => {
  return safeFetch(`${config.BASE_URL}/api/leave/apply`, {
    method: "POST",
    body: JSON.stringify({
      userId,
      startDate: form.startDate,
      endDate: form.endDate,
      type: form.type,
      reason: form.reason,
    }),
  });
};

/**
 * Fetch all users with role USER (for Admin dropdown)
 */
export const getUsers = async () => {
  const url = `${config.BASE_URL}/users/fetch-users`;
  const res = await fetch(url, { headers: config.getHeaders() });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Failed to fetch users:", errorText);
    throw new Error(errorText || "API request failed");
  }

  return res.json(); // returns array of { id, name, userId }
};
/**
 * Get All Leave Requests (Admin)
 */
export const getAllLeaveRequests = async (filters = {}) => {
  let url = `${config.BASE_URL}/api/leave/all-user-leaves`; // <-- new endpoint

  // Only append query params if admin provides them
  const queryParams = new URLSearchParams();

  if (filters.status) {
    queryParams.append("status", filters.status);
  }

  if (filters.userId) {
    queryParams.append("userId", filters.userId);
  }

  if ([...queryParams].length > 0) {
    url += `?${queryParams.toString()}`;
  }

  return safeFetch(url);
};

/**
 * Approve Leave
 */
export const approveLeave = async (id) => {
  return safeFetch(
    `${config.BASE_URL}/api/leave/${id}/approve`,
    { method: "PUT" }
  );
};

/**
 * Reject Leave
 */
export const rejectLeave = async (id) => {
  return safeFetch(
    `${config.BASE_URL}/api/leave/${id}/reject`,
    { method: "PUT" }
  );
};