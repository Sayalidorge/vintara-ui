import config from "../config";

/**
 * Generic safe fetch wrapper - same pattern as LeaveService.jsx/AttendanceService.jsx
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

/** Admin-only. effectiveFrom is optional (YYYY-MM-DD) - defaults to today server-side if omitted. */
export const setSalary = async (userId, monthlySalary, healthInsuranceCost, professionalTax, permanentWfh, effectiveFrom) => {
  return safeFetch(`${config.BASE_URL}/api/salary/set`, {
    method: "POST",
    body: JSON.stringify({ userId, monthlySalary, healthInsuranceCost, professionalTax, permanentWfh, effectiveFrom }),
  });
};

export const getCurrentSalary = async (userId) => {
  return safeFetch(`${config.BASE_URL}/api/salary/user/${userId}/current`);
};

export const getSalaryHistory = async (userId) => {
  return safeFetch(`${config.BASE_URL}/api/salary/user/${userId}/history`);
};

export const getPayslip = async (userId, year, month) => {
  return safeFetch(`${config.BASE_URL}/api/salary/user/${userId}/payslip?year=${year}&month=${month}`);
};

/** Admin-only - current salary config for every office employee. */
export const getAllCurrentSalaries = async () => {
  return safeFetch(`${config.BASE_URL}/api/salary/all-current`);
};
