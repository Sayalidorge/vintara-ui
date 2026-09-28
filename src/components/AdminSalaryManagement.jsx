// src/components/AdminSalaryManagement.jsx
import React, { useEffect, useState } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  getAllCurrentSalaries,
  setSalary,
  updateEmployeeProfile,
  getPayslip,
  getSalaryHistory,
  finalizePayslip,
  downloadPayslipPdf,
} from "../services/SalaryService";
import { toLocalDateStr } from "../utils/date";
import { downloadBlob } from "../utils/csv";
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
    basicSalary: "",
    hra: "",
    otherAllowance: "",
    healthInsuranceCost: "",
    professionalTax: "",
    permanentWfh: false,
    effectiveFrom: new Date(),
  });
  const [saving, setSaving] = useState(false);

  const emptyProfileForm = {
    designation: "",
    dateOfJoining: null,
    bankName: "",
    bankAccountNumber: "",
    ifscCode: "",
    panNumber: "",
  };
  const [profileForm, setProfileForm] = useState(emptyProfileForm);

  const today = new Date();
  const [payslipTarget, setPayslipTarget] = useState(null); // userId or null
  const [payslipMonth, setPayslipMonth] = useState(today.getMonth() + 1);
  const [payslipYear, setPayslipYear] = useState(today.getFullYear());
  const [payslip, setPayslip] = useState(null);
  const [payslipError, setPayslipError] = useState(null);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  // Saves BOTH the salary/deduction fields and the one-time employee
  // details in one action - these used to be two separate buttons, which
  // meant clicking "Save Salary" alone silently discarded whatever had just
  // been typed into the "Employee One-Time Details" fields (they were never
  // sent to the backend, then wiped back to blank right after). One button,
  // one save, no way to lose half of what you just typed.
  const handleSetSalary = async () => {
    if (!form.userId || !form.basicSalary) {
      showToast("Select an employee and enter a basic salary.", "warning");
      return;
    }
    setSaving(true);
    try {
      await setSalary(
        form.userId,
        Number(form.basicSalary),
        Number(form.hra) || 0,
        Number(form.otherAllowance) || 0,
        Number(form.healthInsuranceCost) || 0,
        Number(form.professionalTax) || 0,
        form.permanentWfh,
        toLocalDateStr(form.effectiveFrom)
      );
      try {
        await updateEmployeeProfile(form.userId, {
          ...profileForm,
          dateOfJoining: profileForm.dateOfJoining ? toLocalDateStr(profileForm.dateOfJoining) : null,
        });
        showToast("Salary and employee details saved.", "success");
      } catch (profileErr) {
        // Salary already saved successfully at this point - say so, don't
        // let a profile-save failure read as if nothing happened.
        showToast(profileErr.message || "Salary saved, but employee details failed to save.", "danger");
      }
      // If the payslip panel is already open for this same employee, refresh
      // it too - otherwise it keeps showing whatever was there before this
      // save, which reads as "my change didn't take effect".
      if (payslipTarget === form.userId) {
        loadPayslip(payslipTarget, payslipYear, payslipMonth);
      }
      setForm({
        userId: "",
        basicSalary: "",
        hra: "",
        otherAllowance: "",
        healthInsuranceCost: "",
        professionalTax: "",
        permanentWfh: false,
        effectiveFrom: new Date(),
      });
      setProfileForm(emptyProfileForm);
      await loadSalaries();
    } catch (err) {
      showToast(err.message || "Failed to save salary.", "danger");
    } finally {
      setSaving(false);
    }
  };

  // Prefills BOTH forms from whatever this employee's SalaryResponseDTO row
  // already carries - the earnings/deduction fields so admin sees (and can
  // just tweak) what's currently on file instead of starting blank, and the
  // "Employee One-Time Details" block so unchanged details never need
  // re-typing. effectiveFrom deliberately stays "today" (not the stored
  // row's own effectiveFrom) - saving always creates a new effective-dated
  // row starting now, not an edit of the old one.
  const handleEmployeeSelect = (selected) => {
    const userId = selected ? selected.value : "";
    const existing = salaries.find((s) => s.userId === userId);
    setForm({
      ...form,
      userId,
      basicSalary: existing?.basicSalary ?? "",
      hra: existing?.hra ?? "",
      otherAllowance: existing?.otherAllowance ?? "",
      healthInsuranceCost: existing?.healthInsuranceCost ?? "",
      professionalTax: existing?.professionalTax ?? "",
      permanentWfh: existing?.permanentWfh ?? false,
    });
    setProfileForm({
      designation: existing?.designation || "",
      dateOfJoining: existing?.dateOfJoining ? new Date(existing.dateOfJoining) : null,
      bankName: existing?.bankName || "",
      bankAccountNumber: existing?.bankAccountNumber || "",
      ifscCode: existing?.ifscCode || "",
      panNumber: existing?.panNumber || "",
    });
  };

  const handleDownloadPdf = async () => {
    if (!payslipTarget) return;
    setDownloadingPdf(true);
    try {
      const blob = await downloadPayslipPdf(payslipTarget, payslipYear, payslipMonth);
      downloadBlob(blob, `payslip-${payslipTarget}-${payslipYear}-${String(payslipMonth).padStart(2, "0")}.pdf`);
    } catch (err) {
      showToast(err.message || "Failed to download payslip PDF.", "danger");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Pulled out of the effect below so it can also be called directly - a
  // useEffect keyed on payslipTarget only re-fires when that value actually
  // CHANGES, so clicking "View Payslip" again for the same employee (e.g.
  // right after editing their salary/details while the panel is still open)
  // was silently a no-op and kept showing stale data.
  const loadPayslip = async (userId, year, month) => {
    setPayslipLoading(true);
    setPayslipError(null);
    setPayslip(null);
    try {
      const data = await getPayslip(userId, year, month);
      setPayslip(data);
    } catch (err) {
      setPayslipError(err.message || "Failed to load payslip.");
    } finally {
      setPayslipLoading(false);
    }
  };

  const openPayslip = (userId) => {
    setPayslipTarget(userId);
    loadPayslip(userId, payslipYear, payslipMonth);
  };

  // Only reacts to the month/year pickers now - payslipTarget's own
  // transitions (including "still the same employee") are always handled by
  // openPayslip calling loadPayslip directly above.
  useEffect(() => {
    if (!payslipTarget) return;
    loadPayslip(payslipTarget, payslipYear, payslipMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payslipYear, payslipMonth]);

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
        <div className="salary-form-row">
        <div className="salary-form-col">
        <h2>Set / Update Salary</h2>
        <div className="salary-form">
          <label>Employee</label>
          <Select
            options={employeeOptions}
            value={employeeOptions.find((o) => o.value === form.userId) || null}
            onChange={handleEmployeeSelect}
            placeholder="Select employee"
            isClearable
            classNamePrefix="react-select"
            className="react-select-container"
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            styles={themedSelectStyles()}
          />

          <label>Basic Salary</label>
          <input
            type="number"
            value={form.basicSalary}
            onChange={(e) => setForm({ ...form, basicSalary: e.target.value })}
            placeholder="e.g. 15000"
          />

          <label>HRA (Optional)</label>
          <input
            type="number"
            value={form.hra}
            onChange={(e) => setForm({ ...form, hra: e.target.value })}
            placeholder="e.g. 5000"
          />

          <label>Other Allowance (Optional)</label>
          <input
            type="number"
            value={form.otherAllowance}
            onChange={(e) => setForm({ ...form, otherAllowance: e.target.value })}
            placeholder="e.g. 5000"
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
          <DatePicker
            selected={form.effectiveFrom}
            onChange={(date) => setForm({ ...form, effectiveFrom: date })}
            dateFormat="dd/MM/yyyy"
            className="date-picker"
            portalId="salary-datepicker-portal"
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
            {saving ? "Saving..." : "Save Salary & Details"}
          </button>
        </div>
        </div>

        <div className="salary-form-col">
        <h2>Employee One-Time Details</h2>
        <div className="salary-form">
          <label>Designation</label>
          <input
            type="text"
            value={profileForm.designation}
            onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
            placeholder="e.g. Receptionist"
          />

          <label>Date of Joining</label>
          <DatePicker
            selected={profileForm.dateOfJoining}
            onChange={(date) => setProfileForm({ ...profileForm, dateOfJoining: date })}
            dateFormat="dd/MM/yyyy"
            placeholderText="Select date"
            isClearable
            // Joining dates are often years back - month/year dropdowns
            // beat clicking the back-arrow one month at a time.
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            yearDropdownItemNumber={40}
            scrollableYearDropdown
            maxDate={new Date()}
            className="date-picker"
            portalId="salary-datepicker-portal"
          />

          <label>Bank Name</label>
          <input
            type="text"
            value={profileForm.bankName}
            onChange={(e) => setProfileForm({ ...profileForm, bankName: e.target.value })}
            placeholder="e.g. Axis Bank"
          />

          <label>Bank Account Number</label>
          <input
            type="text"
            value={profileForm.bankAccountNumber}
            onChange={(e) => setProfileForm({ ...profileForm, bankAccountNumber: e.target.value })}
          />

          <label>IFSC Code</label>
          <input
            type="text"
            value={profileForm.ifscCode}
            onChange={(e) => setProfileForm({ ...profileForm, ifscCode: e.target.value.toUpperCase() })}
          />

          <label>PAN Number (Optional)</label>
          <input
            type="text"
            value={profileForm.panNumber}
            onChange={(e) => setProfileForm({ ...profileForm, panNumber: e.target.value.toUpperCase() })}
          />
          {/* Single "Save Salary & Details" button below covers this section
              too - see handleSetSalary. */}
        </div>
        </div>
        </div>
      </div>

      <div className="salary-admin-card">
        <h2>Current Salaries</h2>
        {loading && <div className="loading-overlay">Loading...</div>}
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Gross Salary</th>
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
                  <td>{formatAmount(s.grossSalary)}</td>
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
              <button className="vt-btn vt-btn-purple" onClick={() => setPayslipTarget(null)}>Close</button>
            </div>
          </div>

          {payslipLoading && <p>Loading...</p>}
          {payslipError && <p className="salary-error">{payslipError}</p>}

          {payslip && (
            <>
              <table className="salary-breakdown">
                <tbody>
                  <tr><td>Basic Salary</td><td>{formatAmount(payslip.basicSalary)}</td></tr>
                  <tr><td>HRA</td><td>{formatAmount(payslip.hra)}</td></tr>
                  <tr><td>Other Allowance</td><td>{formatAmount(payslip.otherAllowance)}</td></tr>
                  <tr className="total-deduction-row"><td>Gross Salary</td><td>{formatAmount(payslip.grossSalary)}</td></tr>
                  <tr><td>Days in Month</td><td>{payslip.daysInMonth}</td></tr>
                  <tr><td>Weekly Off Days</td><td>{payslip.weeklyOffDaysInMonth}</td></tr>
                  <tr><td>Per-Day Rate (÷ working days)</td><td>{formatAmount(payslip.perDayRate)}</td></tr>
                  <tr><td>Paid Days</td><td>{payslip.paidDays} of {payslip.daysInMonth - payslip.weeklyOffDaysInMonth}</td></tr>
                  <tr><td>Absent Days</td><td>{payslip.absentDays}</td></tr>
                  <tr><td>Half Days</td><td>{payslip.halfDays}</td></tr>
                  <tr><td>Unpaid Leave Days</td><td>{payslip.unpaidLeaveDays}</td></tr>
                  <tr><td>WFH Days This Month</td><td>{payslip.wfhDaysThisMonth}</td></tr>
                  <tr><td>Excess WFH Days</td><td>{payslip.excessWfhDays}</td></tr>
                  <tr className="total-deduction-row"><td>Total Deduction Days (LOP)</td><td>{payslip.totalDeductionDays}</td></tr>
                  <tr><td>Deduction Amount</td><td>-{formatAmount(payslip.deductionAmount)}</td></tr>
                  <tr><td>Health Insurance</td><td>-{formatAmount(payslip.healthInsuranceCost)}</td></tr>
                  <tr><td>Professional Tax</td><td>-{formatAmount(payslip.professionalTax)}</td></tr>
                  <tr className="total-deduction-row"><td>Net Pay</td><td>{formatAmount(payslip.netPay)}</td></tr>
                </tbody>
              </table>
              <button className="vt-btn vt-btn-primary" onClick={handleDownloadPdf} disabled={downloadingPdf}>
                {downloadingPdf ? "Downloading..." : "Download PDF"}
              </button>{" "}
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
            <button className="vt-btn vt-btn-purple" onClick={() => setHistoryTarget(null)}>Close</button>
          </div>

          {historyLoading && <p>Loading...</p>}

          {!historyLoading && (
            <table>
              <thead>
                <tr>
                  <th>Basic Salary</th>
                  <th>HRA</th>
                  <th>Other Allowance</th>
                  <th>Gross Salary</th>
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
                      <td>{formatAmount(h.basicSalary)}</td>
                      <td>{formatAmount(h.hra)}</td>
                      <td>{formatAmount(h.otherAllowance)}</td>
                      <td>{formatAmount(h.grossSalary)}</td>
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
                    <td colSpan="10" style={{ textAlign: "center" }}>No history found</td>
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
