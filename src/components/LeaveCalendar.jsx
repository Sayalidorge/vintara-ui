// src/components/LeaveCalendar.jsx
import React, { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { getLeaveRequestsForMonth } from "../services/LeaveService";
import "./LeaveCalendar.css";

const LeaveCalendar = ({ adminView = false, userId, onDayClick }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    // Extract month and year safely inside the effect hook
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    async function fetchLeaves() {
      try {
        const data = adminView
          ? await getLeaveRequestsForMonth(year, month)
          : await getLeaveRequestsForMonth(userId, year, month);
        
        // Ensure data is always an array to prevent .filter crashes
        setLeaveRequests(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch leave records:", error);
        setLeaveRequests([]);
      }
    }
    
    fetchLeaves();
  }, [userId, date, adminView]); // Removed redundant month/year parameters to completely avoid state rendering loops

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
    }
    return "";
  };

  return (
    <div className="leave-calendar-container">
      <h2 className="page-title">
        {adminView ? "Leave Calendar (Admin)" : "My Leave Calendar"}
      </h2>
      
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

          tileClassName={({ date: tileDate, view }) => view === "month" && getTileClassName(tileDate)}
          onClickDay={onDayClick}
        />
      </div>

      {/* Structured flex legend layout elements to line up perfectly beneath the main grid */}
      <div className="leave-legend">
        <div className="legend-item">
          <span className="legend-box leave-paid"></span>
          <span>Paid Leave</span>
        </div>
        <div className="legend-item">
          <span className="legend-box leave-unpaid"></span>
          <span>Unpaid Leave</span>
        </div>
        <div className="legend-item">
          <span className="legend-box leave-wfh"></span>
          <span>WFH</span>
        </div>
      </div>
    </div>
  );
};

export default LeaveCalendar;