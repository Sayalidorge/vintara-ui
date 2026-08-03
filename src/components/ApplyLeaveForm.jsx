// src/components/ApplyLeaveForm.jsx
import React, { useState, useEffect } from "react";

const ApplyLeaveForm = ({ baseBalance = 1, history = [], onLeaveApplied }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState(""); // State for leave reason text box
  const [totalDays, setTotalDays] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const pendingDays = history
    .filter(item => item.status === "PENDING" && (item.type === "PRIVILAGE_LEAVE" || item.type === "PAID"))
    .reduce((sum, item) => sum + Number(item.days || 0), 0);

  const dynamicAvailableBalance = baseBalance - pendingDays;

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const sDate = new Date(start);
    const eDate = new Date(end);
    if (eDate < sDate) return 0;
    return Math.ceil((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    setEndDate(e.target.value); 
  };

  useEffect(() => {
    const days = calculateDays(startDate, endDate);
    setTotalDays(days);

    if (days > dynamicAvailableBalance) {
      if (dynamicAvailableBalance <= 0) {
        setErrorMessage(`❌ Submission Blocked: You have ${pendingDays} day(s) currently PENDING approval.`);
      } else {
        setErrorMessage(`❌ Insufficient Balance! True remaining balance is only ${dynamicAvailableBalance} day(s).`);
      }
    } else {
      setErrorMessage("");
    }
  }, [startDate, endDate, dynamicAvailableBalance, pendingDays]);

  const getMaxEndDate = () => {
    if (!startDate || dynamicAvailableBalance <= 0) return startDate;
    const start = new Date(startDate);
    start.setDate(start.getDate() + (dynamicAvailableBalance - 1));
    return start.toISOString().split("T")[0];
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (totalDays <= dynamicAvailableBalance && onLeaveApplied) {
      console.log("Submitting with reason:", reason); // This payload variable now holds your textbox string data
      onLeaveApplied();
    }
  };

  return (
    <div style={{ padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
      <h3 style={{ margin: "0 0 10px 0", color: "#34495e" }}>Apply for Leave</h3>
      
      <div style={{ marginBottom: "20px", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "6px", fontSize: "13px" }}>
        Available Balance: <strong style={{ color: "#2ecc71" }}>{dynamicAvailableBalance} Day(s)</strong>
        <span style={{ display: "block", color: "#95a5a6", fontSize: "11px", marginTop: "4px" }}>
          (Total Accrued: {baseBalance} | Pending In Pipeline: {pendingDays})
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>Start Date</label>
          <input type="date" value={startDate} onChange={handleStartDateChange} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }} />
        </div>
        
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>End Date</label>
          <input 
            type="date" 
            value={endDate} 
            min={startDate} 
            max={getMaxEndDate()} 
            onChange={(e) => setEndDate(e.target.value)} 
            disabled={!startDate || dynamicAvailableBalance <= 0} 
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }} 
          />
        </div>

        {/* NEW: Text area input container box to input reasoning */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>Reason for Leave</label>
          <textarea 
            value={reason} 
            onChange={(e) => setReason(e.target.value)} 
            placeholder="Please specify a reason (e.g., medical, vacation...)"
            rows="3"
            required
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {totalDays > 0 && (
          <div style={{ padding: "10px", background: "#e8f4fd", borderLeft: "4px solid #3498db", color: "#2c3e50", marginBottom: "15px", fontSize: "14px", fontWeight: "500" }}>
            Total Applied Duration: <strong>{totalDays} Day(s)</strong>
          </div>
        )}

        {errorMessage && <div style={{ color: "#e74c3c", fontSize: "12px", marginBottom: "15px", fontWeight: "500" }}>{errorMessage}</div>}
        
        <button type="submit" disabled={totalDays === 0 || totalDays > dynamicAvailableBalance} style={{ width: "100%", padding: "10px", background: (totalDays > dynamicAvailableBalance || totalDays === 0) ? "#bdc3c7" : "#2ecc71", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
          Submit Leave Request
        </button>
      </form>
    </div>
  );
};

export default ApplyLeaveForm;