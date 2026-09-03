// src/components/AdminLeaveDashboard.jsx
import React, { useEffect, useState } from "react";
import { getAttendanceEligibleUsers, getAllLeaveRequests, approveLeave, rejectLeave } from "../services/LeaveService";
import "./AdminLeaveDashboard.css";

const AdminLeaveDashboard = () => {
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
    try {
      await approveLeave(id);
      fetchLeaves();
    } catch (err) {
      alert(err.message || "Failed to approve.");
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectLeave(id);
      fetchLeaves();
    } catch (err) {
      alert(err.message || "Failed to reject.");
    }
  };

  const handleResetFilters = () => {
    setStatusFilter("PENDING");
    setUserIdFilter("");
  };

  return (
    <div className="page-container admin-leave-dashboard">
      {loading && <div className="loading-overlay">Loading...</div>}

      <div className="attendance-roster-header">
        <h2 className="section-title">Admin Leave Dashboard</h2>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <label>Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <label>User:</label>
<select
  value={userIdFilter}
  onChange={(e) => setUserIdFilter(e.target.value)}
>
  <option value="">All Users</option>
  {users.map((user) => (
    <option key={user.userId} value={user.userId}>
      {user.name} ({user.userId})
    </option>
  ))}
</select>

        <button className="btn-reset" onClick={handleResetFilters}>
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
                  <td>{l.leaveDays}</td>
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
                          >
                            Approve
                          </button>
                          <button
                            className="btn-reject"
                            onClick={() => handleReject(l.id)}
                          >
                            Reject
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