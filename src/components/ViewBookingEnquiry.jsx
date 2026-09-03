
import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";
import config from "../config";
import "./ViewBookingEnquiry.css";
import { toLocalDateStr } from "../utils/date";

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
  const [userOptions, setUserOptions] = useState([]);
  
  // DD/MM/YYYY, hh:mm AM/PM - built manually (not via toLocaleString) so the
  // format is identical across browsers regardless of locale defaults.
  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    let hours = d.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const hoursStr = String(hours).padStart(2, "0");
    return `${day}/${month}/${year}, ${hoursStr}:${minutes} ${ampm}`;
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

  // Fetch User + Super User accounts for the User filter dropdown, rather
  // than deriving options from whatever createdBy values happen to appear
  // in the currently loaded (date/status-filtered) entries.
  useEffect(() => {
    const fetchUserOptions = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/users/attendance-users`, {
          headers: config.getHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch users");
        const data = await res.json();
        setUserOptions(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUserOptions();
  }, []);

  // Fetch entries whenever filters change
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        let url = `${config.BASE_URL}/api/booking-enquiry/admin/filtered?status=${statusFilter}`;
        if (fromDate) url += `&fromDate=${toLocalDateStr(fromDate)}`;
        if (toDate) url += `&toDate=${toLocalDateStr(toDate)}`;
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
    setStatusFilter("OPEN");
    setUserFilter("");
  };

  
  return (
    <>
      {/* Header */}

      <div className="page-header">
  <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary-teal)", textAlign: "left", marginTop: "6px", marginBottom: "20px" }}>Booking Enquiries</h2>
</div>

      {/* Filters */}
      <div className="dashboard-filters">
        <div className="filter-item">
          <label>From Date</label>
          <DatePicker
            selected={fromDate}
            onChange={(date) => setFromDate(date)}
            dateFormat="yyyy-MM-dd"
            className="date-picker"
          />
        </div>

        <div className="filter-item">
          <label>To Date</label>
          <DatePicker
            selected={toDate}
            onChange={(date) => setToDate(date)}
            dateFormat="yyyy-MM-dd"
            className="date-picker"
          />
        </div>

        <div className="filter-item">
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
        </div>

        {/* User Dropdown: all User + Super User accounts, not just ones with entries in view */}
        <div className="filter-item">
          <label>User</label>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">All Users</option>
            {userOptions.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label style={{ visibility: "hidden" }}>Reset</label>
          <button className="reset-filters-btn" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>
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
                  <td>{entry.editedAt ? formatDateTime(entry.editedAt) : "-"}</td>
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
