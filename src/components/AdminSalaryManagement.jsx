// src/components/AdminSalaryManagement.jsx
import React, { useEffect, useState } from "react";
import Select from "react-select";
import { getAllCurrentSalaries, setSalary, getPayslip, getSalaryHistory, finalizePayslip } from "../services/SalaryService";
import { toLocalDateStr } from "../utils/date";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import "../css/theme.css";
import "../css/components.css";
import "./AdminSalaryManagement.css";
import ToastContainer, { useToast } from "./common/Toast";
import { useConfirm } from "./common/useConfirm";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatAmount(value) {
  if (value === null || value === undefined) return "--";
  return "₹" + Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const AdminSalaryManagement = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    userId: "",
    monthlySalary: "",
    healthInsuranceCost: "",
    professionalTax: "",
    permanentWfh: false,
    effectiveFrom: toLocalDateStr(new Date()),
  });
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const [payslipTarget, setPayslipTarget] = useState(null); // userId or null
  const [payslipMonth, setPayslipMonth] = useState(today.getMonth() + 1);
  const [payslipYear, setPayslipYear] = useState(today.getFullYear());
  const [payslip, setPayslip] = useState(null);
  const [payslipError, setPayslipError] = useState(null);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const [historyTarget, setHistoryTarget] = useState(null); // userId or null
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadSalaries = async () => {
    try {
      setLoading(true);
      const data = await getAllCurrentSalaries();
      setSalaries(data || []);
    } catch (err) {
      console.error("Failed to load salaries:", err);
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalaries();
  }, []);

  const handleSetSalary = async () => {
    if (!form.userId || !form.monthlySalary) {
      showToast("Select an employee and enter a monthly salary.", "warning");
      return;
    }
    setSaving(true);
    try {
      await setSalary(
        form.userId,
        Number(form.monthlySalary),
        Number(form.healthInsuranceCost) || 0,
        Number(form.professionalTax) || 0,
        form.permanentWfh,
        form.effectiveFrom
      );
      showToast("Salary saved.", "success");
      setForm({
        userId: "",
        monthlySalary: "",
        healthInsuranceCost: "",
        professionalTax: "",
        permanentWfh: false,
        effectiveFrom: toLocalDateStr(new Date()),
      });
      await loadSalaries();
    } catch (err) {
      showToast(err.message || "Failed to save salary.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const openPayslip = (userId) => {
    setPayslipTarget(userId);
    setPayslip(null);
    setPayslipError(null);
  };

  useEffect(() => {
    if (!payslipTarget) return;
    async function load() {
      setPayslipLoading(true);
      setPayslipError(null);
      setPayslip(null);
      try {
        const data = await getPayslip(payslipTarget, payslipYear, payslipMonth);
        setPayslip(data);
      } catch (err) {
        setPayslipError(err.message || "Failed to load payslip.");
      } finally {
        setPayslipLoading(false);
      }
    }
    load();
  }, [payslipTarget, payslipYear, payslipMonth]);

  const handleFinalize = async () => {
    if (!payslipTarget) return;
    const ok = await confirm({
      title: "Finalize payslip?",
      message: "Finalize this payslip? This freezes it permanently - later attendance corrections won't change it.",
      confirmLabel: "Finalize",
    });
    if (!ok) return;
    setFinalizing(true);
    try {
      const data = await finalizePayslip(payslipTarget, payslipYear, payslipMonth);
      setPayslip(data);
    } catch (err) {
      showToast(err.message || "Failed to finalize payslip.", "danger");
    } finally {
      setFinalizing(false);
    }
  };

  const openHistory = (userId) => {
    setHistoryTarget(userId);
    setHistory([]);
  };

  useEffect(() => {
    if (!historyTarget) return;
    async function load() {
      setHistoryLoading(true);
      try {
        const data = await getSalaryHistory(historyTarget);
        setHistory(data || []);
      } catch (err) {
        console.error("Failed to load salary history:", err);
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    }
    load();
  }, [historyTarget]);

  const employeeOptions = salaries.map((s) => ({ value: s.userId, label: `${s.userName} (${s.userId})` }));
  const payslipMonthOptions = MONTH_NAMES.map((m, idx) => ({ value: idx + 1, label: m }));
  const payslipYearOptions = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]
    .map((y) => ({ value: y, label: String(y) }));

  return (
    <div className="admin-salary-management">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {ConfirmDialogElement}

      <h2 className="section-title">Salary Management</h2>

      <div className="salary-admin-card">
        <h2>Set / Update Salary</h2>
        <div className="salary-form">
          <label>Employee</label>
          <Select
            options={employeeOptions}
            value={employeeOptions.find((o) => o.value === form.userId) || null}
            onChange={(selected) => setForm({ ...form, userId: selected ? selected.value : "" })}
            placeholder="Select employee"
            isClearable
            classNamePrefix="react-select"
            className="react-select-container"
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            styles={themedSelectStyles()}
          />

          <label>Monthly Salary</label>
          <input
            type="number"
            value={form.monthlySalary}
            onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
            placeholder="e.g. 25000"
          />

          <label>Health Insurance Cost (Optional)</label>
          <input
            type="number"
            value={form.healthInsuranceCost}
            onChange={(e) => setForm({ ...form, healthInsuranceCost: e.target.value })}
            placeholder="e.g. 500"
          />

          <label>Professional Tax (Optional)</label>
          <input
            type="number"
            value={form.professionalTax}
            onChange={(e) => setForm({ ...form, professionalTax: e.target.value })}
            placeholder="e.g. 200"
          />

          <label>Effective From</label>
          <input
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
          />

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.permanentWfh}
              onChange={(e) => setForm({ ...form, permanentWfh: e.target.checked })}
            />
            Permanent WFH (exempt from the 4-day WFH cap)
          </label>

          <button className="vt-btn vt-btn-primary" onClick={handleSetSalary} disabled={saving}>
            {saving ? "Saving..." : "Save Salary"}
          </button>
        </div>
      </div>

      <div className="salary-admin-card">
        <h2>Current Salaries</h2>
        {loading && <div className="loading-overlay">Loading...</div>}
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Monthly Salary</th>
              <th>Health Insurance</th>
              <th>Professional Tax</th>
              <th>Permanent WFH</th>
              <th>Effective From</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {salaries.length > 0 ? (
              salaries.map((s) => (
                <tr key={s.userId}>
                  <td>{s.userName || s.userId}</td>
                  <td>{formatAmount(s.monthlySalary)}</td>
                  <td>{formatAmount(s.healthInsuranceCost)}</td>
                  <td>{formatAmount(s.professionalTax)}</td>
                  <td>{s.permanentWfh ? "Yes" : "No"}</td>
                  <td>{s.effectiveFrom || "Not set"}</td>
                  <td>
                    <button className="vt-btn vt-btn-primary" onClick={() => openPayslip(s.userId)}>
                      View Payslip
                    </button>{" "}
                    <button className="vt-btn vt-btn-primary" onClick={() => openHistory(s.userId)}>
                      View History
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center" }}>No employees found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {payslipTarget && (
        <div className="salary-admin-card">
          <div className="salary-header">
            <h2>
              Payslip - {payslipTarget}{" "}
              {payslip && (
                <span className={`salary-pill ${payslip.finalized ? "salary-pill-finalized" : "salary-pill-draft"}`}>
                  {payslip.finalized ? "Finalized" : "Draft"}
                </span>
              )}
            </h2>
            <div className="month-picker">
              <Select
                options={payslipMonthOptions}
                value={payslipMonthOptions.find((o) => o.value === payslipMonth)}
                onChange={(selected) => setPayslipMonth(selected.value)}
                isSearchable={false}
                classNamePrefix="react-select"
                className="react-select-container filter-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
              <Select
                options={payslipYearOptions}
                value={payslipYearOptions.find((o) => o.value === payslipYear)}
                onChange={(selected) => setPayslipYear(selected.value)}
                isSearchable={false}
                classNamePrefix="react-select"
                className="react-select-container filter-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
              <button className="vt-btn vt-btn-secondary" onClick={() => setPayslipTarget(null)}>Close</button>
            </div>
          </div>

          {payslipLoading && <p>Loading...</p>}
          {payslipError && <p className="salary-error">{payslipError}</p>}

          {payslip && (
            <>
              <table className="salary-breakdown">
                <tbody>
                  <tr><td>Base Salary</td><td>{formatAmount(payslip.baseSalary)}</td></tr>
                  <tr><td>Days in Month</td><td>{payslip.daysInMonth}</td></tr>
                  <tr><td>Weekly Off Days</td><td>{payslip.weeklyOffDaysInMonth}</td></tr>
                  <tr><td>Per-Day Rate (÷ working days)</td><td>{formatAmount(payslip.perDayRate)}</td></tr>
                  <tr><td>Absent Days</td><td>{payslip.absentDays}</td></tr>
                  <tr><td>Half Days</td><td>{payslip.halfDays}</td></tr>
                  <tr><td>Unpaid Leave Days</td><td>{payslip.unpaidLeaveDays}</td></tr>
                  <tr><td>WFH Days This Month</td><td>{payslip.wfhDaysThisMonth}</td></tr>
                  <tr><td>Excess WFH Days</td><td>{payslip.excessWfhDays}</td></tr>
                  <tr className="total-deduction-row"><td>Total Deduction Days</td><td>{payslip.totalDeductionDays}</td></tr>
                  <tr><td>Deduction Amount</td><td>-{formatAmount(payslip.deductionAmount)}</td></tr>
                  <tr><td>Health Insurance</td><td>-{formatAmount(payslip.healthInsuranceCost)}</td></tr>
                  <tr><td>Professional Tax</td><td>-{formatAmount(payslip.professionalTax)}</td></tr>
                  <tr className="total-deduction-row"><td>Net Pay</td><td>{formatAmount(payslip.netPay)}</td></tr>
                </tbody>
              </table>
              {!payslip.finalized && (
                <button className="vt-btn vt-btn-primary" onClick={handleFinalize} disabled={finalizing}>
                  {finalizing ? "Finalizing..." : "Finalize"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {historyTarget && (
        <div className="salary-admin-card">
          <div className="salary-header">
            <h2>Salary History - {historyTarget}</h2>
            <button className="vt-btn vt-btn-secondary" onClick={() => setHistoryTarget(null)}>Close</button>
          </div>

          {historyLoading && <p>Loading...</p>}

          {!historyLoading && (
            <table>
              <thead>
                <tr>
                  <th>Monthly Salary</th>
                  <th>Health Insurance</th>
                  <th>Professional Tax</th>
                  <th>Permanent WFH</th>
                  <th>Effective From</th>
                  <th>Set By</th>
                  <th>Set At</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? (
                  history.map((h) => (
                    <tr key={h.id}>
                      <td>{formatAmount(h.monthlySalary)}</td>
                      <td>{formatAmount(h.healthInsuranceCost)}</td>
                      <td>{formatAmount(h.professionalTax)}</td>
                      <td>{h.permanentWfh ? "Yes" : "No"}</td>
                      <td>{h.effectiveFrom || "Not set"}</td>
                      <td>{h.setBy || "-"}</td>
                      <td>{h.setAt ? new Date(h.setAt).toLocaleString() : "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>No history found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSalaryManagement;
