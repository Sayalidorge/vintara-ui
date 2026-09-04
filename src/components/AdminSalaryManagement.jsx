// src/components/AdminSalaryManagement.jsx
import React, { useEffect, useState } from "react";
import { getAllCurrentSalaries, setSalary, getPayslip } from "../services/SalaryService";
import { toLocalDateStr } from "../utils/date";
import "../css/theme.css";
import "./AdminSalaryManagement.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatAmount(value) {
  if (value === null || value === undefined) return "--";
  return "₹" + Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const AdminSalaryManagement = () => {
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
      alert("Select an employee and enter a monthly salary.");
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
      alert("Salary saved.");
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
      alert(err.message || "Failed to save salary.");
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

  return (
    <div className="page-container admin-salary-management">
      <div className="salary-admin-card">
        <h2>Set / Update Salary</h2>
        <div className="salary-form">
          <label>Employee</label>
          <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
            <option value="">Select employee</option>
            {salaries.map((s) => (
              <option key={s.userId} value={s.userId}>{s.userName} ({s.userId})</option>
            ))}
          </select>

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

          <button className="btn-save-salary" onClick={handleSetSalary} disabled={saving}>
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
                    <button className="btn-view-payslip" onClick={() => openPayslip(s.userId)}>
                      View Payslip
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
            <h2>Payslip - {payslipTarget}</h2>
            <div className="month-picker">
              <select value={payslipMonth} onChange={(e) => setPayslipMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>
              <select value={payslipYear} onChange={(e) => setPayslipYear(Number(e.target.value))}>
                {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button className="secondary-btn" onClick={() => setPayslipTarget(null)}>Close</button>
            </div>
          </div>

          {payslipLoading && <p>Loading...</p>}
          {payslipError && <p className="salary-error">{payslipError}</p>}

          {payslip && (
            <table className="salary-breakdown">
              <tbody>
                <tr><td>Base Salary</td><td>{formatAmount(payslip.baseSalary)}</td></tr>
                <tr><td>Days in Month</td><td>{payslip.daysInMonth}</td></tr>
                <tr><td>Per-Day Rate</td><td>{formatAmount(payslip.perDayRate)}</td></tr>
                <tr><td>Absent Days</td><td>{payslip.absentDays}</td></tr>
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
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSalaryManagement;
