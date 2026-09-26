import { useState, useEffect, Fragment } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import "../css/theme.css";
import "../css/components.css";
import "./UserDashboard.css";
import config from "../config";
import { toLocalDateStr } from "../utils/date";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import { getUserRole } from "../utils/auth";
import ToastContainer, { useToast } from "./common/Toast";

// Display-only relabeling of BookingSource values - see the matching
// constant in UserInventory.jsx for the full rationale.
const sourceLabel = (source) =>
  ({ CALL: "VINTARA", CALLS_GST: "VINTARA + GST BILL" }[source]) || source;

// PROPERTY_MANAGER/RECEPTION are restricted to a narrower window than every
// other role: last month's 1st through tomorrow - enforced again on the
// backend (BookingService.clampFromDateForRole/clampToDateForRole), this is
// just the UI-side default/min-max reflection of that same rule.
const firstOfLastMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
};
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
};

// Matches DatePicker/Reset button height, kept as an override on the shared
// theme rather than a bespoke styles object so this Select's colors/focus
// state stay in sync with every other dropdown in the app.
const resortSelectStyles = themedSelectStyles({
  control: (base) => ({
    ...base,
    minHeight: 40,
    height: 40,
    borderRadius: 5,
  }),
  valueContainer: (base) => ({
    ...base,
    height: 40,
    padding: "0 10px",
  }),
  indicatorsContainer: (base) => ({ ...base, height: 40 }),
});

