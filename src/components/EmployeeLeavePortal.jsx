// src/components/EmployeeLeavePortal.jsx
import React, { useEffect, useState } from "react";
import Select from "react-select";
import LeaveCalendar from "./LeaveCalendar";
import { getLeaveBalance, getLeaveRequests, applyLeaveRequest } from "../services/LeaveService";
import "./EmployeeLeavePortal.css";
import { toLocalDateStr } from "../utils/date";

// Native <select> option-list hover/highlight colors are drawn by the OS and
// can't be styled with CSS (same limitation as the daily-entries Status
// filter), so this uses react-select + the `styles` prop (real inline
// styles) instead, themed to match this page's purple/teal accents.
const leaveTypeSelectStyles = {
  control: (base, state) => ({
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
    borderColor: state.isFocused ? "var(--primary-purple)" : "#ccc",
    boxShadow: "none",
    cursor: "pointer",
    ":hover": {
      borderColor: "var(--primary-purple)",
    },
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
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--primary-purple)"
      : state.isFocused
      ? "#f3e6f5"
      : "#fff",
    color: state.isSelected ? "#fff" : "#333",
    cursor: "pointer",
  }),
};

const EmployeeLeavePortal = () => {
  const currentUser = JSON.parse(localStorage.getItem("user"));
  const userId = currentUser?.userId;

  const [balance, setBalance] = useState({
    accruedPaidLeaves: 0,
    paidLeavesUsed: 0,
    unpaidLeavesUsed: 0,
    wfhDays: 0,
    allowedLeaveTypes: []
  });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [form, setForm] = useState({
    type: "",
    startDate: "",
    endDate: "",
    reason: ""
  });
  const [loading, setLoading] = useState(false);

  const paidLeavesLeft = balance.accruedPaidLeaves - balance.paidLeavesUsed;

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
        alert("Failed to fetch leave data");
      } finally {
        setLoading(false);
      }
    }

    if (userId) fetchData();
  }, [userId]);

  // Calculate requested days
  const requestedDays =
    form.startDate && form.endDate
      ? Math.floor((new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24)) + 1
      : 0;

  // Custom handler for Start Date to automatically set End Date to matching day
  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;
    setForm(f => ({
      ...f,
      startDate: newStartDate,
      endDate: newStartDate // Automatically sets end date to same day
    }));
  };

  // Apply leave
  const handleApply = async () => {
    if (!form.startDate || !form.endDate) return alert("Select start and end dates");

    // 🛡️ Balance Check Validation: Protects against exceeding paid/privilege balance allocations
    const currentTypeClean = (form.type || "").trim().toUpperCase();
    const isPaidType = currentTypeClean === "PAID" || currentTypeClean === "PRIVILEGE_LEAVE" || currentTypeClean === "PRIVILAGE_LEAVE";
    if (isPaidType && requestedDays > paidLeavesLeft) {
      return alert(`Cannot submit request! You are trying to apply for ${requestedDays} days, but you only have ${paidLeavesLeft} paid leave day(s) remaining.`);
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

      setForm({ type: "PAID", startDate: "", endDate: "", reason: "" });

      alert("Leave request submitted successfully");
    } catch (err) {
      console.error("Error during handleApply:", err);
      alert("Failed to submit leave request");
    } finally {
      setLoading(false);
    }
  };

  const today = toLocalDateStr(new Date()); // min date for input

  return (
    <div className="page-container leave-portal">
    
      {loading && <div className="loading-overlay">Loading...</div>}

      {/* Leave Balance */}
      <div className="leave-balance-card">
        <h2>Leave Balance</h2>
        <div>Paid Leaves Available: <strong>{paidLeavesLeft}</strong></div>
        <div>Unpaid Leaves Taken: <strong>{balance.unpaidLeavesUsed}</strong></div>
        <div>WFH Days Taken: <strong>{balance.wfhDays}</strong></div>
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
            options={leaveTypeOptions}
            value={selectedLeaveTypeOption}
            onChange={(opt) => setForm({ ...form, type: opt.value })}
            isSearchable={false}
          />

          <label>Start Date</label>
          <input
            type="date"
            min={today}
            value={form.startDate}
            onChange={handleStartDateChange}
          />

          <label>End Date</label>
          <input
            type="date"
            min={form.startDate || today}
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />

          {/* Dynamic counter block showing total count of days being applied for */}
          {requestedDays > 0 && (
            <div className="requested-days-box" style={{ margin: "12px 0", padding: "8px", background: "#eef5fc", borderRadius: "4px", fontSize: "14px", color: "#2c3e50" }}>
              Total Applied Duration: <strong>{requestedDays} Day(s)</strong>
            </div>
          )}

          <label>Reason</label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />

          {requestedDays > paidLeavesLeft && ((form.type || "").trim().toUpperCase() === "PAID" || (form.type || "").trim().toUpperCase() === "PRIVILEGE_LEAVE" || (form.type || "").trim().toUpperCase() === "PRIVILAGE_LEAVE") && (
            <p className="warning-text" style={{ color: "red", fontWeight: "500" }}>
              ⚠️ Warning: Requested duration exceeds your available paid balance!
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
                <td>{l.leaveDays}</td>
                <td style={{ color: l.status === "APPROVED" ? "green" : l.status === "REJECTED" ? "red" : "orange" }}>
                  {l.status}
                </td>
                <td>{new Date(l.appliedAt).toLocaleDateString()}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>No leave requests found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeLeavePortal;