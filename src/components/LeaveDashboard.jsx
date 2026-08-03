// src/pages/LeaveDashboard.jsx
import React from "react";
import LeaveCalendar from "../components/LeaveCalendar";
import ApplyLeaveForm from "../components/ApplyLeaveForm";

const LeaveDashboard = () => {
  // Mock data representing your history table entries
  const leaveHistory = [
    { type: "PRIVILAGE_LEAVE", startDate: "2026-06-05", endDate: "2026-06-05", days: 1, status: "APPROVED" },
    { type: "PRIVILAGE_LEAVE", startDate: "2026-06-13", endDate: "2026-06-15", days: 3, status: "PENDING" }
  ];

  return (
    <div style={{ display: "flex", gap: "30px", padding: "30px", flexWrap: "wrap" }}>
      {/* Column 1: The Interactive Month Calendar Grid */}
      <div style={{ flex: "2", minWidth: "350px" }}>
        <LeaveCalendar userId="user123" />
      </div>

      {/* Column 2: The Secure Booking Input Form Field Card */}
      <div style={{ flex: "1", minWidth: "300px" }}>
        <ApplyLeaveForm baseBalance={1} history={leaveHistory} />
      </div>
    </div>
  );
};

export default LeaveDashboard;