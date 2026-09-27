// src/components/TeamAttendanceLeave.jsx
import React, { useEffect, useState } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  getTeamAttendance,
  getCorrections,
  approveCorrection,
  rejectCorrection,
} from "../services/AttendanceService";
import { getAttendanceEligibleUsers } from "../services/LeaveService";
import AdminLeaveDashboard from "./AdminLeaveDashboard";
import LeaveCalendar from "./LeaveCalendar";
import { toLocalDateStr } from "../utils/date";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";
import "../css/theme.css";
import "../css/components.css";
import "./TeamAttendanceLeave.css";

const LOCATION_BADGE = {
  OFFICE: { label: "Office", className: "badge-office" },
  REMOTE: { label: "Remote", className: "badge-remote" },
  UNKNOWN: { label: "Unknown", className: "badge-unknown" },
};

const STATUS_LABEL = {
  PRESENT: "Present",
  ABSENT: "Absent",
  ON_LEAVE: "On Leave",
  WFH: "WFH",
  HALF_DAY: "Half Day",
};

function LocationBadge({ type }) {
  if (!type) return <span className="location-badge badge-unknown">--</span>;
  const badge = LOCATION_BADGE[type] || LOCATION_BADGE.UNKNOWN;
  return <span className={`location-badge ${badge.className}`}>{badge.label}</span>;
}

function formatTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const TeamAttendanceLeave = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  // Mirrors the backend hierarchy rule in AttendanceService.assertCanActOnCorrection:
  // nobody can approve their own request, and only SUPER_ADMIN can act on a
  // SUPER_USER's correction request.
  const canActOn = (correction) => {
    if (correction.userId === currentUser.userId) return false;
    if (correction.userRole === "SUPER_USER" && currentUser.role !== "SUPER_ADMIN") return false;
    return true;
  };

  const [date, setDate] = useState(new Date());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingCorrections, setPendingCorrections] = useState([]);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [attendanceUsers, setAttendanceUsers] = useState([]);
  // Per-row guard against double-click/slow-network double-submits on
  // Approve/Reject - a Set of correction-request ids currently being acted on.
  const [actingOnIds, setActingOnIds] = useState(new Set());
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState("");
  const [activeTab, setActiveTab] = useState("attendance");

  const loadTeamAttendance = async (targetDate) => {
    try {
      setLoading(true);
      const data = await getTeamAttendance(targetDate);
      setRecords(data || []);
    } catch (err) {
      console.error("Failed to load team attendance:", err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCorrections = async () => {
    try {
      setCorrectionsLoading(true);
      const data = await getCorrections("PENDING");
      setPendingCorrections(data || []);
    } catch (err) {
      console.error("Failed to load pending corrections:", err);
      setPendingCorrections([]);
    } finally {
      setCorrectionsLoading(false);
    }
  };

  useEffect(() => {
    loadTeamAttendance(toLocalDateStr(date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    loadPendingCorrections();
  }, []);

  // Fetched for both roles now, not just SUPER_ADMIN - the Team Attendance
  // table below needs the full roster to show everyone, not just whoever
  // already has a record for the selected date.
  useEffect(() => {
    const loadAttendanceUsers = async () => {
      try {
        const data = await getAttendanceEligibleUsers();
        setAttendanceUsers(data || []);
      } catch (err) {
        console.error("Failed to load attendance-eligible users:", err);
        setAttendanceUsers([]);
      }
    };
    loadAttendanceUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApproveCorrection = async (id) => {
    if (actingOnIds.has(id)) return;
    setActingOnIds((prev) => new Set(prev).add(id));
    try {
      await approveCorrection(id);
      await loadPendingCorrections();
      await loadTeamAttendance(date);
    } catch (err) {
      showToast(err.message || "Failed to approve.", "danger");
    } finally {
      setActingOnIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleRejectCorrection = async (id) => {
    if (actingOnIds.has(id)) return;
    setActingOnIds((prev) => new Set(prev).add(id));
    try {
      await rejectCorrection(id);
      await loadPendingCorrections();
    } catch (err) {
      showToast(err.message || "Failed to reject.", "danger");
    } finally {
      setActingOnIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const calendarUserOptions = attendanceUsers.map((u) => ({ value: u.userId, label: `${u.name} (${u.userId})` }));

  // Full roster (attendanceUsers) left-joined with today's records - a user
  // with no AttendanceRecord yet (hasn't checked in, and the nightly sweep
  // hasn't run) still gets a row instead of silently disappearing from the
  // table, same idea as LeaveCalendar's "no record for this date" gap-fill.
  const attendanceByUserId = new Map(records.map((r) => [r.userId, r]));
  const rosterRows = attendanceUsers.map((u) => ({
    userId: u.userId,
    userName: u.name || u.userId,
    record: attendanceByUserId.get(u.userId) || null,
  }));

  return (
    <div className="team-attendance-leave">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="vt-page-header">
        <h2>Team Attendance &amp; Leave</h2>
      </div>

      <div className="vt-tabs">
        <button
          type="button"
          className={`vt-tab ${activeTab === "attendance" ? "active" : ""}`}
          onClick={() => setActiveTab("attendance")}
        >
          Attendance
        </button>
        <button
          type="button"
          className={`vt-tab ${activeTab === "leave" ? "active" : ""}`}
          onClick={() => setActiveTab("leave")}
        >
          Leave
        </button>
      </div>

      {activeTab === "attendance" && (
        <>
          <div className="attendance-roster-card">
            <div className="attendance-roster-header">
              <h2 className="section-title">Team Attendance</h2>
              <DatePicker
                selected={date}
                onChange={(d) => d && setDate(d)}
                dateFormat="dd/MM/yyyy"
                className="date-picker"
                portalId="team-attendance-datepicker-portal"
              />
            </div>

            {loading && <div className="loading-overlay">Loading...</div>}

            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rosterRows.length > 0 ? (
                  rosterRows.map((row) => (
                    <tr key={row.userId}>
                      <td>{row.userName}</td>
                      {row.record ? (
                        <>
                          <td>
                            {formatTime(row.record.checkInTime)} <LocationBadge type={row.record.checkInLocationType} />
                          </td>
                          <td>
                            {formatTime(row.record.checkOutTime)} <LocationBadge type={row.record.checkOutLocationType} />
                          </td>
                          <td>{STATUS_LABEL[row.record.status] || row.record.status || "--"}</td>
                        </>
                      ) : (
                        <>
                          <td>--</td>
                          <td>--</td>
                          <td><span className="vt-badge vt-badge-warning">Not Checked In</span></td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center" }}>
                      No employees found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {currentUser.role === "SUPER_ADMIN" && (
            <div className="attendance-roster-card">
              <div className="attendance-roster-header">
                <h2 className="section-title">Employee Attendance Calendar</h2>
                <Select
                  options={calendarUserOptions}
                  value={calendarUserOptions.find((o) => o.value === selectedCalendarUserId) || null}
                  onChange={(selected) => setSelectedCalendarUserId(selected ? selected.value : "")}
                  placeholder="Select Employee"
                  isClearable
                  isSearchable={false}
                  classNamePrefix="react-select"
                  className="react-select-container filter-select"
                  menuPortalTarget={menuPortalTarget}
                  menuPosition={menuPosition}
                  styles={themedSelectStyles()}
                />
              </div>
              {selectedCalendarUserId && (
                <LeaveCalendar userId={selectedCalendarUserId} adminView={true} showAttendance={true} />
              )}
            </div>
          )}

          <div className="attendance-roster-card">
            <div className="attendance-roster-header">
              <h2 className="section-title">Pending Attendance Corrections</h2>
            </div>
            {correctionsLoading && <div className="loading-overlay">Loading...</div>}
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Requested Status</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingCorrections.length > 0 ? (
                  pendingCorrections.map((c) => (
                    <tr key={c.id}>
                      <td>{c.userName || c.userId}</td>
                      <td>{c.date}</td>
                      <td>{STATUS_LABEL[c.requestedStatus] || c.requestedStatus}</td>
                      <td>{c.reason}</td>
                      <td>
                        {canActOn(c) ? (
                          <>
                            <button className="btn-approve" onClick={() => handleApproveCorrection(c.id)} disabled={actingOnIds.has(c.id)}>
                              {actingOnIds.has(c.id) ? "..." : "Approve"}
                            </button>
                            <button className="btn-reject" onClick={() => handleRejectCorrection(c.id)} disabled={actingOnIds.has(c.id)}>
                              {actingOnIds.has(c.id) ? "..." : "Reject"}
                            </button>
                          </>
                        ) : (
                          <span className="leave-action-hint">
                            {c.userRole === "SUPER_USER" ? "Requires Super Admin" : "Not actionable"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center" }}>
                      No pending correction requests
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "leave" && <AdminLeaveDashboard />}
    </div>
  );
};

export default TeamAttendanceLeave;
