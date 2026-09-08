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
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const formatSplits = (splits) =>
  splits && splits.length
    ? splits.map((s) => `${s.accountName}: ₹${s.amount}`).join(", ")
    : "-";

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

  // Every column the table renders, in display order. Grouping into
  // "booking" vs "payment" drives both the two-tier header (so payment
  // columns render as one visually contiguous, tinted block) and the
  // footer's sum row - not just cosmetic ordering.
  const columns = [
    { key: "id", label: "ID", group: "booking", render: (b) => b.id },
    { key: "customerName", label: "Customer", group: "booking", render: (b) => b.customerName },
    { key: "customerContactNumber", label: "Contact", group: "booking", contactOnly: true, render: (b) => b.customerContactNumber },
    { key: "customerEmail", label: "Email", group: "booking", contactOnly: true, render: (b) => b.customerEmail || "-" },
    { key: "checkInDate", label: "Check-In", group: "booking", render: (b) => formatDate(b.checkInDate) },
    { key: "checkOutDate", label: "Check-Out", group: "booking", render: (b) => formatDate(b.checkOutDate) },
    { key: "numberOfNights", label: "Nights", group: "booking", render: (b) => b.numberOfNights },
    { key: "adults", label: "Adults", group: "booking", render: (b) => b.adults ?? 0 },
    { key: "kids", label: "Kids", group: "booking", render: (b) => b.kids ?? 0 },
    { key: "source", label: "Source", group: "booking", render: (b) => b.source },
    { key: "rooms", label: "Rooms", group: "booking", render: (b) => roomsFor(b) },
    {
      key: "status",
      label: "Status",
      group: "booking",
      render: (b) => (
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
      ),
    },
    { key: "createdByUser", label: "Created By", group: "booking", render: (b) => b.createdByUser || "-" },
    { key: "remarks", label: "Remarks", group: "booking", render: (b) => b.remarks || "-" },

    // --- Payment details (kept contiguous - see thead/tfoot below) ---
    { key: "totalAmount", label: "Total", group: "payment", summable: true, render: (b) => b.totalAmount },
    { key: "advanceAmount", label: "Advance", group: "payment", summable: true, render: (b) => b.advanceAmount },
    { key: "advanceCreditedToAccountName", label: "Advance Account", group: "payment", render: (b) => b.advanceCreditedToAccountName || "-" },
    { key: "advanceReceivedAt", label: "Advance Received", group: "payment", render: (b) => formatDateTime(b.advanceReceivedAt) },
    { key: "balanceAmount", label: "Balance", group: "payment", summable: true, render: (b) => b.balanceAmount },
    { key: "pendingBalanceAmount", label: "Pending Balance", group: "payment", summable: true, render: (b) => b.pendingBalanceAmount },
    { key: "balanceCreditedToAccountName", label: "Balance Account", group: "payment", render: (b) => b.balanceCreditedToAccountName || "-" },
    { key: "balanceSplits", label: "Balance Split", group: "payment", render: (b) => formatSplits(b.balanceSplits) },
    { key: "balanceReceivedAt", label: "Balance Received", group: "payment", render: (b) => formatDateTime(b.balanceReceivedAt) },
    { key: "discountAmount", label: "Discount", group: "payment", summable: true, render: (b) => b.discountAmount ?? "-" },
    { key: "discountReason", label: "Discount Reason", group: "payment", render: (b) => b.discountReason || "-" },
    { key: "gstPercentage", label: "GST %", group: "payment", render: (b) => b.gstPercentage },
    { key: "gstAmount", label: "GST Amount", group: "payment", summable: true, render: (b) => b.gstAmount },
    { key: "gstOnAdvance", label: "GST On Advance", group: "payment", summable: true, render: (b) => b.gstOnAdvance ?? "-" },
    { key: "gstOnBalance", label: "GST On Balance", group: "payment", summable: true, render: (b) => b.gstOnBalance ?? "-" },
    { key: "otaCommission", label: "OTA Commission", group: "payment", summable: true, render: (b) => b.otaCommission ?? "-" },
    { key: "totalFoodAmount", label: "Food Total", group: "payment", summable: true, foodOnly: true, render: (b) => (b.foodPreorder ? b.totalFoodAmount ?? "-" : "-") },
    { key: "advanceFoodAmount", label: "Food Advance", group: "payment", summable: true, foodOnly: true, render: (b) => (b.foodPreorder ? b.advanceFoodAmount ?? "-" : "-") },
    { key: "foodBalanceAmount", label: "Food Balance", group: "payment", summable: true, foodOnly: true, render: (b) => (b.foodPreorder ? b.foodBalanceAmount ?? "-" : "-") },
    { key: "transactionId", label: "Transaction ID", group: "payment", render: (b) => b.transactionId || "-" },
    { key: "lateCheckoutCharge", label: "Late Checkout Charge", group: "payment", summable: true, render: (b) => b.lateCheckoutCharge ?? "-" },
    { key: "lateCheckoutReason", label: "Late Checkout Reason", group: "payment", render: (b) => b.lateCheckoutReason || "-" },
    { key: "lateCheckoutCreditedToAccountName", label: "Late Checkout Account", group: "payment", render: (b) => b.lateCheckoutCreditedToAccountName || "-" },
    { key: "extraCharge", label: "Extra Charge", group: "payment", summable: true, render: (b) => b.extraCharge ?? "-" },
    { key: "extraChargeReason", label: "Extra Charge Reason", group: "payment", render: (b) => b.extraChargeReason || "-" },
    { key: "extraChargeCreditedToAccountName", label: "Extra Charge Account", group: "payment", render: (b) => b.extraChargeCreditedToAccountName || "-" },
    { key: "refundAmount", label: "Refund Amount", group: "payment", summable: true, render: (b) => b.refundAmount ?? "-" },
    { key: "refundReason", label: "Refund Reason", group: "payment", render: (b) => b.refundReason || "-" },
    { key: "refundCreditedToAccountName", label: "Refund Account", group: "payment", render: (b) => b.refundCreditedToAccountName || "-" },
  ];

  const visibleColumns = columns.filter((c) => !c.contactOnly || contactVisible);
  const bookingColumns = visibleColumns.filter((c) => c.group === "booking");
  const paymentColumns = visibleColumns.filter((c) => c.group === "payment");

  const exportBookings = () => {
    const resortLabel = selectedResort ? selectedResort.label : "all-resorts";
    const rows = bookings.map((b) => ({
      ...b,
      rooms: roomsFor(b),
      resortName: resortLabel,
      advanceReceivedAtText: formatDateTime(b.advanceReceivedAt),
      balanceReceivedAtText: formatDateTime(b.balanceReceivedAt),
      balanceSplitsText: formatSplits(b.balanceSplits),
    }));
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
        { key: "source", header: "Source" },
        { key: "rooms", header: "Rooms" },
        { key: "status", header: "Status" },
        { key: "createdByUser", header: "Created By" },
        { key: "remarks", header: "Remarks" },
        { key: "totalAmount", header: "Total Amount" },
        { key: "advanceAmount", header: "Advance" },
        { key: "advanceCreditedToAccountName", header: "Advance Account" },
        { key: "advanceReceivedAtText", header: "Advance Received" },
        { key: "balanceAmount", header: "Balance" },
        { key: "pendingBalanceAmount", header: "Pending Balance" },
        { key: "balanceCreditedToAccountName", header: "Balance Account" },
        { key: "balanceSplitsText", header: "Balance Split" },
        { key: "balanceReceivedAtText", header: "Balance Received" },
        { key: "discountAmount", header: "Discount" },
        { key: "discountReason", header: "Discount Reason" },
        { key: "gstPercentage", header: "GST %" },
        { key: "gstAmount", header: "GST Amount" },
        { key: "gstOnAdvance", header: "GST On Advance" },
        { key: "gstOnBalance", header: "GST On Balance" },
        { key: "otaCommission", header: "OTA Commission" },
        { key: "totalFoodAmount", header: "Food Total" },
        { key: "advanceFoodAmount", header: "Food Advance" },
        { key: "foodBalanceAmount", header: "Food Balance" },
        { key: "transactionId", header: "Transaction ID" },
        { key: "lateCheckoutCharge", header: "Late Checkout Charge" },
        { key: "lateCheckoutReason", header: "Late Checkout Reason" },
        { key: "lateCheckoutCreditedToAccountName", header: "Late Checkout Account" },
        { key: "extraCharge", header: "Extra Charge" },
        { key: "extraChargeReason", header: "Extra Charge Reason" },
        { key: "extraChargeCreditedToAccountName", header: "Extra Charge Account" },
        { key: "refundAmount", header: "Refund Amount" },
        { key: "refundReason", header: "Refund Reason" },
        { key: "refundCreditedToAccountName", header: "Refund Account" },
        { key: "resortName", header: "Resort" },
      ]
    );
  };

  // Sums for the footer row - only the genuinely additive money columns
  // (flagged `summable` above). Percentages, account names, splits, and
  // headcounts aren't included: summing those across bookings with
  // different date ranges/accounts isn't meaningful.
  const sumColumn = (col) =>
    bookings.reduce((total, b) => {
      const value = col.foodOnly ? (b.foodPreorder ? b[col.key] : 0) : b[col.key];
      return total + (value || 0);
    }, 0);
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
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            styles={themedSelectStyles()}
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
              <th colSpan={bookingColumns.length}>Booking Details</th>
              <th colSpan={paymentColumns.length} className="payment-col">Payment Details</th>
            </tr>
            <tr>
              {visibleColumns.map((c) => (
                <th key={c.key} className={c.group === "payment" ? "payment-col" : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.length > 0 ? (
              bookings.map((b) => (
                <tr key={b.id}>
                  {visibleColumns.map((c) => (
                    <td key={c.key} className={c.group === "payment" ? "payment-col" : undefined}>
                      {c.render(b)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumns.length}>No bookings found</td>
              </tr>
            )}
          </tbody>
          {bookings.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={bookingColumns.length}><strong>Total</strong></td>
                {paymentColumns.map((c) => (
                  <td key={c.key} className="payment-col">
                    {c.summable ? <strong>{money(sumColumn(c))}</strong> : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default AdminBookingsDashboard;
