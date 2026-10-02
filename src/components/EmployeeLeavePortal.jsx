// src/components/EmployeeLeavePortal.jsx
import React, { useEffect, useState } from "react";
import Select from "react-select";
import LeaveCalendar from "./LeaveCalendar";
import { getLeaveBalance, getLeaveRequests, applyLeaveRequest } from "../services/LeaveService";
import "./EmployeeLeavePortal.css";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";

// Native <select> option-list hover/highlight colors are drawn by the OS and
// can't be styled with CSS (same limitation as the daily-entries Status
// filter), so this uses react-select + the `styles` prop (real inline
// styles) instead, themed to match this page's purple/teal accents.
const leaveTypeSelectStyles = themedSelectStyles({
  control: (base) => ({
    ...base,
    minHeight: 38,
    height: 38,
    // The plain <input>/<textarea> fields on this form use box-sizing:
    // border-box (see .apply-leave-form input in the CSS), so their 1px
    // border is included in their declared height. react-select's control
    // defaults to content-box, so without this its border adds on top of
    // the 38px above instead of being part of it, rendering ~2-3px taller.
    boxSizing: "border-box",
    borderRadius: 4,
    cursor: "pointer",
  }),
  // Only trim the padding here - don't touch height/display. react-select
  // overlays the placeholder/selected text and its hidden input in the same
  // cell via gridArea, which only works with the default display:grid; a
  // fixed height clips that grid's own centering, and switching to flex
  // breaks the gridArea overlay outright (text vanishes on selection).
  // control's own alignItems:center already centers this natural-height
  // block within its fixed 38px, so nothing else is needed here.
  valueContainer: (base) => ({
    ...base,
    padding: "0 10px",
  }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  placeholder: (base) => ({ ...base, margin: 0 }),
  singleValue: (base) => ({ ...base, margin: 0 }),
  indicatorsContainer: (base) => ({ ...base, height: 36 }),
  dropdownIndicator: (base) => ({ ...base, padding: "0 8px" }),
  indicatorSeparator: (base) => ({ ...base, marginTop: 8, marginBottom: 8 }),
});

const EmployeeLeavePortal = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const currentUser = JSON.parse(localStorage.getItem("user"));
  const userId = currentUser?.userId;

  const [balance, setBalance] = useState({
    accruedPaidLeaves: 0,
    paidLeavesUsed: 0,
    unpaidLeavesUsed: 0,
    wfhDays: 0,
    accruedCasualLeaves: 0,
    casualLeavesUsed: 0,
    accruedSickLeaves: 0,
    sickLeavesUsed: 0,
    allowedLeaveTypes: []
  });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [form, setForm] = useState({
    type: "",
    startDate: "",
    endDate: "",
    reason: "",
    halfDay: false
  });
  const [loading, setLoading] = useState(false);

  const paidLeavesLeft = balance.accruedPaidLeaves - balance.paidLeavesUsed;
  const casualLeavesLeft = balance.accruedCasualLeaves - balance.casualLeavesUsed;
  const sickLeavesLeft = balance.accruedSickLeaves - balance.sickLeavesUsed;

  // Mirrors LeaveService.HALF_DAY_ELIGIBLE_TYPES on the backend - half day
  // only makes sense against a real balance to deduct 0.5 from (Privilege/
  // Casual/Sick). Unpaid is uncapped and WFH/Weekly Off aren't balance-
  // tracked, so neither offers the option.
  const currentTypeClean = (form.type || "").trim().toUpperCase();
  const isHalfDayEligibleType =
    currentTypeClean === "PAID" || currentTypeClean === "PRIVILEGE_LEAVE" || currentTypeClean === "PRIVILAGE_LEAVE"
      || currentTypeClean === "CASUAL" || currentTypeClean === "SICK";

  const leaveTypeOptions = balance.allowedLeaveTypes.map(type => {
    const cleanedType = (type || "").trim();
    return { value: cleanedType, label: cleanedType };
  });
  const selectedLeaveTypeOption =
    leaveTypeOptions.find(opt => opt.value === form.type) || null;

  // Fetch leave balance and requests
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [bal, requests] = await Promise.all([
          getLeaveBalance(userId),
          getLeaveRequests(userId)
        ]);

        setBalance(bal);
        setLeaveRequests(requests);

        // Set default leave type in form if not already set
        // Assume bal.allowedLeaveTypes is provided by backend as ["PRIVILEGE_LEAVE", "UNPAID", "WFH"]
        if (bal.allowedLeaveTypes?.length) {
          setForm(f => ({ ...f, type: bal.allowedLeaveTypes[0].trim() }));
        }

      } catch (err) {
        console.error("Failed to fetch leave data:", err);
        showToast("Failed to fetch leave data", "danger");
      } finally {
        setLoading(false);
      }
    }

    if (userId) fetchData();
  }, [userId, showToast]);

  // Calculate requested days
  const requestedDays =
    form.startDate && form.endDate
      ? Math.floor((new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24)) + 1
      : 0;
  // What actually gets deducted/validated against balance - 0.5 instead of
  // the whole-day count whenever Half Day is checked.
  const effectiveRequestedDays = form.halfDay ? 0.5 : requestedDays;

  // Custom handler for Start Date to automatically set End Date to matching day
  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;
    setForm(f => ({
      ...f,
      startDate: newStartDate,
      endDate: newStartDate // Automatically sets end date to same day
    }));
  };

  // Half Day only ever applies to a single day - checking it snaps End Date
  // back to match Start Date (mirrors the backend's own rejection of a
  // halfDay request spanning more than one day) and locks the End Date
  // field while checked, same idea as handleStartDateChange above.
  const handleHalfDayToggle = (checked) => {
    setForm(f => ({
      ...f,
      halfDay: checked,
      endDate: checked ? f.startDate : f.endDate
    }));
  };

  // Apply leave
  const handleApply = async () => {
    if (!form.startDate || !form.endDate) return showToast("Select start and end dates", "warning");

    // 🛡️ Balance Check Validation: Protects against exceeding paid/privilege/casual/sick balance allocations
    const isPaidType = currentTypeClean === "PAID" || currentTypeClean === "PRIVILEGE_LEAVE" || currentTypeClean === "PRIVILAGE_LEAVE";
    if (isPaidType && effectiveRequestedDays > paidLeavesLeft) {
      return showToast(`Cannot submit request! You are trying to apply for ${effectiveRequestedDays} days, but you only have ${paidLeavesLeft} paid leave day(s) remaining.`, "warning");
    }
    if (currentTypeClean === "CASUAL" && effectiveRequestedDays > casualLeavesLeft) {
      return showToast(`Cannot submit request! You are trying to apply for ${effectiveRequestedDays} days, but you only have ${casualLeavesLeft} casual leave day(s) remaining.`, "warning");
    }
    if (currentTypeClean === "SICK" && effectiveRequestedDays > sickLeavesLeft) {
      return showToast(`Cannot submit request! You are trying to apply for ${effectiveRequestedDays} days, but you only have ${sickLeavesLeft} sick leave day(s) remaining.`, "warning");
    }

    try {
      setLoading(true);

      console.log("Applying leave...");
      await applyLeaveRequest(userId, form);
      console.log("Leave applied successfully");

      console.log("Refreshing data...");
      const [requests, bal] = await Promise.all([
        getLeaveRequests(userId),
        getLeaveBalance(userId)
      ]);

      console.log("Requests:", requests);
      console.log("Balance:", bal);

      setLeaveRequests(requests);
      setBalance(bal);

      setForm({ type: "PAID", startDate: "", endDate: "", reason: "", halfDay: false });

      showToast("Leave request submitted successfully", "success");
    } catch (err) {
      console.error("Error during handleApply:", err);
      showToast("Failed to submit leave request", "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container leave-portal">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {loading && <div className="loading-overlay">Loading...</div>}

      {/* Leave Balance */}
      <div className="leave-balance-card">
        <h2>Leave Balance</h2>
        <div>Paid Leaves Available: <strong>{paidLeavesLeft}</strong></div>
        <div>Casual Leaves Available: <strong>{casualLeavesLeft}</strong></div>
        <div>Sick Leaves Available: <strong>{sickLeavesLeft}</strong></div>
        <small>Next month’s leave will be credited on the 1st.</small>
      </div>

      <div className="leave-calendar-and-form">
        {/* Apply Leave Form */}
        <div className="apply-leave-form">
          <h2>Apply for Leave</h2>

          <label>Leave Type</label>
          <Select
            className="leave-type-select"
            styles={leaveTypeSelectStyles}
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            options={leaveTypeOptions}
            value={selectedLeaveTypeOption}
            onChange={(opt) => {
              const cleaned = (opt.value || "").trim().toUpperCase();
              const stillEligible = cleaned === "PAID" || cleaned === "PRIVILEGE_LEAVE" || cleaned === "PRIVILAGE_LEAVE"
                || cleaned === "CASUAL" || cleaned === "SICK";
              setForm({ ...form, type: opt.value, halfDay: stillEligible ? form.halfDay : false });
            }}
            isSearchable={false}
          />

          <label>Start Date</label>
          <input
            type="date"
            value={form.startDate}
            onChange={handleStartDateChange}
          />

          {/* No lower bound tied to "today" - past dates are allowed
              (e.g. filing leave retroactively for a day already missed).
              Still can't be before Start Date, since an end before its own
              start is never meaningful regardless of past/future. */}
          <label>End Date</label>
          <input
            type="date"
            min={form.startDate || undefined}
            value={form.endDate}
            disabled={form.halfDay}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />

          {/* Only offered for Privilege/Casual/Sick - these are the only
              leave types with a real accrued balance to deduct 0.5 from
              (Unpaid is uncapped, WFH/Weekly Off aren't balance-tracked). */}
          {isHalfDayEligibleType && (
            <label className="half-day-checkbox-label">
              <input
                type="checkbox"
                checked={form.halfDay}
                onChange={(e) => handleHalfDayToggle(e.target.checked)}
              />
              {" "}Half Day
            </label>
          )}

          {/* Dynamic counter block showing total count of days being applied for */}
          {effectiveRequestedDays > 0 && (
            <div className="requested-days-box">
              Total Applied Duration: <strong>{form.halfDay ? "0.5 Day (Half Day)" : `${requestedDays} Day(s)`}</strong>
            </div>
          )}

          <label>Reason</label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />

          {effectiveRequestedDays > paidLeavesLeft && (currentTypeClean === "PAID" || currentTypeClean === "PRIVILEGE_LEAVE" || currentTypeClean === "PRIVILAGE_LEAVE") && (
            <p className="warning-text">
              ⚠️ Warning: Requested duration exceeds your available paid balance!
            </p>
          )}

          {effectiveRequestedDays > casualLeavesLeft && currentTypeClean === "CASUAL" && (
            <p className="warning-text">
              ⚠️ Warning: Requested duration exceeds your available casual leave balance!
            </p>
          )}

          {effectiveRequestedDays > sickLeavesLeft && currentTypeClean === "SICK" && (
            <p className="warning-text">
              ⚠️ Warning: Requested duration exceeds your available sick leave balance!
            </p>
          )}

          <button
            className="btn-apply-leave"
            onClick={handleApply}
            disabled={!form.startDate || !form.endDate || loading}
          >
            Apply
          </button>
        </div>

        {/* Calendar */}
        <div className="leave-calendar-section">
          <LeaveCalendar adminView={false} userId={userId} leaveData={leaveRequests} showTitle={false} showAttendance={true}/>
        </div>
      </div>

      {/* Leave History Table */}
      <div className="leave-history-table">
        <h3>My Leave History</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
              <th>Days</th>
              <th>Status</th>
              <th>Applied On</th>
            </tr>
          </thead>
          <tbody>
            {leaveRequests.length > 0 ? leaveRequests.map(l => (
              <tr key={l.id}>
                <td>{l.type}</td>
                <td>{l.startDate}</td>
                <td>{l.endDate}</td>
                <td>{l.leaveDays}{l.halfDay ? " (Half Day)" : ""}</td>
                <td className={`leave-status-cell leave-status-cell--${l.status?.toLowerCase()}`}>
                  {l.status}
                </td>
                <td>{new Date(l.appliedAt).toLocaleDateString()}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" className="leave-history-empty">No leave requests found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeLeavePortal;