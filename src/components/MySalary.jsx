// src/components/MySalary.jsx
import React, { useEffect, useState } from "react";
import { getPayslip } from "../services/SalaryService";
import "../css/theme.css";
import "./MySalary.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatAmount(value) {
  if (value === null || value === undefined) return "₹0";
  return "₹" + Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MySalary = () => {
  const currentUser = JSON.parse(localStorage.getItem("user"));
  const userId = currentUser?.userId;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [payslip, setPayslip] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadPayslip = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setPayslip(null);
    try {
      const data = await getPayslip(userId, year, month);
      setPayslip(data);
    } catch (err) {
      setError(err.message || "Failed to load payslip.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayslip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year, month]);

  return (
    <div className="page-container my-salary">
      <div className="salary-card">
        <div className="salary-header">
          <h2>
            My Salary{" "}
            {payslip && (
              <span className={`salary-pill ${payslip.finalized ? "salary-pill-finalized" : "salary-pill-draft"}`}>
                {payslip.finalized ? "Finalized" : "Draft"}
              </span>
            )}
          </h2>
          <div className="month-picker">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p className="salary-error">{error}</p>}

        {payslip && (
          <>
            {payslip.permanentWfh && (
              <p className="permanent-wfh-note">This account has permanent WFH status - the WFH day cap doesn't apply.</p>
            )}

            <table className="salary-breakdown">
              <tbody>
                <tr>
                  <td>Base Salary</td>
                  <td>{formatAmount(payslip.baseSalary)}</td>
                </tr>
                <tr>
                  <td>Days in {MONTH_NAMES[payslip.month - 1]}</td>
                  <td>{payslip.daysInMonth}</td>
                </tr>
                <tr>
                  <td>Weekly Off Days</td>
                  <td>{payslip.weeklyOffDaysInMonth}</td>
                </tr>
                <tr>
                  <td>Per-Day Rate (÷ working days)</td>
                  <td>{formatAmount(payslip.perDayRate)}</td>
                </tr>
                <tr>
                  <td>Absent Days</td>
                  <td>{payslip.absentDays}</td>
                </tr>
                <tr>
                  <td>Half Days</td>
                  <td>{payslip.halfDays}</td>
                </tr>
                <tr>
                  <td>Unpaid Leave Days</td>
                  <td>{payslip.unpaidLeaveDays}</td>
                </tr>
                <tr>
                  <td>WFH Days This Month</td>
                  <td>{payslip.wfhDaysThisMonth} {!payslip.permanentWfh && "(4 free per month)"}</td>
                </tr>
                <tr>
                  <td>Excess WFH Days (deducted)</td>
                  <td>{payslip.excessWfhDays}</td>
                </tr>
                <tr className="total-deduction-row">
                  <td>Total Deduction Days</td>
                  <td>{payslip.totalDeductionDays}</td>
                </tr>
              </tbody>
            </table>

            <div className="net-pay-box">
              <span className="net-pay-label">Deduction Amount</span>
              <span className="net-pay-value deduction">-{formatAmount(payslip.deductionAmount)}</span>
            </div>
            <div className="net-pay-box">
              <span className="net-pay-label">Health Insurance</span>
              <span className="net-pay-value deduction">-{formatAmount(payslip.healthInsuranceCost)}</span>
            </div>
            <div className="net-pay-box">
              <span className="net-pay-label">Professional Tax</span>
              <span className="net-pay-value deduction">-{formatAmount(payslip.professionalTax)}</span>
            </div>
            <div className="net-pay-box net-pay-final">
              <span className="net-pay-label">Net Pay</span>
              <span className="net-pay-value">{formatAmount(payslip.netPay)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MySalary;
