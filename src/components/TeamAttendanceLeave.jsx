// src/components/TeamAttendanceLeave.jsx
import React, { useEffect, useState } from "react";
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
import "../css/theme.css";
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
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  // Mirrors the backend hierarchy rule in AttendanceService.assertCanActOnCorrection:
  // nobody can approve their own request, and only SUPER_ADMIN can act on a
  // SUPER_USER's correction request.
  const canActOn = (correction) => {
    if (correction.userId === currentUser.userId) return false;
    if (correction.userRole === "SUPER_USER" && currentUser.role !== "SUPER_ADMIN") return false;
    return true;
  };

  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingCorrections, setPendingCorrections] = useState([]);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [attendanceUsers, setAttendanceUsers] = useState([]);
  // Per-row guard against double-click/slow-network double-submits on
  // Approve/Reject - a Set of correction-request ids currently being acted on.
  const [actingOnIds, setActingOnIds] = useState(new Set());
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState("");

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
    loadTeamAttendance(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    loadPendingCorrections();
  }, []);

  useEffect(() => {
    if (currentUser.role !== "SUPER_ADMIN") return;
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
      alert(err.message || "Failed to approve.");
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
      alert(err.message || "Failed to reject.");
    } finally {
      setActingOnIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="page-container team-attendance-leave">
      <div className="attendance-roster-card">
        <div className="attendance-roster-header">
          <h2 className="section-title">Team Attendance</h2>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
            {records.length > 0 ? (
              records.map((r) => (
                <tr key={r.id}>
                  <td>{r.userName || r.userId}</td>
                  <td>
                    {formatTime(r.checkInTime)} <LocationBadge type={r.checkInLocationType} />
                  </td>
                  <td>
                    {formatTime(r.checkOutTime)} <LocationBadge type={r.checkOutLocationType} />
                  </td>
                  <td>{STATUS_LABEL[r.status] || r.status || "--"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: "center" }}>
                  No attendance records for this date yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <small>
          Staff who haven't checked in yet (or are on leave, before the nightly sweep runs) won't appear here until they do.
        </small>
      </div>

      {currentUser.role === "SUPER_ADMIN" && (
        <div className="attendance-roster-card">
          <div className="attendance-roster-header">
            <h2 className="section-title">Employee Attendance Calendar</h2>
            <select
              value={selectedCalendarUserId}
              onChange={(e) => setSelectedCalendarUserId(e.target.value)}
            >
              <option value="">Select Employee</option>
              {attendanceUsers.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.name} ({u.userId})
                </option>
              ))}
            </select>
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

      <AdminLeaveDashboard />
    </div>
  );
};

export default TeamAttendanceLeave;
