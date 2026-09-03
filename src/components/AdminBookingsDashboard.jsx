import { useState, useEffect } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../css/theme.css";
import "./AdminBookingsDashboard.css";
import config from "../config";
import { toLocalDateStr } from "../utils/date";
import { downloadCsv } from "../utils/csv";
import { isSuperAdmin } from "../utils/auth";

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusBadgeColors = (status) => {
  if (status === "CHECKED_IN") return { background: "#d4edda", color: "#155724" };
  if (status === "CANCELLED" || status === "EARLY_CHECK_OUT") return { background: "#f8d7da", color: "#721c24" };
  return { background: "#fff3cd", color: "#856404" };
};

const AdminBookingsDashboard = () => {
  const [resorts, setResorts] = useState([]);
  const [selectedResort, setSelectedResort] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(null);
  const contactVisible = isSuperAdmin();

  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const res = await fetch(
          `${config.BASE_URL}/api/resorts/resort-names-drop-down`,
          { headers: config.getHeaders() }
        );
        const data = await res.json();
        const options = data.map((r) => ({ value: r.id, label: r.name }));
        setResorts(options);
        if (options.length > 0) setSelectedResort(options[0]);
      } catch (err) {
        console.error(err);
        setResorts([]);
        setSelectedResort(null);
      }
    };
    fetchResorts();
  }, []);

  useEffect(() => {
    if (!selectedResort) return setBookings([]);
    const fetchBookings = async () => {
      try {
        // This page shows/exports every filtered booking rather than paging
        // through a UI table, so request a generously large page instead of
        // relying on the endpoint's default (20) - GET /api/bookings?resortId=
        // returns a paginated {content, totalElements, ...} object now, not
        // a plain array.
        let url = `${config.BASE_URL}/api/bookings?resortId=${selectedResort.value}&page=0&size=1000`;
        if (fromDate) url += `&fromDate=${toLocalDateStr(fromDate)}`;
        if (toDate) url += `&toDate=${toLocalDateStr(toDate)}`;
        const res = await fetch(url, { headers: config.getHeaders() });
        const data = await res.json();
        const content = data.content || [];
        setBookings(content.sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate)));
      } catch (err) {
        console.error(err);
        setBookings([]);
      }
    };
    fetchBookings();
  }, [selectedResort, fromDate, toDate]);

  const resetFilters = () => {
    setSelectedResort(resorts.length > 0 ? resorts[0] : null);
    setFromDate(new Date());
    setToDate(null);
  };

  const roomsFor = (b) =>
    b.bookingItems?.length
      ? b.bookingItems.map((item) => item.roomNumbers?.join(", ")).join(" | ")
      : "-";

  const exportBookings = () => {
    const resortLabel = selectedResort ? selectedResort.label : "all-resorts";
    const rows = bookings.map((b) => ({ ...b, rooms: roomsFor(b), resortName: resortLabel }));
    downloadCsv(
      `bookings_${resortLabel}_${toLocalDateStr(fromDate)}.csv`,
      rows,
      [
        { key: "id", header: "ID" },
        { key: "customerName", header: "Customer" },
        { key: "customerContactNumber", header: "Contact" },
        { key: "customerEmail", header: "Email" },
        { key: "checkInDate", header: "Check-In" },
        { key: "checkOutDate", header: "Check-Out" },
        { key: "numberOfNights", header: "Nights" },
        { key: "adults", header: "Adults" },
        { key: "kids", header: "Kids" },
        { key: "totalAmount", header: "Total Amount" },
        { key: "advanceAmount", header: "Advance" },
        { key: "balanceAmount", header: "Balance" },
        { key: "gstPercentage", header: "GST %" },
        { key: "gstAmount", header: "GST Amount" },
        { key: "source", header: "Source" },
        { key: "rooms", header: "Rooms" },
        { key: "status", header: "Status" },
        { key: "createdByUser", header: "Created By" },
        { key: "transactionId", header: "Transaction ID" },
        { key: "otaCommission", header: "OTA Commission" },
        { key: "totalFoodAmount", header: "Food Total" },
        { key: "advanceFoodAmount", header: "Food Advance" },
        { key: "foodBalanceAmount", header: "Food Balance" },
        { key: "remarks", header: "Remarks" },
        { key: "resortName", header: "Resort" },
      ]
    );
  };

  // Sums for the footer row - only the genuinely additive money columns.
  // Nights/Adults/GST % etc. aren't included: summing a percentage or a
  // headcount across bookings with different date ranges isn't meaningful.
  const sum = (fn) => bookings.reduce((total, b) => total + (fn(b) || 0), 0);
  const totals = {
    totalAmount: sum((b) => b.totalAmount),
    advanceAmount: sum((b) => b.advanceAmount),
    balanceAmount: sum((b) => b.balanceAmount),
    gstAmount: sum((b) => b.gstAmount),
    otaCommission: sum((b) => b.otaCommission),
    totalFoodAmount: sum((b) => (b.foodPreorder ? b.totalFoodAmount : 0)),
    advanceFoodAmount: sum((b) => (b.foodPreorder ? b.advanceFoodAmount : 0)),
    foodBalanceAmount: sum((b) => (b.foodPreorder ? b.foodBalanceAmount : 0)),
  };
  const money = (n) => `₹${n.toLocaleString()}`;

  return (
    <div className="admin-bookings-dashboard">
      <div className="page-header">
        <h2 style={{ fontSize: "23px", fontWeight: 700, color: "var(--text-dark)", textAlign: "left" }}>
          Bookings
        </h2>
      </div>

      {/* Filters */}
      <div className="dashboard-filters">
        <div className="filter-item">
          <label>Resort</label>
          <Select
            options={resorts}
            value={selectedResort}
            onChange={setSelectedResort}
            placeholder="Select resort..."
            isDisabled={resorts.length === 0}
            classNamePrefix="react-select"
            className="react-select-container"
          />
        </div>
        <div className="filter-item">
          <label>From Date</label>
          <DatePicker
            selected={fromDate}
            onChange={setFromDate}
            dateFormat="dd-MM-yyyy"
            className="date-picker"
            portalId="datepicker-portal"
          />
        </div>
        <div className="filter-item">
          <label>To Date</label>
          <DatePicker
            selected={toDate}
            onChange={setToDate}
            dateFormat="dd-MM-yyyy"
            placeholderText="Optional"
            className="date-picker"
            portalId="datepicker-portal"
          />
        </div>
        <div className="filter-item">
          <label style={{ visibility: "hidden" }}>Reset</label>
          <button onClick={resetFilters} className="reset-filters-btn">
            Reset
          </button>
        </div>
        {isSuperAdmin() && (
          <div className="filter-item">
            <label style={{ visibility: "hidden" }}>Export</label>
            <button onClick={exportBookings} className="export-csv-btn">
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="bookings-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              {contactVisible && <th>Contact</th>}
              {contactVisible &&<th>Email</th>}
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Nights</th>
              <th>Adults</th>
              <th>Kids</th>
              <th>Total</th>
              <th>Advance</th>
              <th>Balance</th>
              <th>GST %</th>
              <th>GST Amount</th>
              <th>Source</th>
              <th>Rooms</th>
              <th>Status</th>
              <th>Created By</th>
              <th>Transaction ID</th>
              <th>OTA Commission</th>
              <th>Food Total</th>
              <th>Food Advance</th>
              <th>Food Balance</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length > 0 ? (
              bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.customerName}</td>
                  {contactVisible && <td>{b.customerContactNumber}</td>}
                  {contactVisible &&<td>{b.customerEmail || "-"}</td>}
                  <td>{formatDate(b.checkInDate)}</td>
                  <td>{formatDate(b.checkOutDate)}</td>
                  <td>{b.numberOfNights}</td>
                  <td>{b.adults ?? 0}</td>
                  <td>{b.kids ?? 0}</td>
                  <td>{b.totalAmount}</td>
                  <td>{b.advanceAmount}</td>
                  <td>{b.balanceAmount}</td>
                  <td>{b.gstPercentage}</td>
                  <td>{b.gstAmount}</td>
                  <td>{b.source}</td>
                  <td>{roomsFor(b)}</td>
                  <td>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        ...statusBadgeColors(b.status),
                      }}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td>{b.createdByUser || "-"}</td>
                  <td>{b.transactionId || "-"}</td>
                  <td>{b.otaCommission ?? "-"}</td>
                  <td>{b.foodPreorder ? b.totalFoodAmount ?? "-" : "-"}</td>
                  <td>{b.foodPreorder ? b.advanceFoodAmount ?? "-" : "-"}</td>
                  <td>{b.foodPreorder ? b.foodBalanceAmount ?? "-" : "-"}</td>
                  <td>{b.remarks || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={contactVisible ? 24 : 23}>No bookings found</td>
              </tr>
            )}
          </tbody>
          {bookings.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={contactVisible ? 9 : 8}><strong>Total</strong></td>
                <td><strong>{money(totals.totalAmount)}</strong></td>
                <td><strong>{money(totals.advanceAmount)}</strong></td>
                <td><strong>{money(totals.balanceAmount)}</strong></td>
                <td></td>
                <td><strong>{money(totals.gstAmount)}</strong></td>
                <td colSpan="5"></td>
                <td><strong>{money(totals.otaCommission)}</strong></td>
                <td><strong>{money(totals.totalFoodAmount)}</strong></td>
                <td><strong>{money(totals.advanceFoodAmount)}</strong></td>
                <td><strong>{money(totals.foodBalanceAmount)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default AdminBookingsDashboard;
