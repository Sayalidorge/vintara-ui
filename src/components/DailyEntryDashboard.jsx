// src/components/DailyEntryDashboard.jsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import config from "../config";
import "../css/theme.css";
import "../css/components.css";
import "./DailyEntryDashboard.css";
import { toLocalDateStr } from "../utils/date";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";

// Set via the `styles` prop (real inline styles) instead of CSS classes:
// the .react-select__* class names are already fought over by five other
// stylesheets in this app at the same specificity, so plain CSS overrides
// here would keep losing an unpredictable cascade battle against
// react-select's own runtime-injected styles. Also needs menuPortalTarget
// (below, on the <Select>) - this sits in a filter row that stacks into a
// column on mobile, the same layout that let a sibling filter paint over an
// unportaled resort dropdown on the Inventory page.
const statusSelectStyles = themedSelectStyles({
  control: (base) => ({
    ...base,
    minHeight: 40,
    height: 40,
    borderRadius: 6,
    fontWeight: 600,
    cursor: "pointer",
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
});

// Display-only: strips any country code, showing just the last 10 digits -
// stored contactNo is left untouched, this only affects what's rendered.
const last10Digits = (contactNo) => {
  if (!contactNo) return contactNo;
  const digitsOnly = contactNo.replace(/\D/g, "");
  return digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
};

// Compact variant for the per-row status editor inside the table - the
// filter-row sizing above is too tall for a table cell. menuPortalTarget is
// mandatory here too: unportaled, the menu would be clipped by
// .table-wrapper's overflow-x:auto on every row but the last few.
const rowStatusSelectStyles = themedSelectStyles({
  control: (base) => ({
    ...base,
    minHeight: 32,
    height: 32,
    fontSize: 13,
  }),
  valueContainer: (base) => ({
    ...base,
    height: 32,
    padding: "0 8px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: 32,
  }),
  indicatorSeparator: () => ({ display: "none" }),
});

const DailyEntryDashboard = () => {
  const { toasts, showToast, dismissToast } = useToast();
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

  const statusSelectOptions = [
    { value: "ALL", label: "All Statuses" },
    ...sortedStatusEntries.map(([key, label]) => ({
      value: key,
      label,
    })),
  ];
  const selectedStatusOption =
    statusSelectOptions.find((opt) => opt.value === status) || null;

  // Same list, minus "All Statuses" - used by each row's own status editor,
  // which only ever needs to set one real status, never the filter's "ALL".
  const rowStatusOptions = sortedStatusEntries.map(([key, label]) => ({
    value: key,
    label,
  }));

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

    // Status filter: default OPEN, "ALL" clears the filter server-side
    if (status === "ALL") {
      url += `&status=`;
    } else if (status) {
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
    // Backend returns no guaranteed order - sort newest first, same as
    // ViewBookingEnquiry.jsx's admin equivalent of this same endpoint.
    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    setEntries(sorted);
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
    showToast("Failed to update status.", "danger");
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
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="vt-page-header">
        <h2>Daily Enquiries</h2>
        <button
          className="record-entry-btn"
          onClick={() => navigate("/user/record-daily-entry")}
        >
          + Record Entry
        </button>
      </div>

      {/* Filters */}
      <div className="dashboard-filters">
        <label>Status</label>
        <Select
          className="status-filter-select"
          styles={statusSelectStyles}
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPosition}
          options={statusSelectOptions}
          value={selectedStatusOption}
          onChange={(opt) => setStatus(opt.value)}
          isSearchable={false}
        />

        <label>From Date</label>
        <DatePicker
  selected={fromDate}
  onChange={(date) => setFromDate(date)}
  dateFormat="dd/MM/yyyy"
  placeholderText="Select Date(Optional)"
  openToDate={new Date()}   // 👈 shows current month
  className="date-picker"
/>

        <label>To Date</label>
        <DatePicker
          selected={toDate}
          onChange={(date) => setToDate(date)}
          dateFormat="dd/MM/yyyy"
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
                  <td>{last10Digits(entry.contactNo)}</td>
                  <td>{entry.preferredLocation}</td>
                  <td>{entry.propertyName}</td>
                  <td>{entry.noOfPeople}</td>
                  <td>{entry.source}</td>

                  <td className="status-dropdown-cell">
                    <Select
                      className="status-dropdown"
                      classNamePrefix="react-select"
                      styles={rowStatusSelectStyles}
                      menuPortalTarget={menuPortalTarget}
                      menuPosition={menuPosition}
                      options={rowStatusOptions}
                      value={rowStatusOptions.find((o) => o.value === entry.status) || null}
                      onChange={(selected) => handleStatusChange(entry.id, selected.value)}
                      isSearchable={false}
                    />
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