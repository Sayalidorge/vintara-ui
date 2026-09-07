import { useState, useEffect, Fragment } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import "../css/theme.css";
import "./UserDashboard.css";
import config from "../config";
import { toLocalDateStr } from "../utils/date";
import { menuPortalTarget, menuPosition } from "../utils/reactSelectTheme";

// Collapses check-in/check-out into one compact range, e.g. "08-09 Aug 2026"
// when they fall in the same month/year, expanding only as far as needed
// when they don't ("30 Aug - 02 Sep 2026", "30 Dec 2026 - 02 Jan 2027").
const formatStayDuration = (checkInStr, checkOutStr) => {
  if (!checkInStr || !checkOutStr) return "-";
  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);

  const dayIn = checkIn.getDate();
  const dayOut = checkOut.getDate();
  const monthIn = checkIn.toLocaleDateString("en-GB", { month: "short" });
  const monthOut = checkOut.toLocaleDateString("en-GB", { month: "short" });
  const yearIn = checkIn.getFullYear();
  const yearOut = checkOut.getFullYear();

  if (yearIn === yearOut && monthIn === monthOut) {
    return `${dayIn}-${dayOut} ${monthOut} ${yearOut}`;
  }
  if (yearIn === yearOut) {
    return `${dayIn} ${monthIn} - ${dayOut} ${monthOut} ${yearOut}`;
  }
  return `${dayIn} ${monthIn} ${yearIn} - ${dayOut} ${monthOut} ${yearOut}`;
};

const UserDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [resorts, setResorts] = useState([]);
  const [selectedResort, setSelectedResortState] = useState(null);
  // Kept in the URL (?resortId=) so a refresh reopens the same resort
  // instead of falling back to the first one - same pattern as UserInventory.
  const setSelectedResort = (resort) => {
    setSelectedResortState(resort);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (resort?.value != null) next.set("resortId", String(resort.value));
      else next.delete("resortId");
      return next;
    }, { replace: true });
  };
  const [bookings, setBookings] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 20;
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sendingConfirmation, setSendingConfirmation] = useState(new Set());
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefundAmount, setCancelRefundAmount] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Cross-property booking search — lets staff find a booking by guest
  // name/phone without knowing which resort it's on. A single match jumps
  // straight to it (switches resort/date filters so it's in view, then
  // highlights the row) instead of showing a results popup; multiple matches
  // fall back to a small picker so the user chooses which one.
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [highlightedBookingId, setHighlightedBookingId] = useState(null);

  useEffect(() => {
    if (!highlightedBookingId) return;
    const timer = setTimeout(() => setHighlightedBookingId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightedBookingId]);

  const goToBooking = (booking) => {
    const resortOption = resorts.find((r) => r.value === booking.resortId);
    if (resortOption) setSelectedResort(resortOption);
    // Bound the range tightly to this booking's own stay (not just an
    // open-ended fromDate) so it reliably lands on page 1 of the results
    // instead of possibly being pushed onto a later page by other bookings.
    setFromDate(new Date(booking.checkInDate));
    setToDate(new Date(booking.checkOutDate));
    setPage(0);
    setHighlightedBookingId(booking.id);
    setSearchResults(null);
    setSearchQuery("");
  };

  const runSearch = async () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      alert("Enter at least 2 characters to search");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `${config.BASE_URL}/api/bookings/search?query=${encodeURIComponent(query)}`,
        { headers: config.getHeaders() }
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      // A phone number is a precise identifier — repeat guests often have
      // several bookings under the same number, but that's not ambiguous
      // the way two different guests sharing a name would be. Jump straight
      // to the most recent match (backend already orders by check-in date
      // descending) instead of showing the picker for numeric queries.
      const isPhoneQuery = /^\d+$/.test(query);

      if (data.length === 1 || (isPhoneQuery && data.length > 1)) {
        goToBooking(data[0]);
      } else {
        setSearchResults(data);
      }
    } catch (err) {
      console.error(err);
      alert("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const closeSearchResults = () => {
    setSearchResults(null);
    setSearchQuery("");
  };

  // Plain USER can only cancel bookings they personally created; every other
  // role can cancel any booking — mirrors BookingService.processBookingExit.
  const canCancelBooking = (booking) =>
    user?.role !== "USER" || booking.createdByUserId === user?.id;

  const isTerminalStatus = (status) => status === "CANCELLED" || status === "EARLY_CHECK_OUT";

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSendConfirmation = async (booking) => {
    setSendingConfirmation((prev) => new Set(prev).add(booking.id));
    try {
      const res = await fetch(
        `${config.BASE_URL}/api/bookings/${booking.id}/send-confirmation`,
        { method: "POST", headers: config.getHeaders() }
      );

      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === booking.id
              ? { ...b, confirmationSent: true, confirmationStale: false }
              : b
          )
        );
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to send confirmation. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to send confirmation. Please try again.");
    } finally {
      setSendingConfirmation((prev) => {
        const next = new Set(prev);
        next.delete(booking.id);
        return next;
      });
    }
  };

  const openCancelModal = (booking) => {
    setCancelModalBooking(booking);
    setCancelReason("");
    setCancelRefundAmount("");
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) return alert("Please enter a reason for cancellation");
    if (cancelRefundAmount === "" || isNaN(parseFloat(cancelRefundAmount))) {
      return alert("Please enter a valid numeric refund amount");
    }

    setCancelling(true);
    try {
      const res = await fetch(
        `${config.BASE_URL}/api/bookings/${cancelModalBooking.id}/exit`,
        {
          method: "PUT",
          headers: config.getHeaders(),
          body: JSON.stringify({
            exitStatus: "CANCELLED",
            reason: cancelReason,
            refundAmount: parseFloat(cancelRefundAmount),
          }),
        }
      );

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("You can only cancel bookings you created.");
        }
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to cancel booking");
      }

      const updatedBooking = await res.json();
      setBookings((prev) =>
        prev.map((b) =>
          b.id === cancelModalBooking.id ? { ...b, ...updatedBooking, status: "CANCELLED" } : b
        )
      );
      setCancelModalBooking(null);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  const selectedResortFromNav = location.state?.selectedResortId;

  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const res = await fetch(
          `${config.BASE_URL}/api/resorts/resort-names-drop-down`,
          { headers: config.getHeaders() }
        );
        const data = await res.json();
        const options = data.map(r => ({
          value: r.id,
          label: r.name,
          categories: r.categories || [],
        }));
        setResorts(options);

        if (selectedResortFromNav) {
          const resortOption = options.find(r => r.value === selectedResortFromNav);
          if (resortOption) {
            setSelectedResort(resortOption);
            navigate(location.pathname, { replace: true, state: {} });
            return;
          }
        }
        if (options.length > 0 && !selectedResort) {
          const savedResortId = searchParams.get("resortId");
          const savedResort = savedResortId != null
            ? options.find((r) => String(r.value) === savedResortId)
            : null;
          setSelectedResort(savedResort || options[0]);
        }
      } catch (err) {
        console.error(err);
        setResorts([]);
        setSelectedResort(null);
      }
    };
    fetchResorts();
  }, [selectedResortFromNav, navigate, location.pathname, selectedResort]);

  // Filters changing means a different result set — start back on page 1
  // rather than potentially landing past the end of the new set.
  useEffect(() => {
    setPage(0);
  }, [selectedResort, fromDate, toDate]);

  useEffect(() => {
    if (!selectedResort) return setBookings([]);
    const fetchBookings = async () => {
      try {
        let url = `${config.BASE_URL}/api/bookings?resortId=${selectedResort.value}&page=${page}&size=${PAGE_SIZE}`;
        if (fromDate) url += `&fromDate=${toLocalDateStr(fromDate)}`;
        if (toDate) url += `&toDate=${toLocalDateStr(toDate)}`;
        const res = await fetch(url, { headers: config.getHeaders() });
        const data = await res.json();
        setBookings(data.content || []);
        setTotalPages(data.totalPages ?? 0);
      } catch (err) {
        console.error(err);
        setBookings([]);
        setTotalPages(0);
      }
    };
    fetchBookings();
  }, [selectedResort, fromDate, toDate, page]);

  const resetFilters = () => {
    setSelectedResort(resorts.length > 0 ? resorts[0] : null);
    setFromDate(new Date());
    setToDate(null);
    setPage(0);
  };

  const handleEditBooking = (booking) => {
    navigate(`/user/create-booking/${booking.id}`, {
      state: { bookingData: booking, resortOptions: resorts },
    });
  };

  const handleCreateBooking = () =>
    navigate("/user/create-booking", {
      state: { resortOptions: resorts, selectedResortId: selectedResort?.value },
    });

  return (
    <div className="user-dashboard">
    <div className="page-header">
  <h2 style={{ fontSize: "25px", fontWeight: 700, color: "var(--primary-purple)", textAlign: "left", letterSpacing: "0.3px", marginTop: "5px", marginBottom: "18px" }}>User Dashboard</h2>
  <button type="button" className="btn-create-booking" onClick={handleCreateBooking}>
    + Create Booking
  </button>
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
  // Same filter-row-collapses-to-column-on-mobile layout as UserInventory's
  // Resort filter (see src/utils/reactSelectTheme.js) - without a portal, the
  // From Date field stacked right below on mobile paints over any option
  // past the first, exactly like that bug. The sibling DatePickers already
  // portal via portalId="datepicker-portal" without issue, so doing the same
  // here is safe; colors below are already purple/inline so portaling them
  // doesn't lose any theming the way a CSS-class-based approach would.
  menuPortalTarget={menuPortalTarget}
  menuPosition={menuPosition}
  styles={{
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    control: (base, state) => ({
      ...base,
      minHeight: 40,       // match DatePicker / Reset button
      height: 40,          // exact height
      borderRadius: 5,
      borderColor: state.isFocused ? "var(--primary-purple)" : "#ccc",
      boxShadow: state.isFocused ? "0 0 0 1px var(--primary-purple)" : "none",
      '&:hover': { borderColor: "var(--primary-purple)" },
    }),
    valueContainer: (base) => ({
      ...base,
      height: 40,
      padding: "0 8px",
    }),
    input: (base) => ({ ...base, margin: 0, padding: 0, height: "100%" }),
    placeholder: (base) => ({ ...base, margin: 0, lineHeight: "40px" }),
    singleValue: (base) => ({ ...base, lineHeight: "40px" }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "var(--primary-purple)" : "#fff",
      color: state.isFocused ? "#fff" : "#333",
    }),
    indicatorsContainer: (base) => ({ ...base, height: 40 }),
    dropdownIndicator: (base) => ({ ...base, padding: "0 8px" }),
  }}
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
        <div className="filter-item" style={{ position: "relative", minWidth: "260px" }}>
          <label>Search Any Property</label>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Guest name or phone..."
              style={{ padding: "8px 10px", borderRadius: "5px", border: "1px solid #ccc", height: "40px", boxSizing: "border-box", flex: 1 }}
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="reset-filters-btn"
              style={{ whiteSpace: "nowrap", height: "40px", boxSizing: "border-box", margin: 0 }}
            >
              {searching ? "..." : "Search"}
            </button>
          </div>

          {searchResults && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                width: "520px",
                maxHeight: "400px",
                overflowY: "auto",
                background: "#fff",
                color: "#333",
                border: "1px solid #ddd",
                borderRadius: "8px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                zIndex: 2000,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #eee" }}>
                <strong>{searchResults.length} result{searchResults.length === 1 ? "" : "s"}</strong>
                <button type="button" onClick={closeSearchResults} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "16px" }}>
                  ✕
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div style={{ padding: "14px" }}>No bookings found.</div>
              ) : (
                searchResults.map((b) => (
                  <div
                    key={b.id}
                    style={{ padding: "10px 14px", borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
                    onClick={() => goToBooking(b)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{b.customerName}</strong>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "10px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          background: b.status === "CHECKED_IN" ? "#d4edda" : b.status === "CANCELLED" || b.status === "EARLY_CHECK_OUT" ? "#f8d7da" : "#fff3cd",
                          color: b.status === "CHECKED_IN" ? "#155724" : b.status === "CANCELLED" || b.status === "EARLY_CHECK_OUT" ? "#721c24" : "#856404",
                        }}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#555", marginTop: "4px" }}>
                      {b.customerContactNumber} · {b.property || "-"} · {b.checkInDate} to {b.checkOutDate}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table className="bookings-table">
            <thead>
              <tr>
                <th></th>
                <th>ID</th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Duration</th>
                <th>People</th>
                <th>Total</th>
                <th>Advance</th>
                <th>Balance</th>
                <th>Source</th>
                <th>Room</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length > 0 ? bookings.map(b => (
                <Fragment key={b.id}>
                <tr
                  ref={(el) => {
                    if (b.id === highlightedBookingId && el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                  style={b.id === highlightedBookingId ? { background: "#f3e6f5", transition: "background 1s ease" } : undefined}
                >
                  <td>
                    <button
                      type="button"
                      className="row-expand-btn"
                      onClick={() => toggleRow(b.id)}
                      aria-label={expandedRows.has(b.id) ? "Collapse details" : "Expand details"}
                    >
                      {expandedRows.has(b.id) ? "▾" : "▸"}
                    </button>
                  </td>
                  <td>{b.id}</td>
                  <td>{b.customerName}</td>
                  <td>{b.customerContactNumber}</td>
                  <td>{formatStayDuration(b.checkInDate, b.checkOutDate)}</td>
                  <td>{b.adults ?? 0}A / {b.kids ?? 0}K</td>
                  <td>{b.totalAmount}</td>
                  <td>{b.advanceAmount}</td>
                  <td>{b.balanceAmount}</td>
                  <td>{b.source}</td>
<td>
  {b.bookingItems?.length
    ? b.bookingItems.map((item, i) => (
        <div key={i}>
          {item.roomNumbers?.join(", ")}
        </div>
      ))
    : "-"}
</td>
                  <td>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        background:
                          b.status === "CHECKED_IN"
                            ? "#d4edda"
                            : b.status === "CANCELLED" || b.status === "EARLY_CHECK_OUT"
                            ? "#f8d7da"
                            : "#fff3cd",
                        color:
                          b.status === "CHECKED_IN"
                            ? "#155724"
                            : b.status === "CANCELLED" || b.status === "EARLY_CHECK_OUT"
                            ? "#721c24"
                            : "#856404",
                      }}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <div className="row-actions__group">
                        <button
                          onClick={() => handleEditBooking(b)}
                          className="btn-edit"
                          disabled={isTerminalStatus(b.status)}
                          title={isTerminalStatus(b.status) ? "This booking is no longer active" : undefined}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleSendConfirmation(b)}
                          className="btn-confirm"
                          disabled={
                            (b.confirmationSent && !b.confirmationStale) ||
                            sendingConfirmation.has(b.id) ||
                            isTerminalStatus(b.status)
                          }
                          title={isTerminalStatus(b.status) ? "This booking is no longer active" : undefined}
                        >
                          {sendingConfirmation.has(b.id)
                            ? "Sending…"
                            : b.confirmationSent && !b.confirmationStale
                            ? "Sent"
                            : b.confirmationSent && b.confirmationStale
                            ? "Resend Confirmation"
                            : "Send Confirmation"}
                        </button>
                      </div>
                      <div className="row-actions__group">
                        {b.status === "BOOKED" && (
                          <button
                            onClick={() => openCancelModal(b)}
                            className="btn-cancel"
                            disabled={!canCancelBooking(b)}
                            title={canCancelBooking(b) ? undefined : "Only the creator or an admin can cancel this booking"}
                          >
                            Cancel
                          </button>
                        )}
                        {user?.permissions?.includes("generate_gst_invoice") && (
                          <Link
                            to={`/user/gst-invoice?bookingId=${b.id}`}
                            className="btn-confirm"
                            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                          >
                            GST Invoice
                          </Link>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
                {expandedRows.has(b.id) && (
                  <tr className="row-details">
                    <td colSpan="13">
                      <div className="row-details-grid">
                        <div>
                          <span className="row-details-label">Nights</span>
                          <span>{b.numberOfNights}</span>
                        </div>
                        <div className="row-details-narrow">
                          <span className="row-details-label">Created By</span>
                          <span>{b.createdByUser || "-"}</span>
                        </div>
                        <div>
                          <span className="row-details-label">GST %</span>
                          <span>{b.gstPercentage}</span>
                        </div>
                        <div className="row-details-narrow">
                          <span className="row-details-label">GST Amount</span>
                          <span>{b.gstAmount}</span>
                        </div>
                        <div>
                          <span className="row-details-label">Email</span>
                          <span>{b.customerEmail || "-"}</span>
                        </div>
                        <div>
                          <span className="row-details-label">Transaction ID</span>
                          <span>{b.transactionId || "-"}</span>
                        </div>
                        <div>
                          <span className="row-details-label">OTA Commission</span>
                          <span>{b.otaCommission ?? "-"}</span>
                        </div>
                        {b.foodPreorder && (
                          <>
                            <div>
                              <span className="row-details-label">Food Total</span>
                              <span>{b.totalFoodAmount ?? "-"}</span>
                            </div>
                            <div>
                              <span className="row-details-label">Food Advance</span>
                              <span>{b.advanceFoodAmount ?? "-"}</span>
                            </div>
                            <div>
                              <span className="row-details-label">Food Balance</span>
                              <span>{b.foodBalanceAmount ?? "-"}</span>
                            </div>
                          </>
                        )}
                        <div className="row-details-remarks">
                          <span className="row-details-label">Remarks</span>
                          <span>{b.remarks || "-"}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )) : (
                <tr>
                  <td colSpan="13">No bookings found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginTop: "14px" }}>
            <button
              type="button"
              className="reset-filters-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <span>Page {page + 1} of {totalPages}</span>
            <button
              type="button"
              className="reset-filters-btn"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
            </button>
          </div>
        )}

        {cancelModalBooking && (
          <div
            className="modal-overlay"
            style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
          >
            <div className="modal" style={{ background: "#fff", padding: "25px", borderRadius: "8px", maxWidth: "450px", width: "100%" }}>
              <h3>Cancel Booking</h3>
              <p><strong>Guest:</strong> {cancelModalBooking.customerName}</p>
              <p><strong>Total Bill:</strong> ₹{cancelModalBooking.totalAmount}</p>

              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", marginBottom: "4px" }}>Reason:</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why is this booking being cancelled?"
                  rows={3}
                  style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", marginBottom: "4px" }}>Refund Amount (₹):</label>
                <input
                  type="number"
                  value={cancelRefundAmount}
                  onChange={(e) => setCancelRefundAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button className="btn-cancel" onClick={handleCancelSubmit} disabled={cancelling}>
                  {cancelling ? "Cancelling…" : "Confirm Cancellation"}
                </button>
                <button className="btn-edit" onClick={() => setCancelModalBooking(null)} disabled={cancelling}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default UserDashboard;