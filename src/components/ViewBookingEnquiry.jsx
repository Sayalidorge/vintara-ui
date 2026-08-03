
import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";
import config from "../config";
import "./ViewBookingEnquiry.css";

const ViewBookingEnquiry = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [fromDate, setFromDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30))
  );
  const [toDate, setToDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [userFilter, setUserFilter] = useState(""); // admin can enter user id
  const [bookingStatuses, setBookingStatuses] = useState({});
  
  const formatDateTime = (dateString) => {
  return new Date(dateString).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

  // Fetch status dropdown
 useEffect(() => {
  const fetchDropdownValues = async () => {
    const res = await fetch(`${config.BASE_URL}/api/drop-down/booking-enquiry`, {
      headers: config.getHeaders(),
    });
    const data = await res.json();
    setBookingStatuses(data.bookingStatuses || {}); // ensure it's an object
  };
  fetchDropdownValues();
}, []);

  // Fetch entries whenever filters change
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        let url = `${config.BASE_URL}/api/booking-enquiry/admin/filtered?status=${statusFilter}`;
        if (fromDate) url += `&fromDate=${fromDate.toISOString().split("T")[0]}`;
        if (toDate) url += `&toDate=${toDate.toISOString().split("T")[0]}`;
        if (userFilter) url += `&userId=${userFilter}`;

        const res = await fetch(url, { headers: config.getHeaders() });
        if (!res.ok) throw new Error("Failed to fetch entries");

        const data = await res.json();

         console.log("Backend returned data:", data);
        const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
        setEntries(sorted);
      } catch (err) {
        console.error(err);
        setEntries([]);
      }
    };
    fetchEntries();
  }, [statusFilter, fromDate, toDate, userFilter]);

  // Reset filters
  const resetFilters = () => {
    setFromDate(new Date(new Date().setDate(new Date().getDate() - 30)));
    setToDate(new Date());
    setStatusFilter("Open");
    setUserFilter("");
  };

  
  return (
    <>
      {/* Header */}

      <div className="page-header">
  <h2>Booking Enquiries</h2>
</div>

      {/* Filters */}
      <div className="dashboard-filters">
        <label>From Date</label>
        <DatePicker
          selected={fromDate}
          onChange={(date) => setFromDate(date)}
          dateFormat="yyyy-MM-dd"
          className="date-picker"
        />

        <label>To Date</label>
        <DatePicker
          selected={toDate}
          onChange={(date) => setToDate(date)}
          dateFormat="yyyy-MM-dd"
          className="date-picker"
        />

       <label>Status</label>
<select
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value)}
>
  {/* Ensure Open always exists */}
  <option value="OPEN">Open</option>
  {Object.entries(bookingStatuses).map(([key, value]) => (
    <option key={key} value={key}>{value}</option>
  ))}
</select>



       {/* User Dropdown derived from entries */}
<label>User</label>
<select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
  <option value="">All Users</option>
  {[...new Set(entries.map((entry) => entry.createdBy))].map((userId) => (
    <option key={userId} value={userId}>
      {userId}
    </option>
  ))}
</select>

        <button className="reset-filters-btn" onClick={resetFilters}>
          Reset Filters
        </button>
      </div>

      {/* Entries Table */}
      <div className="table-wrapper">
        <table className="daily-entries-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Customer Name</th>
              <th>Contact No</th>
              <th>Preferred Location</th>
              <th>Property Name</th>
              <th>No. of People</th>
              <th>Status</th>
              <th>Source</th>
              <th>Feedback</th>
              <th>Edited At</th>
            </tr>
          </thead>
          <tbody>
            {entries.length > 0 ? (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.date)}</td>
                  <td>{entry.createdBy}</td>
                  <td>{entry.name}</td>
                  <td>{entry.contactNo}</td>
                  <td>{entry.preferredLocation}</td>
                  <td>{entry.propertyName}</td>
                  <td>{entry.noOfPeople}</td>
                  <td>{entry.status}</td>
                  <td>{entry.source}</td>
                  <td>{entry.feedback}</td>
                  <td>{entry.editedAt}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="11">No entries found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default ViewBookingEnquiry;
