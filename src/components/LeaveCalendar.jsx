// src/components/LeaveCalendar.jsx
import React, { useEffect, useRef, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import Select from "react-select";
import { getLeaveRequestsForMonth } from "../services/LeaveService";
import {
  getAttendanceHistory,
  getMyCorrections,
  submitCorrection,
} from "../services/AttendanceService";
import { toLocalDateStr } from "../utils/date";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";
import "../css/theme.css";
import "./LeaveCalendar.css";

const CORRECTION_STATUS_OPTIONS = [
  { value: "PRESENT", label: "Present (worked that day)" },
  { value: "WFH", label: "Work From Home" },
  { value: "WEEKLY_OFF", label: "Weekly Off" },
];

const LEAVE_TYPE_LABEL = {
  PRIVILAGE_LEAVE: "Privilege Leave",
  PAID: "Privilege Leave",
  UNPAID: "Unpaid Leave",
  WFH: "WFH",
  SICK: "Sick Leave",
  CASUAL: "Casual Leave",
  WEEKLY_OFF: "Weekly Off",
};

// WFH leave requests share the "remote/wfh" purple with attendance's own
// remote coloring; everything else shares the single "leave" teal - mirrors
// getTileClassName's own two-color grouping so the dot next to each row in
// the summary panel matches what's actually colored on the grid.
const leaveDotClass = (type) => ((type || "").toUpperCase() === "WFH" ? "leave-wfh" : "leave-paid");

// "YYYY-MM-DD" -> "DD/MM/YYYY" for display only - API calls/comparisons
// elsewhere in this file keep using the raw ISO string.
const formatDisplayDate = (isoDate) => {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

// showAttendance is opt-in (default off) so the other existing caller of this
// component (plain leave-only usage) is unaffected - only MyAttendanceLeave's
// self-service view turns this on.
const LeaveCalendar = ({ adminView = false, userId, onDayClick, showAttendance = false }) => {
  const { toasts, showToast, dismissToast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [myCorrections, setMyCorrections] = useState([]);
  const [date, setDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({ status: "PRESENT", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const correctionPanelRef = useRef(null);

  // The panel renders below the calendar/summary grid, off-screen on most
  // viewports when it first appears - without this, clicking a day silently
  // does nothing visible until the user scrolls down themselves.
  useEffect(() => {
    if (selectedDate && correctionPanelRef.current) {
      correctionPanelRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedDate]);

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
  const approvedLeaves = leaveRequests.filter((l) => l.status === "APPROVED");

  // Days that are purple on the grid via ATTENDANCE (WFH status, or PRESENT
  // confirmed remote via GPS/IP) rather than a formal leave request - e.g. a
  // backfilled/corrected WFH day - don't have a LeaveRequest at all, so
  // they'd silently be missing from the summary otherwise. Skip any date
  // already covered by a leave request above so a day is never listed twice.
  const leaveDates = new Set();
  approvedLeaves.forEach((l) => {
    let cur = new Date(l.startDate);
    const end = new Date(l.endDate);
    while (cur <= end) {
      leaveDates.add(toLocalDateStr(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
  });

  const attendanceWfhDays = showAttendance
    ? attendanceRecords
        .filter((r) => {
          if (leaveDates.has(r.date)) return false;
          if (r.status === "WFH") return true;
          return r.status === "PRESENT" && r.checkInLocationType === "REMOTE";
        })
        .map((r) => ({
          id: `attendance-${r.date}`,
          type: "WFH",
          startDate: r.date,
          endDate: r.date,
          leaveDays: 1,
        }))
    : [];

  const thisMonthLeaves = [...approvedLeaves, ...attendanceWfhDays].sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate)
  );

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
      if (type === "WEEKLY_OFF") return "leave-weekly-off";
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
  // diverge, since ON_LEAVE/WEEKLY_OFF records are themselves derived from
  // an approved leave, but attendance winning is the safer default if they
  // ever do).
  const getAttendanceClassName = (tileDate) => {
    if (getPendingCorrectionForDate(tileDate)) return "attendance-pending";

    const record = getAttendanceForDate(tileDate);
    if (record && record.status) {
      switch (record.status) {
        case "PRESENT":
          // checkInLocationType is null for backfilled/corrected days (no GPS/IP
          // evidence exists for a past date) and UNKNOWN when a live check-in had
          // no signal - neither means the person worked remotely, so only an
          // explicit REMOTE classification gets the WFH color.
          return record.checkInLocationType === "REMOTE" ? "attendance-remote" : "attendance-office";
        case "WFH":
          return "attendance-remote";
        case "ON_LEAVE":
          return ""; // already colored by the leave-type class above
        case "WEEKLY_OFF":
          // Unlike ON_LEAVE, a WEEKLY_OFF attendance record is usually just
          // a schedule-derived non-working day, not backed by an approved
          // WEEKLY_OFF-type leave request - so it can't rely on
          // getTileClassName having already colored the tile. Without this,
          // a weekly off with no matching leave request gets no class at
          // all and renders as a blank, uncolored day.
          return "leave-weekly-off";
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

    if (getTileClassName(clickedDate) === "leave-weekly-off") {
      showToast("This is your approved weekly off - no correction needed.", "warning");
      return;
    }

    if (getPendingCorrectionForDate(clickedDate)) {
      showToast("A correction request for this date is already pending approval.", "warning");
      return;
    }

    setSelectedDate(clickedDate);
    setCorrectionForm({ status: "PRESENT", reason: "" });
  };

  const handleSubmitCorrection = async () => {
    if (!correctionForm.reason.trim()) {
      showToast("Please enter a reason.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      await submitCorrection(toLocalDateStr(selectedDate), correctionForm.status, correctionForm.reason);
      showToast("Correction request submitted for approval.", "success");
      setSelectedDate(null);
      await refreshAttendance();
    } catch (err) {
      showToast(err.message || "Failed to submit correction request.", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="leave-calendar-container">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
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
                <div className="legend-item">
                  <span className="legend-box leave-weekly-off"></span>
                  <span>Weekly Off</span>
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
                    {l.startDate === l.endDate
                      ? formatDisplayDate(l.startDate)
                      : `${formatDisplayDate(l.startDate)} – ${formatDisplayDate(l.endDate)}`}
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
        <div className="correction-panel" ref={correctionPanelRef}>
          <h4>Request correction for {toLocalDateStr(selectedDate)}</h4>
          <label>Status</label>
          <Select
            options={CORRECTION_STATUS_OPTIONS}
            value={CORRECTION_STATUS_OPTIONS.find((o) => o.value === correctionForm.status) || null}
            onChange={(selected) => setCorrectionForm({ ...correctionForm, status: selected.value })}
            isSearchable={false}
            classNamePrefix="react-select"
            className="react-select-container"
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            styles={themedSelectStyles()}
          />
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