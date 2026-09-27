import { useState, useEffect } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../css/theme.css";
import "../css/components.css";
import "./AdminBookingsDashboard.css";
import config from "../config";
import { toLocalDateStr } from "../utils/date";
import { downloadCsv } from "../utils/csv";
import { isSuperAdmin, getUserRole } from "../utils/auth";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";

// Display-only relabeling of BookingSource values - see the matching
// constant in UserInventory.jsx for the full rationale.
const sourceLabel = (source) =>
  ({ CALL: "VINTARA", CALLS_GST: "VINTARA + GST BILL" }[source]) || source;

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

// Mirrors BookingStatus.java - no drop-down endpoint exists for this yet,
// same as every other place in the frontend that renders/matches status.
const statusOptions = [
  { value: "BOOKED", label: "Booked" },
  { value: "CHECKED_IN", label: "Checked In" },
  { value: "CHECKED_OUT", label: "Checked Out" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EARLY_CHECK_OUT", label: "Early Check-Out" },
  { value: "NO_SHOW", label: "No Show" },
];

const statusBadgeClass = (status) => {
  if (status === "CHECKED_IN") return "vt-badge-success";
  if (status === "CANCELLED" || status === "EARLY_CHECK_OUT") return "vt-badge-danger";
  return "vt-badge-warning";
};

// Everyone except SUPER_ADMIN is limited to the rolling current-month +
// last-month window (plus all future bookings) - enforced again on the
// backend (see BookingService.findByResortAndDateRange), this is just the
// UI-side default/min-date reflection of that same rule.
const firstOfCurrentMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const firstOfLastMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
};

const AdminBookingsDashboard = () => {
  const role = getUserRole();
  const contactVisible = role !== "ADMIN";
  const dateRestricted = role !== "SUPER_ADMIN";

  // Collapses every "booking" group column except the two frozen ones
  // (ID, Customer - see the nth-child(1)/(2) CSS) - the table has grown too
  // wide to scan at a glance, and most of the time only the payment columns
  // (or just who/when) are what someone's actually looking for.
  const [bookingDetailsCollapsed, setBookingDetailsCollapsed] = useState(false);
  // Same idea, generalized to any named column.subgroup within a column -
  // GST today (gstAmount/gstPercentage/gstOnAdvance/gstOnBalance), more can
  // be added later just by tagging columns with the same subgroup key. A Set
  // of currently-collapsed subgroup keys, toggled from that subgroup's
  // subgroupHeader column (see the thead row below).
  const [collapsedSubgroups, setCollapsedSubgroups] = useState(new Set());
  const toggleSubgroup = (subgroup) => {
    setCollapsedSubgroups((prev) => {
      const next = new Set(prev);
      if (next.has(subgroup)) next.delete(subgroup);
      else next.add(subgroup);
      return next;
    });
  };

  const [resorts, setResorts] = useState([]);
  const [selectedResort, setSelectedResort] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [fromDate, setFromDate] = useState(dateRestricted ? firstOfCurrentMonth() : new Date());
  const [toDate, setToDate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCreatedBy, setSelectedCreatedBy] = useState(null);
  const [selectedLeadOwner, setSelectedLeadOwner] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);

  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const res = await fetch(
          `${config.BASE_URL}/api/resorts/resort-names-drop-down`,
          { headers: config.getHeaders() }
        );
        const data = await res.json();
        const options = data.map((r) => ({ value: r.id, label: r.name }));
        const allResortsOption = { value: null, label: "All Resorts" };
        setResorts([allResortsOption, ...options]);
        setSelectedResort(allResortsOption);
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
        // A blank resortId (selectedResort.value === null, "All Resorts")
        // still sends the param name - the backend distinguishes "all
        // resorts I'm allowed to see" from the separate, unrestricted
        // GET /api/bookings (no resortId at all) used elsewhere.
        let url = `${config.BASE_URL}/api/bookings?resortId=${selectedResort.value ?? ""}&page=0&size=1000`;
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
    // resorts[0] is the "All Resorts" entry, matching the initial default.
    setSelectedResort(resorts[0] || null);
    setFromDate(dateRestricted ? firstOfCurrentMonth() : new Date());
    setToDate(null);
    setSearchTerm("");
    setSelectedCreatedBy(null);
    setSelectedLeadOwner(null);
    setSelectedStatus(null);
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
    // Only shown for "All Resorts" - inserted after the two sticky/pinned
    // columns (ID, Customer - see the nth-child(1)/(2) CSS) so it doesn't
    // shift which columns are frozen.
    ...(!selectedResort?.value ? [{ key: "resort", label: "Resort", group: "booking", render: (b) => b.property || "-" }] : []),
    { key: "customerContactNumber", label: "Contact", group: "booking", contactOnly: true, render: (b) => b.customerContactNumber },
    { key: "customerEmail", label: "Email", group: "booking", contactOnly: true, render: (b) => b.customerEmail || "-" },
    { key: "checkInDate", label: "Check-In", group: "booking", render: (b) => formatDate(b.checkInDate) },
    { key: "checkOutDate", label: "Check-Out", group: "booking", render: (b) => formatDate(b.checkOutDate) },
    { key: "numberOfNights", label: "Nights", group: "booking", render: (b) => b.numberOfNights },
    { key: "adults", label: "Adults", group: "booking", render: (b) => b.adults ?? 0 },
    { key: "kids", label: "Kids", group: "booking", render: (b) => b.kids ?? 0 },
    { key: "source", label: "Source", group: "booking", render: (b) => sourceLabel(b.source) },
    { key: "rooms", label: "Rooms", group: "booking", render: (b) => roomsFor(b) },
    { key: "createdByUser", label: "Created By", group: "booking", render: (b) => b.createdByUser || "-" },
    { key: "leadOwnerName", label: "Lead Owner", group: "booking", render: (b) => b.leadOwnerName || "-" },
    { key: "remarks", label: "Remarks", group: "booking", render: (b) => b.remarks || "-" },
    {
      key: "status",
      label: "Status",
      group: "booking",
      render: (b) => (
        <span className={`vt-badge ${statusBadgeClass(b.status)}`}>
          {b.status}
        </span>
      ),
    },

    // --- Payment details (kept contiguous - see thead/tfoot below).
    // Total/Advance/Balance/Balance Split/GST group pulled to the front on
    // request, everything else follows in its previous relative order. ---
    { key: "totalAmount", label: "Total", group: "payment", summable: true, render: (b) => b.totalAmount },
    { key: "advanceAmount", label: "Advance", group: "payment", summable: true, render: (b) => b.advanceAmount },
    { key: "balanceAmount", label: "Balance", group: "payment", summable: true, render: (b) => b.balanceAmount },
    { key: "balanceSplits", label: "Balance Split", group: "payment", summable: true, render: (b) => formatSplits(b.balanceSplits) },
    // GST columns as one collapsible subgroup - gstAmount is the
    // subgroupHeader (carries the toggle, always visible); the other three
    // hide together when it's collapsed. See visibleColumns' filter below.
    { key: "gstAmount", label: "GST Amount", group: "payment", summable: true, subgroup: "gst", subgroupHeader: true, render: (b) => b.gstAmount },
    { key: "gstPercentage", label: "GST %", group: "payment", subgroup: "gst", render: (b) => b.gstPercentage },
    { key: "gstOnAdvance", label: "GST On Advance", group: "payment", summable: true, subgroup: "gst", render: (b) => b.gstOnAdvance ?? "-" },
    { key: "gstOnBalance", label: "GST On Balance", group: "payment", summable: true, subgroup: "gst", render: (b) => b.gstOnBalance ?? "-" },
    { key: "advanceCreditedToAccountName", label: "Advance Account", group: "payment", render: (b) => b.advanceCreditedToAccountName || "-" },
    { key: "advanceReceivedAt", label: "Advance Received", group: "payment", render: (b) => formatDateTime(b.advanceReceivedAt) },
    { key: "pendingBalanceAmount", label: "Pending Balance", group: "payment", summable: true, render: (b) => b.pendingBalanceAmount },
    { key: "balanceCreditedToAccountName", label: "Balance Account", group: "payment", render: (b) => b.balanceCreditedToAccountName || "-" },
    { key: "balanceReceivedAt", label: "Balance Received", group: "payment", render: (b) => formatDateTime(b.balanceReceivedAt) },
    { key: "discountAmount", label: "Discount", group: "payment", summable: true, render: (b) => b.discountAmount ?? "-" },
    { key: "discountReason", label: "Discount Reason", group: "payment", render: (b) => b.discountReason || "-" },
    { key: "otaCommission", label: "OTA Commission", group: "payment", summable: true, render: (b) => b.otaCommission ?? "-" },
    { key: "totalFoodAmount", label: "Food Total", group: "payment", summable: true, foodOnly: true, render: (b) => (b.foodPreorder ? b.totalFoodAmount ?? "-" : "-") },
    { key: "advanceFoodAmount", label: "Food Advance", group: "payment", summable: true, foodOnly: true, render: (b) => (b.foodPreorder ? b.advanceFoodAmount ?? "-" : "-") },
    { key: "foodBalanceAmount", label: "Food Balance", group: "payment", summable: true, foodOnly: true, render: (b) => (b.foodPreorder ? b.foodBalanceAmount ?? "-" : "-") },
    { key: "transactionId", label: "Transaction ID", group: "payment", render: (b) => b.transactionId || "-" },
    { key: "lateCheckoutCharge", label: "Late Checkout Charge", group: "payment", summable: true, render: (b) => b.lateCheckoutCharge ?? "-" },
    { key: "lateCheckoutReason", label: "Late Checkout Reason", group: "payment", render: (b) => b.lateCheckoutReason || "-" },
    { key: "lateCheckoutCreditedToAccountName", label: "Late Checkout Account", group: "payment", render: (b) => b.lateCheckoutCreditedToAccountName || "-" },
    { key: "gstOnLateCheckoutCharge", label: "GST On Late Checkout", group: "payment", summable: true, render: (b) => b.gstOnLateCheckoutCharge ?? "-" },
    { key: "extraCharge", label: "Extra Charge", group: "payment", summable: true, render: (b) => b.extraCharge ?? "-" },
    { key: "extraChargeReason", label: "Extra Charge Reason", group: "payment", render: (b) => b.extraChargeReason || "-" },
    { key: "extraChargeCreditedToAccountName", label: "Extra Charge Account", group: "payment", render: (b) => b.extraChargeCreditedToAccountName || "-" },
    { key: "gstOnExtraCharge", label: "GST On Extra Charge", group: "payment", summable: true, render: (b) => b.gstOnExtraCharge ?? "-" },
    { key: "refundAmount", label: "Refund Amount", group: "payment", summable: true, render: (b) => b.refundAmount ?? "-" },
    { key: "refundReason", label: "Refund Reason", group: "payment", render: (b) => b.refundReason || "-" },
    { key: "refundCreditedToAccountName", label: "Refund Account", group: "payment", render: (b) => b.refundCreditedToAccountName || "-" },
  ];

  const visibleColumns = columns.filter((c) => {
    if (c.contactOnly && !contactVisible) return false;
    // Collapsed: hide every "booking" column except the two frozen ones -
    // payment columns are never affected by this toggle.
    if (bookingDetailsCollapsed && c.group === "booking" && c.key !== "id" && c.key !== "customerName") return false;
    // A collapsed subgroup hides every column tagged with that subgroup
    // except its subgroupHeader, which always stays visible - it's where
    // the toggle lives.
    if (c.subgroup && !c.subgroupHeader && collapsedSubgroups.has(c.subgroup)) return false;
    return true;
  });
  const bookingColumns = visibleColumns.filter((c) => c.group === "booking");
  const paymentColumns = visibleColumns.filter((c) => c.group === "payment");

  // Who created a booking, for filtering by employee to see their individual
  // turnover - derived from the current resort+date-filtered `bookings`
  // (not `filteredBookings`, so switching resort/date always repopulates this
  // with whoever actually has bookings in that filter, independent of
  // whatever's currently typed in search or already selected here). Keyed by
  // id, not name, so two staff who happen to share a name aren't conflated.
  const createdByOptions = Array.from(
    new Map(
      bookings
        .filter((b) => b.createdByUserId != null)
        .map((b) => [b.createdByUserId, { value: b.createdByUserId, label: b.createdByUser || `User #${b.createdByUserId}` }])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  // Same derivation as createdByOptions, but for Lead Owner (who actually
  // gets performance credit - see PerformanceService) rather than who
  // technically submitted the create-booking request.
  const leadOwnerOptions = Array.from(
    new Map(
      bookings
        .filter((b) => b.leadOwnerUserId != null)
        .map((b) => [b.leadOwnerUserId, { value: b.leadOwnerUserId, label: b.leadOwnerName || `User #${b.leadOwnerUserId}` }])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  // Client-side, on top of the resort/date filters already applied server-side
  // - `bookings` is already the full resort+date-filtered set (fetched with
  // size=1000), so narrowing it further here needs no extra request. Matches
  // id, guest name, contact number, email, and room numbers - the fields
  // staff would actually recognize a booking by.
  const filteredBookings = bookings.filter((b) => {
    if (selectedCreatedBy && b.createdByUserId !== selectedCreatedBy.value) return false;
    if (selectedLeadOwner && b.leadOwnerUserId !== selectedLeadOwner.value) return false;
    if (selectedStatus && b.status !== selectedStatus.value) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      String(b.id).includes(term) ||
      (b.customerName || "").toLowerCase().includes(term) ||
      (b.customerContactNumber || "").toLowerCase().includes(term) ||
      (b.customerEmail || "").toLowerCase().includes(term) ||
      roomsFor(b).toLowerCase().includes(term)
    );
  });

  const exportBookings = () => {
    const resortLabel = selectedResort ? selectedResort.label : "all-resorts";
    const rows = filteredBookings.map((b) => ({
      ...b,
      source: sourceLabel(b.source),
      rooms: roomsFor(b),
      // Per-row actual resort (not the filter's constant label) - matters
      // once "All Resorts" mixes bookings from more than one property.
      resortName: b.property || resortLabel,
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
        { key: "leadOwnerName", header: "Lead Owner" },
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
        { key: "gstOnLateCheckoutCharge", header: "GST On Late Checkout" },
        { key: "extraCharge", header: "Extra Charge" },
        { key: "extraChargeReason", header: "Extra Charge Reason" },
        { key: "extraChargeCreditedToAccountName", header: "Extra Charge Account" },
        { key: "gstOnExtraCharge", header: "GST On Extra Charge" },
        { key: "refundAmount", header: "Refund Amount" },
        { key: "refundReason", header: "Refund Reason" },
        { key: "refundCreditedToAccountName", header: "Refund Account" },
        { key: "resortName", header: "Resort" },
      ]
    );
  };

  // Sums for the footer row - only the genuinely additive money columns
  // (flagged `summable` above). Percentages, account names, and headcounts
  // aren't included: summing those across bookings with different date
  // ranges/accounts isn't meaningful. Balance (the column) is the amount
  // charged/owed, NOT what's actually been paid - it stays fixed once set,
  // regardless of collection (see pendingBalanceAmount for what's still
  // due). Balance Split's footer is "balance actually collected" - same
  // splits-or-legacy-account definition used everywhere else on this page
  // (Turnover, the account tickers), not just a literal sum of the split
  // rows shown in that column - a booking with no splits but a legacy
  // single-account balanceCreditedTo still had its balance genuinely
  // collected, so it counts here too, even though its cell just shows "-".
  const sumColumn = (col) => {
    if (col.key === "balanceSplits") {
      return filteredBookings.reduce((total, b) => {
        if (b.balanceSplits && b.balanceSplits.length > 0) {
          return total + b.balanceSplits.reduce((s, split) => s + (split.amount || 0), 0);
        }
        return total + (b.balanceCreditedToAccountName ? (b.balanceAmount || 0) : 0);
      }, 0);
    }
    return filteredBookings.reduce((total, b) => {
      const value = col.foodOnly ? (b.foodPreorder ? b[col.key] : 0) : b[col.key];
      return total + (value || 0);
    }, 0);
  };
  const money = (n) => `₹${n.toLocaleString()}`;

  // Per-account collection summary for the currently filtered bookings -
  // walks every field money can be credited/debited through (advance,
  // balance splits, late checkout, extra charge, refund) rather than just
  // advance/balance, so it matches what the "Payment Details" columns show.
  // Purely derived from `bookings` (same pattern as sumColumn above) - no
  // extra state or fetch needed.
  const computeAccountTotals = () => {
    const totals = new Map();
    const bump = (key, field, amount) => {
      if (!totals.has(key)) totals.set(key, { collected: 0, refunded: 0 });
      totals.get(key)[field] += amount;
    };
    // Strict: a missing account here means the amount was never actually
    // collected (e.g. balance with no split rows and no legacy account set -
    // the guest hasn't checked in/paid yet), so it must be excluded, not
    // bucketed anywhere.
    const addTo = (accountName, field, amount) => {
      if (!accountName || !amount) return;
      bump(accountName, field, amount);
    };
    // Lenient: for fields where the amount is definitely real/collected but
    // the account tag can be missing on old data (e.g. a refund from before
    // this session's refund-simplification migration, never backfilled) -
    // silently dropping it would make the "All Accounts"/Turnover total
    // wrong, not just that one account's card, so bucket it under "Unknown
    // Account" instead, which also surfaces the data gap rather than hiding it.
    const addToOrUnknown = (accountName, field, amount) => {
      if (!amount) return;
      bump(accountName || "Unknown Account", field, amount);
    };
    filteredBookings.forEach((b) => {
      addTo(b.advanceCreditedToAccountName, "collected", b.advanceAmount);
      if (b.balanceSplits && b.balanceSplits.length > 0) {
        b.balanceSplits.forEach((s) => addTo(s.accountName, "collected", s.amount));
      } else {
        // No splits (a booking checked in before splits existed, or paid to
        // a single account) - fall back to the legacy single-account field,
        // same as the backend's collection logic and this table's own
        // "Balance Account" column already do. Without this, a legacy
        // booking's balance silently disappears from "Collected" entirely.
        // Still strict: no legacy account either means genuinely uncollected.
        addTo(b.balanceCreditedToAccountName, "collected", b.balanceAmount);
      }
      addTo(b.lateCheckoutCreditedToAccountName, "collected", b.lateCheckoutCharge);
      addTo(b.extraChargeCreditedToAccountName, "collected", b.extraCharge);
      addToOrUnknown(b.refundCreditedToAccountName, "refunded", b.refundAmount);
    });
    return Array.from(totals.entries())
      .map(([accountName, { collected, refunded }]) => ({ accountName, collected, refunded, net: collected - refunded }))
      .sort((a, b) => b.collected - a.collected);
  };
  const accountTotals = computeAccountTotals();
  const allAccountsTotal = accountTotals.reduce(
    (acc, a) => ({ collected: acc.collected + a.collected, refunded: acc.refunded + a.refunded }),
    { collected: 0, refunded: 0 }
  );
  // Real Turnover is cash-basis: money actually collected across every
  // account, net of refunds - a booking's still-unpaid balance doesn't
  // count. Matches SettlementService.populateResortTurnoverAndCollection's
  // resortTurnover exactly (which is set to vintaraCollection +
  // propertyCollection there for the same reason), so this is just the
  // same net figure the "All Accounts" card already computes.
  const realTurnover = allAccountsTotal.collected - allAccountsTotal.refunded;

  return (
    <div className="admin-bookings-dashboard">
      <div className="vt-page-header">
        <h2>Bookings</h2>
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
          <label>Created By</label>
          <Select
            options={createdByOptions}
            value={selectedCreatedBy}
            onChange={setSelectedCreatedBy}
            placeholder="All employees"
            isClearable
            isDisabled={createdByOptions.length === 0}
            classNamePrefix="react-select"
            className="react-select-container"
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            styles={themedSelectStyles()}
          />
        </div>
        <div className="filter-item">
          <label>Lead Owner</label>
          <Select
            options={leadOwnerOptions}
            value={selectedLeadOwner}
            onChange={setSelectedLeadOwner}
            placeholder="All employees"
            isClearable
            isDisabled={leadOwnerOptions.length === 0}
            classNamePrefix="react-select"
            className="react-select-container"
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            styles={themedSelectStyles()}
          />
        </div>
        <div className="filter-item">
          <label>Status</label>
          <Select
            options={statusOptions}
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="All statuses"
            isClearable
            classNamePrefix="react-select"
            className="react-select-container"
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            styles={themedSelectStyles()}
          />
        </div>
        <div className="filter-item">
          <label>Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ID, guest name, contact, email, room..."
            className="date-picker"
            style={{ minWidth: "220px" }}
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
            minDate={dateRestricted ? firstOfLastMonth() : undefined}
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

      {/* Account-wise collection summary - derived from the same filtered
          `bookings` array the table below renders, so it's always in sync
          with what's visibly listed. */}
      {filteredBookings.length > 0 && (
        <div className="account-summary-wrap">
          <p className="account-summary-label">Collected by account · this filter</p>
          <div className="account-summary">
            <div
              className="account-card real-turnover-card"
              title="Money actually collected across every account, net of refunds - a booking's still-unpaid balance doesn't count. Matches Monthly Settlement's Resort Turnover."
            >
              <div className="account-name">
                Turnover <span className="rank">CASH BASIS</span>
              </div>
              <div className="collected-label">This filter</div>
              <div className="collected">{money(realTurnover)}</div>
            </div>
            <div className="account-card all-accounts">
              <div className="account-name">
                All Accounts <span className="rank">TOTAL</span>
              </div>
              <div className="collected-label">Collected</div>
              <div className="collected">{money(allAccountsTotal.collected)}</div>
              {allAccountsTotal.refunded > 0 && (
                <div className="sub-line">
                  <span className="refunded">Refunded {money(allAccountsTotal.refunded)}</span>
                  <span className="net">Net {money(allAccountsTotal.collected - allAccountsTotal.refunded)}</span>
                </div>
              )}
            </div>
            {accountTotals.map((a, i) => (
              <div className="account-card" key={a.accountName}>
                <div className="account-name">
                  {a.accountName} <span className="rank">#{i + 1}</span>
                </div>
                <div className="collected-label">Collected</div>
                <div className="collected">{money(a.collected)}</div>
                {a.refunded > 0 && (
                  <div className="sub-line">
                    <span className="refunded">Refunded {money(a.refunded)}</span>
                    <span className="net">Net {money(a.net)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-wrapper">
        <table className="bookings-table">
          <thead>
            <tr>
              <th colSpan={bookingColumns.length}>
                <button
                  type="button"
                  className="column-group-toggle"
                  onClick={() => setBookingDetailsCollapsed((prev) => !prev)}
                  aria-label={bookingDetailsCollapsed ? "Expand booking details columns" : "Collapse booking details columns"}
                >
                  {bookingDetailsCollapsed ? "▸" : "▾"}
                </button>
                {" "}Booking Details
              </th>
              <th colSpan={paymentColumns.length} className="payment-col">Payment Details</th>
            </tr>
            <tr>
              {visibleColumns.map((c) => (
                <th key={c.key} className={c.group === "payment" ? "payment-col" : undefined}>
                  {c.subgroupHeader && (
                    <>
                      <button
                        type="button"
                        className="column-group-toggle"
                        onClick={() => toggleSubgroup(c.subgroup)}
                        aria-label={
                          collapsedSubgroups.has(c.subgroup)
                            ? `Expand ${c.label} columns`
                            : `Collapse ${c.label} columns`
                        }
                      >
                        {collapsedSubgroups.has(c.subgroup) ? "▸" : "▾"}
                      </button>{" "}
                    </>
                  )}
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length > 0 ? (
              filteredBookings.map((b) => (
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
                <td colSpan={visibleColumns.length} className="empty-row-cell">No bookings found</td>
              </tr>
            )}
          </tbody>
          {filteredBookings.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={bookingColumns.length}><strong>Column Sum</strong></td>
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
