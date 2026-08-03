// src/components/DailyEntryDashboard.jsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import config from "../config";
import "./DailyEntryDashboard.css";

const DailyEntryDashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("OPEN");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusOptions, setStatusOptions] = useState({});

  // -----------------------------------
  // Fetch filtered daily enquiries
  // -----------------------------------
 const fetchEntries = async () => {
  if (!user?.userId) {
    console.error("User not found");
    return;
  }

  setLoading(true);

  try {
    // Base URL with user
    let url = `${config.BASE_URL}/api/booking-enquiry/filtered?createdBy=${user.userId}`;

    // Status filter: default OPEN, override if dropdown changed
    if (status) {
      url += `&status=${status}`;
    } else {
      url += `&status=OPEN`;
    }

    // Only add date filters if a date is selected
    if (fromDate) {
      url += `&fromDate=${fromDate.toISOString().split("T")[0]}`;
    }
    if (toDate) {
      url += `&toDate=${toDate.toISOString().split("T")[0]}`;
    }

    const res = await fetch(url, { headers: config.getHeaders() });
    if (!res.ok) throw new Error("Failed to fetch daily entries");

    const data = await res.json();
    setEntries(data);
  } catch (err) {
    console.error("Error fetching daily entries:", err);
    setEntries([]);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchEntries();
  }, [status, fromDate, toDate]);

  useEffect(() => {
  const fetchDropdownData = async () => {
    try {
      const res = await fetch(
        `${config.BASE_URL}/api/drop-down/booking-enquiry`,
        { headers: config.getHeaders() }
      );

      if (!res.ok) throw new Error("Failed to fetch dropdown data");

      const data = await res.json();
      setStatusOptions(data.bookingStatuses || {});
    } catch (err) {
      console.error("Dropdown fetch error:", err);
    }
  };

  fetchDropdownData();
}, []);
  // -----------------------------------
  // Update status inline
  // -----------------------------------
// Inside component
const handleStatusChange = async (id, newStatus) => {
  try {
    await fetch(`${config.BASE_URL}/api/booking-enquiry/update-status/${id}?status=${newStatus}`, {
      method: "PUT",
      headers: config.getHeaders(),
    });
    // Optionally: update state locally to reflect change instantly
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
    );
  } catch (err) {
    console.error("Error updating status:", err);
    alert("Failed to update status.");
  }
};

  const resetFilters = () => {
    setStatus("OPEN");
    setFromDate(null);
    setToDate(null);
  };

 const handleEdit = (entry) => {
  navigate("/user/record-daily-entry", {
    state: { dailyEntryToEdit: { ...entry, enquiries: [entry] } },
  });
};

  return (
    <>
      {/* Header */}
<div className="page-header">
  <h2>Daily Enquiries</h2>
</div>
        <button
          className="record-entry-btn"
          onClick={() => navigate("/user/record-daily-entry")}
        >
          + Record Entry
        </button>
     

      {/* Filters */}
      <div className="dashboard-filters">
        <label>Status</label>
   <select value={status} onChange={(e) => setStatus(e.target.value)}>
  {Object.entries(statusOptions).map(([key, label]) => (
    <option key={key} value={key}>
      {label}
    </option>
  ))}
</select>

        <label>From Date</label>
        <DatePicker
  selected={fromDate}
  onChange={(date) => setFromDate(date)}
  dateFormat="yyyy-MM-dd"
  placeholderText="Select Date(Optional)"
  openToDate={new Date()}   // 👈 shows current month
  className="date-picker"
/>

        <label>To Date</label>
        <DatePicker
          selected={toDate}
          onChange={(date) => setToDate(date)}
          dateFormat="yyyy-MM-dd"
          placeholderText="Select Date(Optional)"
          className="date-picker"
        />

        <button onClick={resetFilters} className="reset-filters-btn">
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="daily-entries-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Location</th>
              <th>Property</th>
              <th>People</th>
              <th>Source</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9">Loading...</td>
              </tr>
            ) : entries.length > 0 ? (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.name}</td>
                  <td>{entry.contactNo}</td>
                  <td>{entry.preferredLocation}</td>
                  <td>{entry.propertyName}</td>
                  <td>{entry.noOfPeople}</td>
                  <td>{entry.source}</td>

                  <td>                
  <select
    className="status-dropdown"
    value={entry.status}
    onChange={(e) => handleStatusChange(entry.id, e.target.value)}
  >
    {Object.entries(statusOptions).map(([key, label]) => (
      <option key={key} value={key}>
        {label}
      </option>
    ))}
  </select>
</td>
                  <td>
                    {entry.date ? new Date(entry.date).toLocaleString() : "-"}
                  </td>

                  <td>
                    <button
                      className="edit-btn"
                      onClick={() => handleEdit(entry)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9">No daily enquiries found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default DailyEntryDashboard;