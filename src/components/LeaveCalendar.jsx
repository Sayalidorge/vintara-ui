// src/components/LeaveCalendar.jsx
import React, { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { getLeaveRequestsForMonth } from "../services/LeaveService";
import {
  getAttendanceHistory,
  getMyCorrections,
  submitCorrection,
} from "../services/AttendanceService";
import { toLocalDateStr } from "../utils/date";
import "./LeaveCalendar.css";

const LEAVE_TYPE_LABEL = {
  PRIVILAGE_LEAVE: "Privilege Leave",
  PAID: "Privilege Leave",
  UNPAID: "Unpaid Leave",
  WFH: "WFH",
  SICK: "Sick Leave",
  CASUAL: "Casual Leave",
};

// WFH leave requests share the "remote/wfh" purple with attendance's own
// remote coloring; everything else shares the single "leave" teal - mirrors
// getTileClassName's own two-color grouping so the dot next to each row in
// the summary panel matches what's actually colored on the grid.
const leaveDotClass = (type) => ((type || "").toUpperCase() === "WFH" ? "leave-wfh" : "leave-paid");

// showAttendance is opt-in (default off) so the other existing caller of this
// component (plain leave-only usage) is unaffected - only MyAttendanceLeave's
// self-service view turns this on.
const LeaveCalendar = ({ adminView = false, userId, onDayClick, showAttendance = false }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [myCorrections, setMyCorrections] = useState([]);
  const [date, setDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({ status: "PRESENT", reason: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Extract month and year safely inside the effect hook
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    async function fetchLeaves() {
      try {
        const data = await getLeaveRequestsForMonth(userId, year, month);

        // Ensure data is always an array to prevent .filter crashes
        setLeaveRequests(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch leave records:", error);
        setLeaveRequests([]);
      }
    }

    async function fetchAttendance() {
      try {
        const [records, corrections] = await Promise.all([
          getAttendanceHistory(userId, year, month),
          getMyCorrections(userId),
        ]);
        setAttendanceRecords(Array.isArray(records) ? records : []);
        setMyCorrections(Array.isArray(corrections) ? corrections : []);
      } catch (error) {
        console.error("Failed to fetch attendance records:", error);
        setAttendanceRecords([]);
        setMyCorrections([]);
      }
    }

    fetchLeaves();
    if (showAttendance && userId) fetchAttendance();
  }, [userId, date, adminView, showAttendance]); // Removed redundant month/year parameters to completely avoid state rendering loops

  const refreshAttendance = async () => {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    try {
      const [records, corrections] = await Promise.all([
        getAttendanceHistory(userId, year, month),
        getMyCorrections(userId),
      ]);
      setAttendanceRecords(Array.isArray(records) ? records : []);
      setMyCorrections(Array.isArray(corrections) ? corrections : []);
    } catch (error) {
      console.error("Failed to refresh attendance records:", error);
    }
  };

  // Approved leaves for whichever month is currently in view, for the
  // summary panel beside the calendar - same source data as the tile
  // coloring below, so the two always stay in sync.
  const thisMonthLeaves = leaveRequests
    .filter((l) => l.status === "APPROVED")
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  // Helper: returns CSS class based on APPROVED leave type
  const getTileClassName = (tileDate) => {
    const checkDate = new Date(tileDate.getFullYear(), tileDate.getMonth(), tileDate.getDate());

    const leaves = leaveRequests.filter((l) => {
      // 1. Only map APPROVED leaves to colors on the calendar grid
      if (l.status && l.status !== "APPROVED") return false;

      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      
      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      return checkDate >= startDate && checkDate <= endDate;
    });

    if (leaves.length > 0) {
      // Normalize string to uppercase to avoid spelling mismatches
      const type = leaves[0].type ? leaves[0].type.toUpperCase() : "";

      // 2. Map PRIVILAGE_LEAVE or PAID to your primary teal styling
      if (type === "PRIVILAGE_LEAVE" || type === "PAID") return "leave-paid";
      if (type === "UNPAID") return "leave-unpaid";
      if (type === "WFH") return "leave-wfh";
      if (type === "SICK") return "leave-sick";
      if (type === "CASUAL") return "leave-casual";
    }
    return "";
  };

  const getAttendanceForDate = (tileDate) => {
    const dateStr = toLocalDateStr(tileDate);
    return attendanceRecords.find((r) => r.date === dateStr) || null;
  };

  const getPendingCorrectionForDate = (tileDate) => {
    const dateStr = toLocalDateStr(tileDate);
    return myCorrections.find((c) => c.date === dateStr && c.status === "PENDING") || null;
  };

  // Attendance is the ground-truth layer, so it takes precedence over the
  // leave-type coloring when both exist for the same day (shouldn't normally
  // diverge, since ON_LEAVE records are themselves derived from an approved
  // leave, but attendance winning is the safer default if they ever do).
  const getAttendanceClassName = (tileDate) => {
    if (getPendingCorrectionForDate(tileDate)) return "attendance-pending";

    const record = getAttendanceForDate(tileDate);
    if (record && record.status) {
      switch (record.status) {
        case "PRESENT":
          return record.checkInLocationType === "OFFICE" ? "attendance-office" : "attendance-remote";
        case "WFH":
          return "attendance-remote";
        case "ON_LEAVE":
          return ""; // already colored by the leave-type class above
        case "ABSENT":
          return "attendance-absent";
        default:
          return "";
      }
    }

    // No record at all for this date - flag it as a gap if it's in the past,
    // so a forgotten check-in shows up even before the nightly absence sweep
    // has run (or for any day predating this feature). Skip it if the day is
    // already covered by an approved leave, so leave days aren't
    // double-flagged as "absent" just because no attendance row exists.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (tileDate < today && !getTileClassName(tileDate)) {
      return "attendance-absent";
    }
    return "";
  };

  const handleDayClick = (clickedDate) => {
    if (onDayClick) onDayClick(clickedDate);

    if (!showAttendance || adminView) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (clickedDate >= today) return; // backfill is for past dates only - today uses real check-in

    if (getPendingCorrectionForDate(clickedDate)) {
      alert("A correction request for this date is already pending approval.");
      return;
    }

    setSelectedDate(clickedDate);
    setCorrectionForm({ status: "PRESENT", reason: "" });
  };

  const handleSubmitCorrection = async () => {
    if (!correctionForm.reason.trim()) {
      alert("Please enter a reason.");
      return;
    }
    setSubmitting(true);
    try {
      await submitCorrection(toLocalDateStr(selectedDate), correctionForm.status, correctionForm.reason);
      alert("Correction request submitted for approval.");
      setSelectedDate(null);
      await refreshAttendance();
    } catch (err) {
      alert(err.message || "Failed to submit correction request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="leave-calendar-container">
      <h2 className="page-title">
        {adminView
          ? (showAttendance ? "Attendance & Leave Calendar" : "Leave Calendar (Admin)")
          : "My Leave Calendar"}
      </h2>
      
      <div className="calendar-and-summary">
        <div className="calendar-main">
          {/* Wrapper ensures react-calendar never collapses down to 0px width within existing grid layouts */}
          <div className="calendar-wrapper" style={{ width: "100%", overflow: "hidden" }}>
            <Calendar
              onChange={setDate}
              value={date}

              // CRITICAL FIX: Tracks when an admin or employee clicks previous/next month arrows
              onActiveStartDateChange={({ activeStartDate }) => {
                if (activeStartDate) {
                  setDate(activeStartDate);
                }
              }}

              tileClassName={({ date: tileDate, view }) =>
                view === "month" &&
                [getTileClassName(tileDate), showAttendance ? getAttendanceClassName(tileDate) : ""]
                  .filter(Boolean)
                  .join(" ")
              }
              onClickDay={handleDayClick}
            />
          </div>

          {/* Structured flex legend layout elements to line up perfectly beneath the main grid */}
          <div className="leave-legend">
            <div className="legend-item">
              <span className="legend-box leave-paid"></span>
              <span>Leave</span>
            </div>
            <div className="legend-item">
              <span className="legend-box leave-wfh"></span>
              <span>WFH</span>
            </div>
            {showAttendance && (
              <>
                <div className="legend-item">
                  <span className="legend-box attendance-office"></span>
                  <span>Present (Office)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-box attendance-remote"></span>
                  <span>Present (Remote/WFH)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-box attendance-absent"></span>
                  <span>Absent</span>
                </div>
                <div className="legend-item">
                  <span className="legend-box attendance-pending"></span>
                  <span>Correction Pending</span>
                </div>
              </>
            )}
          </div>

          {showAttendance && !adminView && (
            <p className="attendance-hint">Click a past date with no (or wrong) attendance to request a correction.</p>
          )}
        </div>

        {/* This month's approved leaves at a glance - same source data as the
            tile coloring above, so it always matches what's on the grid. */}
        <div className="month-leaves-panel">
          <h3>This Month's Leaves</h3>
          {thisMonthLeaves.length === 0 ? (
            <p className="no-leaves-text">No leaves this month.</p>
          ) : (
            <ul className="leave-summary-list">
              {thisMonthLeaves.map((l) => (
                <li key={l.id} className="leave-row">
                  <span className={`legend-box ${leaveDotClass(l.type)}`}></span>
                  <span className="leave-row-type">
                    {LEAVE_TYPE_LABEL[(l.type || "").toUpperCase()] || l.type}
                  </span>
                  <span className="leave-row-dates">
                    {l.startDate === l.endDate ? l.startDate : `${l.startDate} – ${l.endDate}`}
                  </span>
                  <span className="leave-row-days">
                    {l.leaveDays} day{l.leaveDays === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedDate && (
        <div className="correction-panel">
          <h4>Request correction for {toLocalDateStr(selectedDate)}</h4>
          <label>Status</label>
          <select
            value={correctionForm.status}
            onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value })}
          >
            <option value="PRESENT">Present (worked that day)</option>
            <option value="WFH">Work From Home</option>
          </select>
          <label>Reason</label>
          <textarea
            value={correctionForm.reason}
            onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
            placeholder="e.g. Forgot to check in"
          />
          <div className="correction-panel-buttons">
            <button onClick={handleSubmitCorrection} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit for Approval"}
            </button>
            <button className="secondary-btn" onClick={() => setSelectedDate(null)} disabled={submitting}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveCalendar;