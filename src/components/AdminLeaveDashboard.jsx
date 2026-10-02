// src/components/AdminLeaveDashboard.jsx
import React, { useEffect, useState } from "react";
import Select from "react-select";
import { getAttendanceEligibleUsers, getAllLeaveRequests, approveLeave, rejectLeave } from "../services/LeaveService";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";
import "../css/theme.css";
import "../css/components.css";
import "./AdminLeaveDashboard.css";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const AdminLeaveDashboard = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  // Mirrors the backend hierarchy rule in LeaveService.assertCanActOnLeave:
  // nobody can approve their own leave, and only SUPER_ADMIN can act on a
  // SUPER_USER's leave request.
  const canActOn = (leave) => {
    if (leave.userId === currentUser.userId) return false;
    if (leave.userRole === "SUPER_USER" && currentUser.role !== "SUPER_ADMIN") return false;
    return true;
  };

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING"); // default filter
  const [userIdFilter, setUserIdFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  // Per-row guard against double-click/slow-network double-submits on
  // Approve/Reject - a Set of leave-request ids currently being acted on.
  const [actingOnIds, setActingOnIds] = useState(new Set());

  // fetch users - USER + SUPER_USER only, matching the sibling dropdown in
  // TeamAttendanceLeave.jsx which already uses this endpoint.
useEffect(() => {
  const fetchUsers = async () => {
    try {
      const data = await getAttendanceEligibleUsers();
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setUsers([]);
    }
  };

  fetchUsers();
}, []);

  // Fetch leaves based on filters
  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const data = await getAllLeaveRequests({
        status: statusFilter || null,
        userId: userIdFilter || null,
      });
      setLeaveRequests(data || []);
    } catch (error) {
      console.error(error);
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [statusFilter, userIdFilter]);

  const handleApprove = async (id) => {
    if (actingOnIds.has(id)) return;
    setActingOnIds((prev) => new Set(prev).add(id));
    try {
      await approveLeave(id);
      fetchLeaves();
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

  const handleReject = async (id) => {
    if (actingOnIds.has(id)) return;
    setActingOnIds((prev) => new Set(prev).add(id));
    try {
      await rejectLeave(id);
      fetchLeaves();
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

  const handleResetFilters = () => {
    setStatusFilter("PENDING");
    setUserIdFilter("");
  };

  const userOptions = [
    { value: "", label: "All Users" },
    ...users.map((user) => ({ value: user.userId, label: `${user.name} (${user.userId})` })),
  ];

  return (
    <div className="admin-leave-dashboard">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {loading && <div className="loading-overlay">Loading...</div>}

      <div className="attendance-roster-header">
        <h2 className="section-title">Admin Leave Dashboard</h2>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <label>Status:</label>
        <Select
          options={STATUS_OPTIONS}
          value={STATUS_OPTIONS.find((o) => o.value === statusFilter)}
          onChange={(selected) => setStatusFilter(selected.value)}
          isSearchable={false}
          classNamePrefix="react-select"
          className="react-select-container filter-select"
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPosition}
          styles={themedSelectStyles()}
        />

        <label>User:</label>
        <Select
          options={userOptions}
          value={userOptions.find((o) => o.value === userIdFilter)}
          onChange={(selected) => setUserIdFilter(selected ? selected.value : "")}
          isSearchable={false}
          classNamePrefix="react-select"
          className="react-select-container filter-select"
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPosition}
          styles={themedSelectStyles()}
        />

        <button className="vt-btn vt-btn-purple" onClick={handleResetFilters}>
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="admin-leave-table">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
              <th>Days</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Approved By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveRequests.length > 0 ? (
              leaveRequests.map((l) => (
                <tr key={l.id}>
                  <td>{l.userName || l.userId}</td>
                  <td>{l.type}</td>
                  <td>{l.startDate}</td>
                  <td>{l.endDate}</td>
                  <td>{l.leaveDays}{l.halfDay ? " (Half Day)" : ""}</td>
                  <td>{l.reason}</td>
                  <td
                    className={
                      l.status === "APPROVED"
                        ? "status-approved"
                        : l.status === "REJECTED"
                        ? "status-rejected"
                        : "status-pending"
                    }
                  >
                    {l.status}
                  </td>
                  <td>{l.approvedBy || "--"}</td>
                  <td>
                    {l.status === "PENDING" && (
                      canActOn(l) ? (
                        <>
                          <button
                            className="btn-approve"
                            onClick={() => handleApprove(l.id)}
                            disabled={actingOnIds.has(l.id)}
                          >
                            {actingOnIds.has(l.id) ? "..." : "Approve"}
                          </button>
                          <button
                            className="btn-reject"
                            onClick={() => handleReject(l.id)}
                            disabled={actingOnIds.has(l.id)}
                          >
                            {actingOnIds.has(l.id) ? "..." : "Reject"}
                          </button>
                        </>
                      ) : (
                        <span className="leave-action-hint">
                          {l.userRole === "SUPER_USER"
                            ? "Requires Super Admin"
                            : "Not actionable"}
                        </span>
                      )
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" style={{ textAlign: "center" }}>
                  No leave requests found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminLeaveDashboard;
