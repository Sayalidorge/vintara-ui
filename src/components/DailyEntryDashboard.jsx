// src/components/DailyEntryDashboard.jsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import config from "../config";
import "./DailyEntryDashboard.css";
import { toLocalDateStr } from "../utils/date";

// Set via the `styles` prop (real inline styles) instead of CSS classes:
// the .react-select__* class names are already fought over by five other
// stylesheets in this app at the same specificity, so plain CSS overrides
// here would keep losing an unpredictable cascade battle against
// react-select's own runtime-injected styles.
const statusSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    height: 40,
    borderRadius: 6,
    borderColor: state.isFocused ? "var(--primary-purple)" : "#ccc",
    boxShadow: "none",
    fontWeight: 600,
    cursor: "pointer",
    ":hover": {
      borderColor: "var(--primary-purple)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    height: 40,
    padding: "0 14px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: 40,
  }),
  indicatorSeparator: () => ({ display: "none" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--primary-purple)"
      : state.isFocused
      ? "#f3e6f5"
      : "#fff",
    color: state.isSelected ? "#fff" : "#333",
    cursor: "pointer",
  }),
};

const DailyEntryDashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("OPEN");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusOptions, setStatusOptions] = useState({});

  // OPEN is the default filter, so list it first — on macOS, native <select>
  // menus align the selected option over the box, pushing everything above
  // it upward; keeping the default last in the list made the menu pop up.
  const sortedStatusEntries = Object.entries(statusOptions).sort(
    ([a], [b]) => (a === "OPEN" ? -1 : b === "OPEN" ? 1 : 0)
  );

  const statusSelectOptions = sortedStatusEntries.map(([key, label]) => ({
    value: key,
    label,
  }));
  const selectedStatusOption =
    statusSelectOptions.find((opt) => opt.value === status) || null;

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
      url += `&fromDate=${toLocalDateStr(fromDate)}`;
    }
    if (toDate) {
      url += `&toDate=${toLocalDateStr(toDate)}`;
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
    <div className="daily-entries-page">
      {/* Header */}
<div className="page-header">
  <h2 style={{ fontSize: "23px", fontWeight: 700, color: "var(--primary-purple)", textAlign: "left", marginTop: "6px", marginBottom: "16px" }}>Daily Enquiries</h2>
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
        <Select
          className="status-filter-select"
          styles={statusSelectStyles}
          options={statusSelectOptions}
          value={selectedStatusOption}
          onChange={(opt) => setStatus(opt.value)}
          isSearchable={false}
        />

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
                    {entry.date
                      ? new Date(entry.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "numeric",
                          year: "numeric",
                        })
                      : "-"}
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
    </div>
  );
};

export default DailyEntryDashboard;