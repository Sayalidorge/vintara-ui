// src/components/MySalary.jsx
import React, { useEffect, useState } from "react";
import Select from "react-select";
import { getPayslip } from "../services/SalaryService";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import "../css/theme.css";
import "../css/components.css";
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

  const monthOptions = MONTH_NAMES.map((m, idx) => ({ value: idx + 1, label: m }));
  const yearOptions = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]
    .map((y) => ({ value: y, label: String(y) }));

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
    <div className="my-salary">
      <div className="vt-page-header">
        <h2>My Salary</h2>
      </div>

      <div className="salary-card">
        <div className="salary-header">
          <span className="salary-status">
            {payslip && (
              <span className={`vt-badge ${payslip.finalized ? "vt-badge-success" : "vt-badge-warning"}`}>
                {payslip.finalized ? "Finalized" : "Draft"}
              </span>
            )}
          </span>
          <div className="month-picker">
            <Select
              options={monthOptions}
              value={monthOptions.find((o) => o.value === month)}
              onChange={(selected) => setMonth(selected.value)}
              isSearchable={false}
              classNamePrefix="react-select"
              className="react-select-container filter-select"
              menuPortalTarget={menuPortalTarget}
              menuPosition={menuPosition}
              styles={themedSelectStyles()}
            />
            <Select
              options={yearOptions}
              value={yearOptions.find((o) => o.value === year)}
              onChange={(selected) => setYear(selected.value)}
              isSearchable={false}
              classNamePrefix="react-select"
              className="react-select-container filter-select"
              menuPortalTarget={menuPortalTarget}
              menuPosition={menuPosition}
              styles={themedSelectStyles()}
            />
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