// Booking status -> the shared semantic badge classes (teal/purple/gray -
// this app has no green/red/amber). CHECKED_IN is the "good" outcome,
// CANCELLED/EARLY_CHECK_OUT are terminal/negative, anything else (BOOKED,
// pending states) is neutral.
const bookingStatusBadgeClass = (status) =>
  status === "CHECKED_IN"
    ? "vt-badge vt-badge-success"
    : status === "CANCELLED" || status === "EARLY_CHECK_OUT"
    ? "vt-badge vt-badge-danger"
    : "vt-badge vt-badge-warning";

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
  const { toasts, showToast, dismissToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isFrontDeskRole = getUserRole() === "PROPERTY_MANAGER" || getUserRole() === "RECEPTION";

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
  // Default is today for every role, same as before - front-desk roles only
  // differ in how far they're allowed to move away from that (see the
  // DatePicker minDate/maxDate below), not in the default itself.
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
  // Which account the refund is paid out from - same per-resort dropdown
  // as the Inventory page's cancel/early-checkout flow.
  const [cancelRefundAccount, setCancelRefundAccount] = useState(null);
  const [creditDestinations, setCreditDestinations] = useState([]);

  useEffect(() => {
    if (!selectedResort) {
      setCreditDestinations([]);
      return;
    }
    const fetchPaymentAccounts = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/resorts/${selectedResort.value}/payment-accounts`, {
          headers: config.getHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch payment accounts");
        const data = await res.json();
        setCreditDestinations(data.map((a) => ({ value: a.id, label: a.name })));
      } catch (err) {
        console.error(err);
        setCreditDestinations([]);
      }
    };
    fetchPaymentAccounts();
  }, [selectedResort]);

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
      showToast("Enter at least 2 characters to search", "warning");
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
      showToast("Search failed. Please try again.", "danger");
    } finally {
      setSearching(false);
    }
  };

  const closeSearchResults = () => {
    setSearchResults(null);
    setSearchQuery("");
  };

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
        showToast(data?.error || "Failed to send confirmation. Please try again.", "danger");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to send confirmation. Please try again.", "danger");
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
    setCancelRefundAccount(null);
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) return showToast("Please enter a reason for cancellation", "warning");
    if (cancelRefundAmount === "" || isNaN(parseFloat(cancelRefundAmount))) {
      return showToast("Please enter a valid numeric refund amount", "warning");
    }

    const refundValue = parseFloat(cancelRefundAmount);
    if (refundValue > 0 && !cancelRefundAccount) {
      return showToast("Please select which account the refund is being paid out from.", "warning");
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
            refundAmount: refundValue,
            refundAccountId: refundValue > 0 ? cancelRefundAccount.value : null,
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
      showToast(err.message || "Failed to cancel booking", "danger");
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
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    <div className="vt-page-header">
  <h2>User Dashboard</h2>
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
  styles={resortSelectStyles}
/>
          </div>
          <div className="filter-item">
            <label>From Date</label>
            <DatePicker
              selected={fromDate}
              onChange={setFromDate}
              dateFormat="dd/MM/yyyy"
              className="date-picker"
              portalId="datepicker-portal"
              minDate={isFrontDeskRole ? firstOfLastMonth() : undefined}
              maxDate={isFrontDeskRole ? tomorrow() : undefined}
            />
          </div>
          <div className="filter-item">
            <label>To Date</label>
            <DatePicker
              selected={toDate}
              onChange={setToDate}
              dateFormat="dd/MM/yyyy"
              placeholderText="Optional"
              className="date-picker"
              portalId="datepicker-portal"
              minDate={isFrontDeskRole ? firstOfLastMonth() : undefined}
              maxDate={isFrontDeskRole ? tomorrow() : undefined}
            />
          </div>
        <div className="filter-item">
  <label className="label-spacer">Reset</label>
  <button onClick={resetFilters} className="reset-filters-btn">
    Reset
  </button>
</div>
        <div className="filter-item search-filter-item">
          <label>Search Any Property</label>
          <div className="search-input-row">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Guest name or phone..."
              className="search-input"
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="reset-filters-btn search-btn"
            >
              {searching ? "..." : "Search"}
            </button>
          </div>

          {searchResults && (
            <div className="search-results-panel">
              <div className="search-results-header">
                <strong>{searchResults.length} result{searchResults.length === 1 ? "" : "s"}</strong>
                <button type="button" onClick={closeSearchResults} className="search-results-close">
                  ✕
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div className="search-result-empty">No bookings found.</div>
              ) : (
                searchResults.map((b) => (
                  <div
                    key={b.id}
                    className="search-result-row"
                    onClick={() => goToBooking(b)}
                  >
                    <div className="search-result-row-top">
                      <strong>{b.customerName}</strong>
                      <span className={bookingStatusBadgeClass(b.status)}>
                        {b.status}
                      </span>
                    </div>
                    <div className="search-result-row-meta">
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
                  className={b.id === highlightedBookingId ? "row-highlighted" : undefined}
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
                  <td>
                    {b.customerName}
                    {b.extendedIntoBookingId && (
                      <span
                        title={`Extended into Booking #${b.extendedIntoBookingId}`}
                        className="vt-badge vt-badge-success tag-badge"
                      >
                        → Extended
                      </span>
                    )}
                    {b.extendedFromBookingId && (
                      <span
                        title={`Extended from Booking #${b.extendedFromBookingId} (${b.extendedFromCustomerName})`}
                        className="vt-badge vt-badge-danger tag-badge"
                      >
                        Extension
                      </span>
                    )}
                    {b.discountAmount > 0 && (
                      <span
                        title={b.discountReason ? `Discount: ₹${b.discountAmount} (${b.discountReason})` : `Discount: ₹${b.discountAmount}`}
                        className="vt-badge vt-badge-warning tag-badge"
                      >
                        Discounted
                      </span>
                    )}
                  </td>
                  <td>{b.customerContactNumber}</td>
                  <td>{formatStayDuration(b.checkInDate, b.checkOutDate)}</td>
                  <td>{b.adults ?? 0}A / {b.kids ?? 0}K</td>
                  <td>{b.totalAmount}</td>
                  <td>{b.advanceAmount}</td>
                  <td>{b.balanceAmount}</td>
                  <td>{sourceLabel(b.source)}</td>
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
                    <span className={bookingStatusBadgeClass(b.status)}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <div className="row-actions__group">
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
                        <button
                          onClick={() => handleEditBooking(b)}
                          className="btn-edit"
                          disabled={isTerminalStatus(b.status)}
                          title={isTerminalStatus(b.status) ? "This booking is no longer active" : undefined}
                        >
                          Edit
                        </button>
                        {b.status === "BOOKED" && (
                          <button
                            onClick={() => openCancelModal(b)}
                            className="btn-cancel"
                          >
                            Cancel
                          </button>
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
                          <span className="row-details-label">Lead Owner</span>
                          <span>{b.leadOwnerName || "-"}</span>
                        </div>
                        {b.extendedFromBookingId && (
                          <div>
                            <span className="row-details-label">Extended From</span>
                            <span>Booking #{b.extendedFromBookingId} ({b.extendedFromCustomerName})</span>
                          </div>
                        )}
                        {b.extendedIntoBookingId && (
                          <div>
                            <span className="row-details-label">Extended Into</span>
                            <span>Booking #{b.extendedIntoBookingId}</span>
                          </div>
                        )}
                        {b.discountAmount > 0 && (
                          <div>
                            <span className="row-details-label">Discount Applied</span>
                            <span>₹{b.discountAmount}{b.discountReason ? ` - ${b.discountReason}` : ""}</span>
                          </div>
                        )}
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
          <div className="pagination-controls">
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
          <div className="modal-overlay">
            <div className="modal">
              <h3>Cancel Booking</h3>
              <p><strong>Guest:</strong> {cancelModalBooking.customerName}</p>
              <p><strong>Total Bill:</strong> ₹{cancelModalBooking.totalAmount}</p>

              <div className="modal-field">
                <label>Reason:</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why is this booking being cancelled?"
                  rows={3}
                />
              </div>

              <div className="modal-field">
                <label>Refund Amount (₹):</label>
                <input
                  type="number"
                  value={cancelRefundAmount}
                  onChange={(e) => setCancelRefundAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="modal-field">
                <label>Refunded From Account:</label>
                <Select
                  options={creditDestinations}
                  value={cancelRefundAccount}
                  onChange={setCancelRefundAccount}
                  placeholder="Select payment account refund came from..."
                  menuPortalTarget={menuPortalTarget}
                  menuPosition={menuPosition}
                  styles={themedSelectStyles()}
                />
              </div>

              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={handleCancelSubmit}
                  disabled={cancelling || (parseFloat(cancelRefundAmount) > 0 && !cancelRefundAccount)}
                >
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