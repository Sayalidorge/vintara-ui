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
export const setSalary = async (userId, basicSalary, hra, otherAllowance, healthInsuranceCost, professionalTax, permanentWfh, effectiveFrom) => {
  return safeFetch(`${config.BASE_URL}/api/salary/set`, {
    method: "POST",
    body: JSON.stringify({ userId, basicSalary, hra, otherAllowance, healthInsuranceCost, professionalTax, permanentWfh, effectiveFrom }),
  });
};

/** Admin-only. One-time payroll-profile fields (designation/DOJ/bank details/PAN), not effective-dated. */
export const updateEmployeeProfile = async (userId, profile) => {
  return safeFetch(`${config.BASE_URL}/api/salary/user/${userId}/employee-profile`, {
    method: "PUT",
    body: JSON.stringify(profile),
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

/** Admin-only. Freezes this month's payslip - no unlock/un-finalize path. */
export const finalizePayslip = async (userId, year, month) => {
  return safeFetch(`${config.BASE_URL}/api/salary/user/${userId}/payslip/finalize?year=${year}&month=${month}`, {
    method: "POST",
  });
};

/** Self-or-SUPER_ADMIN. Returns a PDF Blob - bypasses safeFetch, which assumes a JSON response. */
export const downloadPayslipPdf = async (userId, year, month) => {
  const res = await fetch(`${config.BASE_URL}/api/salary/user/${userId}/payslip/pdf?year=${year}&month=${month}`, {
    headers: config.getHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to download payslip PDF");
  }
  return res.blob();
};
