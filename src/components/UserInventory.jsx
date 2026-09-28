// src/components/UserInventory.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../css/theme.css";
import "../css/components.css";
import "./UserInventory.css";
import config from "../config";
import ManageCheckInDrawer from "./checkin/ManageCheckInDrawer";
import { toLocalDateStr, formatDateDMY } from "../utils/date";
import { QRCodeSVG } from "qrcode.react";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";

// Display-only relabeling of BookingSource values - the stored/compared
// value stays CALL/CALLS_GST everywhere else, only what staff see changes
// (mirrors BookingSource.java's getDisplayName(), which the dynamic
// booking-source dropdown already reads - these raw-value renders don't).
const sourceLabel = (source) =>
  ({ CALL: "VINTARA", CALLS_GST: "VINTARA + GST BILL" }[source]) || source;

// The guest self check-in page a booking's link/QR points to (see
// GuestCheckInPage.jsx, route /checkin/:token).
const getCheckInUrl = (booking) =>
  booking.checkInToken ? `${window.location.origin}/checkin/${booking.checkInToken}` : null;

// Resort select's menu is portaled to <body> (see menuPortalTarget below), so
// UserInventory.css's ".user-inventory-wrapper .filter-item .react-select__*"
// rules no longer reach it - themedSelectStyles sets the app's purple theme
// directly instead of letting it fall back to react-select's default blue.
const resortSelectStyles = themedSelectStyles();

const UserInventory = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch (e) {
      console.error("Failed to parse user session", e);
      return null;
    }
  }, []);

  const isSingleResortRole = ["PROPERTY_MANAGER", "RECEPTION"].includes(user?.role);

  const [allResorts, setAllResorts] = useState([]);
  const [selectedResort, setSelectedResortState] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  // Arrivals/departures/Grid matching are all relative to whichever date is
  // currently selected, not hardcoded to "today" - cheap to recompute, no
  // need for useMemo.
  const selectedDateStr = toLocalDateStr(selectedDate);
  const [bookings, setBookings] = useState([]);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [loadingResorts, setLoadingResorts] = useState(true);

  // View Switcher Tab State: 'GRID' (Room Focus) or 'BOOKINGS' (Reservation Focus),
  // and, within Bookings, an optional single-booking filter (set via "View
  // Linked Booking" from Grid View). Both are kept in the URL (?tab=,
  // ?bookingFilterId=) so a browser refresh stays exactly where you were —
  // same tab, and the same single-booking view if that's what you had open —
  // instead of resetting to Grid / the full list.
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState(
    searchParams.get("tab") === "BOOKINGS" ? "BOOKINGS" : "GRID"
  );
  const [bookingFilterId, setBookingFilterIdState] = useState(() => {
    const raw = searchParams.get("bookingFilterId");
    return raw ? Number(raw) : null;
  });

  // Active Bookings list can be narrowed to just today's (or whatever date
  // is selected) arrivals or departures - the by-date fetch now returns
  // both, so this is how staff tell them apart / find a departing guest
  // without needing to flip the date picker back a day.
  const [arrivalDepartureFilter, setArrivalDepartureFilter] = useState("ALL");

  // Single source of truth for updating ?tab=/?bookingFilterId=/?resortId= —
  // takes whichever changed so a click that sets several at once does it in
  // one setSearchParams call instead of several separate ones, which would
  // otherwise race (a later call's "previous params" wouldn't yet reflect an
  // earlier call in the same event handler).
  const updateViewState = ({ tab, bookingFilterId: filterId, resortId } = {}) => {
    if (tab !== undefined) setActiveTabState(tab);
    if (filterId !== undefined) setBookingFilterIdState(filterId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab !== undefined) next.set("tab", tab);
      if (filterId !== undefined) {
        if (filterId == null) next.delete("bookingFilterId");
        else next.set("bookingFilterId", String(filterId));
      }
      if (resortId !== undefined) {
        if (resortId == null) next.delete("resortId");
        else next.set("resortId", String(resortId));
      }
      return next;
    }, { replace: true });
  };

  const setActiveTab = (tab) => updateViewState({ tab });
  const setBookingFilterId = (id) => updateViewState({ bookingFilterId: id });
  const viewSingleBookingInList = (booking) =>
    updateViewState({ tab: "BOOKINGS", bookingFilterId: booking.id });

  // Kept in the URL (?resortId=) alongside tab/bookingFilterId above, so a
  // refresh reopens the same resort instead of falling back to the first one.
  const setSelectedResort = (resort) => {
    setSelectedResortState(resort);
    updateViewState({ resortId: resort?.value ?? null });
  };

  // Operational Modals State
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showManageCheckIn, setShowManageCheckIn] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  // Balance can be split across several accounts (e.g. part cash, part to
  // another account) - each row picks from the same creditDestinations
  // dropdown and specifies how much of the balance went to that account.
  const [splitRows, setSplitRows] = useState([{ key: 0, paymentAccount: null, amount: "" }]);
  const [creditDestinations, setCreditDestinations] = useState([]);
  // Optional discount applied to the balance at check-in - splits below must
  // then sum to (balanceAmount - discount) instead of the raw balance.
  const [checkInDiscount, setCheckInDiscount] = useState("");
  const [checkInDiscountReason, setCheckInDiscountReason] = useState("");

  const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState(false);
  const [checkoutReason, setCheckoutReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  // Which single account the refund is paid out from - the full refund
  // amount (entered above) goes to this one account.
  const [refundAccount, setRefundAccount] = useState(null);

  // Extend Stay: creates a brand new (WALKIN-style) booking for the
  // extension period instead of mutating the checked-in booking in place -
  // old checkout date becomes the new booking's check-in date. Staff picks
  // the new checkout date, category/room, and total; everything else
  // (guest details, document verification) carries over automatically on
  // the backend via the extendedFrom link.
  const [showExtendStayModal, setShowExtendStayModal] = useState(false);
  const [extendNewCheckOutDate, setExtendNewCheckOutDate] = useState("");
  const [extendCategory, setExtendCategory] = useState(null);
  const [extendRoom, setExtendRoom] = useState(null);
  const [extendTotalAmount, setExtendTotalAmount] = useState("");
  const [extendCategoryOptions, setExtendCategoryOptions] = useState([]);
  const [showCollectBalanceModal, setShowCollectBalanceModal] = useState(false);

  // Late Checkout Charge: a standalone same-day fee for leaving later than
  // the standard checkout time - deliberately NOT part of the room
  // balance/total (see BookingPayment.lateCheckoutCharge on the backend).
  // Single account, not the multi-row split-payment UI used for the balance.
  const [showLateCheckoutModal, setShowLateCheckoutModal] = useState(false);
  const [lateCheckoutAmount, setLateCheckoutAmount] = useState("");
  const [lateCheckoutReason, setLateCheckoutReason] = useState("");
  const [lateCheckoutAccount, setLateCheckoutAccount] = useState(null);
  // The backend adds each submission on top of the existing charge (by
  // design - a stay can legitimately get more than one late checkout
  // charge) - guards against a double-click/slow-network double-submit
  // silently doubling the amount, which has no server-side protection.
  const [isSubmittingLateCheckout, setIsSubmittingLateCheckout] = useState(false);

  // Extra Charge: a standalone charge for extra guests, an extra mattress,
  // etc. - same pattern as Late Checkout Charge above (see
  // BookingPayment.extraCharge on the backend).
  const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
  const [extraChargeAmount, setExtraChargeAmount] = useState("");
  const [extraChargeReason, setExtraChargeReason] = useState("");
  const [extraChargeAccount, setExtraChargeAccount] = useState(null);
  const [isSubmittingExtraCharge, setIsSubmittingExtraCharge] = useState(false);

  // Guards against double-click/slow-network double-submits on the other
  // modals that create/collect a payment or record - each fires a single
  // fetch with no server-side idempotency protection.
  const [isSubmittingExtendStay, setIsSubmittingExtendStay] = useState(false);
  const [isSubmittingCollectBalance, setIsSubmittingCollectBalance] = useState(false);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [isSubmittingEarlyCheckout, setIsSubmittingEarlyCheckout] = useState(false);

  // Fetch payment accounts assigned to the currently selected resort
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

  // Fetch all active resorts
  useEffect(() => {
    const fetchActiveResorts = async () => {
      try {
        setLoadingResorts(true);
        const res = await fetch(`${config.BASE_URL}/api/resorts/active`, {
          headers: config.getHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch active resorts");
        const data = await res.json();
        const options = data.map((r) => ({
          value: r.id,
          label: r.name,
          categories: r.categories || [],
        }));
        setAllResorts(options);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingResorts(false);
      }
    };
    fetchActiveResorts();
  }, []);

  // Resort list is already scoped server-side (GET /api/resorts/active
  // filters to the caller's assigned resorts for every non-SUPER_ADMIN role),
  // so no client-side filtering is needed here.
  const resorts = allResorts;

  // Auto-select: reopen whatever resort was in the URL (?resortId=) so a
  // refresh stays put instead of always falling back to the first resort;
  // only default to resorts[0] when there's no (valid) resortId to restore.
  // Gated by a ref (not selectedResort state) so this only ever runs once -
  // depending on selectedResort instead let this effect's stale "resorts
  // just loaded" instance fire *after* a user's manual pick (a real race:
  // the two updates are separate commits, so ordering isn't guaranteed) and
  // clobber it back to the default.
  const didAutoSelectResort = useRef(false);
  useEffect(() => {
    if (resorts.length === 0 || didAutoSelectResort.current) return;
    didAutoSelectResort.current = true;
    const savedResortId = searchParams.get("resortId");
    const savedResort = savedResortId != null
      ? resorts.find((r) => String(r.value) === savedResortId)
      : null;
    setSelectedResort(savedResort || resorts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resorts]);

  // Fetch bookings. Also called after closing the Manage Check-In drawer so
  // document-verification status (and anything else changed there) reflects
  // immediately instead of needing a full page refresh.
  const fetchBookings = async () => {
    if (!selectedResort) {
      setBookings([]);
      return;
    }
    try {
      const dateStr = toLocalDateStr(selectedDate);
      const url = `${config.BASE_URL}/api/bookings/by-date?resortId=${selectedResort.value}&date=${dateStr}`;
      const res = await fetch(url, { headers: config.getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data = await res.json();
      setBookings(data);
    } catch (err) {
      console.error(err);
      setBookings([]);
    }
  };

  // Skip clearing the filter on the first run where selectedResort actually
  // has a value (the initial auto-select on mount) — otherwise a
  // bookingFilterId restored from the URL on page refresh gets wiped out
  // immediately. Note this effect also fires once on mount with
  // selectedResort still null (before the auto-select effect runs), which
  // must NOT consume this flag — otherwise the real first run, right after,
  // would look like a "later" run and clear the filter anyway.
  const isFirstBookingsFetch = useRef(true);
  useEffect(() => {
    fetchBookings();
    if (!selectedResort) {
      return;
    }
    if (isFirstBookingsFetch.current) {
      isFirstBookingsFetch.current = false;
    } else if (bookingFilterId != null) {
      // Guarded so switching resorts doesn't fire a needless setSearchParams
      // call when there's nothing to clear - that redundant call was racing
      // with (and clobbering) the resortId the resort switch had just written
      // to the URL moments earlier.
      setBookingFilterId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResort, selectedDate]);

  // Map categories to current active room matches. The by-date fetch now
  // includes today's departures too (so Active Bookings can show/act on
  // them), but the Grid tile for a room should only ever reflect who's
  // arriving/staying there - not a guest who's just leaving that room today
  // - otherwise a same-day turnover room would ambiguously match both.
  const categories = useMemo(() => {
    if (!selectedResort?.categories?.length) return [];

    return selectedResort.categories
      .filter((cat) => cat.rooms?.length > 0)
      .map((cat) => ({
        ...cat,
        rooms: cat.rooms.map((room) => {
          const matchingBooking = bookings.find((booking) =>
            !["EARLY_CHECK_OUT", "CANCELLED"].includes(booking.status) &&
            booking.checkOutDate !== selectedDateStr &&
            booking.bookingItems?.some((item) => item.roomIds?.includes(room.id))
          );
          return { ...room, booking: matchingBooking };
        }),
      }));
  }, [selectedResort, bookings, selectedDateStr]);

  // Filter out any booking profiles that have already departed or been
  // cancelled, and list not-yet-arrived BOOKED guests before CHECKED_IN ones
  // - that's the order front desk needs to act on them in.
  const bookingStatusOrder = { BOOKED: 0, CHECKED_IN: 1 };
  const activeBookingsList = useMemo(() => {
    return bookings
      .filter((b) => !["EARLY_CHECK_OUT", "CANCELLED"].includes(b.status))
      .sort((a, b) => (bookingStatusOrder[a.status] ?? 2) - (bookingStatusOrder[b.status] ?? 2));
  }, [bookings]);

  // Counted off the full active list (not displayedBookingsList) so the
  // count still reflects everyone even while a single-booking filter is
  // active - staff need the overall picture, not just what's on screen.
  const pendingDocVerificationCount = useMemo(
    () => activeBookingsList.filter((b) => !b.documentsVerified).length,
    [activeBookingsList]
  );
  const pendingCheckInCount = useMemo(
    () => activeBookingsList.filter((b) => b.status === "BOOKED").length,
    [activeBookingsList]
  );

  const arrivalsCount = useMemo(
    () => activeBookingsList.filter((b) => b.checkInDate === selectedDateStr).length,
    [activeBookingsList, selectedDateStr]
  );
  const departuresCount = useMemo(
    () => activeBookingsList.filter((b) => b.checkOutDate === selectedDateStr).length,
    [activeBookingsList, selectedDateStr]
  );
  const arrivalFilteredList = useMemo(() => {
    if (arrivalDepartureFilter === "ARRIVALS") {
      return activeBookingsList.filter((b) => b.checkInDate === selectedDateStr);
    }
    if (arrivalDepartureFilter === "DEPARTURES") {
      return activeBookingsList.filter((b) => b.checkOutDate === selectedDateStr);
    }
    return activeBookingsList;
  }, [activeBookingsList, arrivalDepartureFilter, selectedDateStr]);

  // Narrowed to a single booking when arriving via "View Linked Booking" from
  // Grid View; otherwise the arrival/departure-filtered list above.
  const displayedBookingsList = useMemo(() => {
    if (bookingFilterId == null) return arrivalFilteredList;
    return arrivalFilteredList.filter((b) => b.id === bookingFilterId);
  }, [arrivalFilteredList, bookingFilterId]);

  // Check-in is allowed any day from the booking's arrival date (checkInDate)
  // through its departure date (checkOutDate) — covers late/delayed arrivals
  // that show up after the original arrival date but before checkout.
  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);
  const canCheckInToday = (booking) =>
    todayStr >= booking.checkInDate && todayStr <= booking.checkOutDate;

  // Early Checkout only means anything strictly before the scheduled
  // checkout date - on the scheduled date itself, leaving isn't "early"
  // (a 1-night stay can only be left early on its check-in day; a 2-night
  // stay can be left early on either of its first two days, but not on the
  // actual checkout day). Backend enforces the same window in
  // BookingService.processBookingExit.
  const canEarlyCheckoutToday = (booking) =>
    todayStr >= booking.checkInDate && todayStr < booking.checkOutDate;


  // Initialize collapse states
  useEffect(() => {
    if (!categories.length) return;
    setCollapsedCategories((prev) => {
      const updated = { ...prev };
      categories.forEach((cat) => {
        if (!(cat.id in updated)) updated[cat.id] = false;
      });
      return updated;
    });
  }, [categories]);

  const toggleCategory = (catId) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const openCheckInModal = (booking) => {
    setSelectedBooking(booking);
    // Pre-fill the single row with the full balance so the common
    // single-account case needs zero extra typing - just pick the account.
    const dueAtCheckIn = booking.pendingBalanceAmount ?? booking.balanceAmount ?? 0;
    setSplitRows([{ key: 0, paymentAccount: null, amount: dueAtCheckIn > 0 ? String(dueAtCheckIn) : "" }]);
    setCheckInDiscount("");
    setCheckInDiscountReason("");
    setShowCheckInModal(true);
  };

  // Splits must sum to this, not the raw balance, once a discount is entered.
  const effectiveBalanceDue = Math.max(
    0,
    (selectedBooking?.pendingBalanceAmount ?? selectedBooking?.balanceAmount ?? 0) - (parseFloat(checkInDiscount) || 0)
  );

  const handleDiscountChange = (value) => {
    setCheckInDiscount(value);
    // Convenience: with a single split row, keep it in sync with the new
    // effective balance automatically - with more than one row it's
    // ambiguous how to redistribute, so leave those to staff.
    if (splitRows.length === 1) {
      const newEffective = Math.max(0, (selectedBooking?.pendingBalanceAmount ?? selectedBooking?.balanceAmount ?? 0) - (parseFloat(value) || 0));
      setSplitRows([{ ...splitRows[0], amount: newEffective > 0 ? String(newEffective) : "" }]);
    }
  };

  const addSplitRow = () => {
    setSplitRows((prev) => [...prev, { key: (prev[prev.length - 1]?.key ?? 0) + 1, paymentAccount: null, amount: "" }]);
  };

  const removeSplitRow = (key) => {
    setSplitRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const updateSplitRow = (key, changes) => {
    setSplitRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  };

  const splitTotal = splitRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const openExtendStayModal = (booking) => {
    setSelectedBooking(booking);
    const nextDay = new Date(booking.checkOutDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setExtendNewCheckOutDate(toLocalDateStr(nextDay));
    // Pre-fill with the room the guest is already in - staff only need to
    // pick something else if it turns out to be unavailable for the
    // extended dates (surfaced as the normal "Room already booked" error
    // on submit, same as any other booking creation failure).
    const firstItem = booking.bookingItems?.[0];
    const firstRoomId = firstItem?.roomIds?.[0];
    setExtendCategory(
      firstItem ? { value: firstItem.roomCategoryId, label: firstItem.roomCategoryName } : null
    );
    setExtendRoom(
      firstRoomId != null ? { value: firstRoomId, label: firstItem.roomNumbers?.[0] } : null
    );
    setExtendTotalAmount("");
    setExtendCategoryOptions([]);
    setExtendOptionsLoaded(false);
    setShowExtendStayModal(true);
  };

  // Available categories/rooms for the extension period - no ignoreBookingId
  // here, this is a genuinely new booking with nothing of its own to exclude.
  const [extendOptionsLoaded, setExtendOptionsLoaded] = useState(false);
  useEffect(() => {
    if (!showExtendStayModal || !selectedBooking || !extendNewCheckOutDate) return;
    setExtendOptionsLoaded(false);
    const fetchExtendRoomOptions = async () => {
      try {
        const url = `${config.BASE_URL}/api/resorts/active?checkInDate=${selectedBooking.checkOutDate}&checkOutDate=${extendNewCheckOutDate}`;
        const res = await fetch(url, { headers: config.getHeaders() });
        const data = await res.json();
        const resortData = data.find((r) => r.id === selectedBooking.resortId);
        const categories = (resortData?.categories || [])
          .filter((c) => c.rooms?.length > 0)
          .map((c) => ({ value: c.id, label: c.name, rooms: c.rooms }));
        setExtendCategoryOptions(categories);
      } catch (err) {
        console.error(err);
        setExtendCategoryOptions([]);
      } finally {
        setExtendOptionsLoaded(true);
      }
    };
    fetchExtendRoomOptions();
  }, [showExtendStayModal, selectedBooking, extendNewCheckOutDate]);

  const extendRoomOptions = (extendCategoryOptions.find((c) => c.value === extendCategory?.value)?.rooms || [])
    .map((r) => ({ value: r.id, label: r.roomNumber }));

  // Once availability actually loads, flag it right away if the currently
  // picked room (usually the pre-filled current room) isn't in the real
  // free-room list, instead of only finding out on submit.
  const extendRoomUnavailable =
    extendOptionsLoaded && extendRoom && !extendRoomOptions.some((r) => r.value === extendRoom.value);

  const openCollectBalanceModal = (booking) => {
    setSelectedBooking(booking);
    const pending = booking.pendingBalanceAmount ?? booking.balanceAmount ?? 0;
    setSplitRows([{ key: 0, paymentAccount: null, amount: pending > 0 ? String(pending) : "" }]);
    setShowCollectBalanceModal(true);
  };

  const openLateCheckoutModal = (booking) => {
    setSelectedBooking(booking);
    setLateCheckoutAmount("");
    setLateCheckoutReason("");
    setLateCheckoutAccount(null);
    setShowLateCheckoutModal(true);
  };

  const handleLateCheckoutChargeSubmit = async () => {
    if (!selectedBooking || isSubmittingLateCheckout) return;
    const amount = parseFloat(lateCheckoutAmount) || 0;
    if (amount <= 0) {
      showToast("Enter the late checkout charge amount.", "warning");
      return;
    }
    if (!lateCheckoutAccount) {
      showToast("Select which account collected the late checkout charge.", "warning");
      return;
    }

    setIsSubmittingLateCheckout(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${selectedBooking.id}/late-checkout-charge`, {
        method: "PUT",
        headers: config.getHeaders(),
        body: JSON.stringify({
          amount,
          reason: lateCheckoutReason.trim() || null,
          paymentAccountId: lateCheckoutAccount.value,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to add late checkout charge");
      }

      setBookings((prev) =>
        prev.map((bk) =>
          bk.id === selectedBooking.id
            ? {
                ...bk,
                lateCheckoutCharge: (bk.lateCheckoutCharge || 0) + amount,
                lateCheckoutReason: lateCheckoutReason.trim() || null,
                lateCheckoutCreditedToAccountName: lateCheckoutAccount.label,
              }
            : bk
        )
      );
      setShowLateCheckoutModal(false);
      setSelectedBooking(null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to add late checkout charge. Please try again.", "danger");
    } finally {
      setIsSubmittingLateCheckout(false);
    }
  };

  const openExtraChargeModal = (booking) => {
    setSelectedBooking(booking);
    setExtraChargeAmount("");
    setExtraChargeReason("");
    setExtraChargeAccount(null);
    setShowExtraChargeModal(true);
  };

  const handleExtraChargeSubmit = async () => {
    if (!selectedBooking || isSubmittingExtraCharge) return;
    const amount = parseFloat(extraChargeAmount) || 0;
    if (amount <= 0) {
      showToast("Enter the extra charge amount.", "warning");
      return;
    }
    if (!extraChargeAccount) {
      showToast("Select which account collected the extra charge.", "warning");
      return;
    }

    setIsSubmittingExtraCharge(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${selectedBooking.id}/extra-charge`, {
        method: "PUT",
        headers: config.getHeaders(),
        body: JSON.stringify({
          amount,
          reason: extraChargeReason.trim() || null,
          paymentAccountId: extraChargeAccount.value,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to add extra charge");
      }

      setBookings((prev) =>
        prev.map((bk) =>
          bk.id === selectedBooking.id
            ? {
                ...bk,
                extraCharge: (bk.extraCharge || 0) + amount,
                extraChargeReason: extraChargeReason.trim() || null,
                extraChargeCreditedToAccountName: extraChargeAccount.label,
              }
            : bk
        )
      );
      setShowExtraChargeModal(false);
      setSelectedBooking(null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to add extra charge. Please try again.", "danger");
    } finally {
      setIsSubmittingExtraCharge(false);
    }
  };

  const handleExtendStaySubmit = async () => {
    if (!selectedBooking || isSubmittingExtendStay) return;
    if (!extendNewCheckOutDate || extendNewCheckOutDate <= selectedBooking.checkOutDate) {
      showToast("Select a checkout date after the current one.", "warning");
      return;
    }
    if (!extendCategory || !extendRoom) {
      showToast("Please select a category and room.", "warning");
      return;
    }
    const totalAmount = parseFloat(extendTotalAmount) || 0;
    if (totalAmount <= 0) {
      showToast("Enter the total amount for the extension.", "warning");
      return;
    }

    setIsSubmittingExtendStay(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${selectedBooking.id}/extensions`, {
        method: "POST",
        headers: config.getHeaders(),
        body: JSON.stringify({
          newCheckOutDate: extendNewCheckOutDate,
          roomCategoryId: extendCategory.value,
          roomIds: [extendRoom.value],
          totalAmount,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to create extension booking");
      }

      setShowExtendStayModal(false);
      setSelectedBooking(null);
      // The new booking is a separate, normal BOOKED record (own check-in
      // date) - refresh the list so it shows up if it belongs on the
      // currently-viewed date, same as any other newly created booking.
      // Staff check it in later through the exact same Check In button/flow
      // as every other booking - nothing special happens here.
      fetchBookings();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to create extension booking. Please try again.", "danger");
    } finally {
      setIsSubmittingExtendStay(false);
    }
  };

  const handleCollectBalanceSubmit = async () => {
    if (!selectedBooking || isSubmittingCollectBalance) return;
    if (splitRows.some((r) => !r.paymentAccount || !r.amount || parseFloat(r.amount) <= 0)) {
      showToast("Please select an account and enter an amount for every split row.", "warning");
      return;
    }
    const pendingDue = selectedBooking.pendingBalanceAmount ?? selectedBooking.balanceAmount ?? 0;
    if (Math.round(splitTotal * 100) !== Math.round(pendingDue * 100)) {
      showToast(`Split amounts (₹${splitTotal}) must add up to the balance due (₹${pendingDue}).`, "warning");
      return;
    }

    const splitsPayload = splitRows.map((r) => ({ paymentAccountId: r.paymentAccount.value, amount: parseFloat(r.amount) }));

    setIsSubmittingCollectBalance(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${selectedBooking.id}/collect-balance`, {
        method: "PUT",
        headers: config.getHeaders(),
        body: JSON.stringify(splitsPayload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to collect balance");
      }

      const balanceSplits = splitRows.map((r) => ({ accountName: r.paymentAccount.label, amount: parseFloat(r.amount) }));
      setBookings((prev) =>
        prev.map((bk) =>
          bk.id === selectedBooking.id
            ? {
                ...bk,
                pendingBalanceAmount: 0,
                balanceSplits,
                balanceCreditedToAccountName: balanceSplits.length === 1 ? balanceSplits[0].accountName : null,
              }
            : bk
        )
      );
      setShowCollectBalanceModal(false);
      setSelectedBooking(null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to collect balance. Please try again.", "danger");
    } finally {
      setIsSubmittingCollectBalance(false);
    }
  };

  const openEarlyCheckoutModal = (booking) => {
    setSelectedBooking(booking);
    setCheckoutReason("");
    setRefundAmount("");
    setRefundAccount(null);
    setShowEarlyCheckoutModal(true);
  };

  const handleCheckInSubmit = async () => {
    if (!selectedBooking || isSubmittingCheckIn) return;

    const discountValue = parseFloat(checkInDiscount) || 0;
    const balanceDueForDiscount = selectedBooking.pendingBalanceAmount ?? selectedBooking.balanceAmount ?? 0;
    if (discountValue < 0 || discountValue > balanceDueForDiscount) {
      showToast(`Discount must be between ₹0 and the balance due (₹${balanceDueForDiscount}).`, "warning");
      return;
    }
    if (discountValue > 0 && !checkInDiscountReason.trim()) {
      showToast("Please enter a reason for the discount.", "warning");
      return;
    }

    let splitsPayload = [];
    if (effectiveBalanceDue > 0) {
      if (splitRows.some((r) => !r.paymentAccount || !r.amount || parseFloat(r.amount) <= 0)) {
        showToast("Please select an account and enter an amount for every split row.", "warning");
        return;
      }
      if (Math.round(splitTotal * 100) !== Math.round(effectiveBalanceDue * 100)) {
        showToast(`Split amounts (₹${splitTotal}) must add up to the balance due (₹${effectiveBalanceDue}).`, "warning");
        return;
      }
      splitsPayload = splitRows.map((r) => ({ paymentAccountId: r.paymentAccount.value, amount: parseFloat(r.amount) }));
    }

    setIsSubmittingCheckIn(true);
    try {
      const params = new URLSearchParams();
      if (discountValue > 0) {
        params.set("discountAmount", discountValue);
        params.set("discountReason", checkInDiscountReason.trim());
      }
      const url = `${config.BASE_URL}/api/bookings/${selectedBooking.id}/check-in${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: config.getHeaders(),
        body: JSON.stringify(splitsPayload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Check-in failed");
      }
      const updatedBooking = await res.json();

      // The check-in endpoint returns the raw Booking entity (not the DTO the
      // list view fetches), so it has no balanceSplits field - fill it in
      // from what was just picked so the list's "Balance Collected In" line
      // shows immediately instead of only after the next refetch.
      const balanceSplits = effectiveBalanceDue > 0
        ? splitRows.map((r) => ({ accountName: r.paymentAccount.label, amount: parseFloat(r.amount) }))
        : [];

      setBookings((prev) =>
        prev.map((b) =>
          b.id === selectedBooking.id
            ? {
                ...b,
                ...updatedBooking,
                status: "CHECKED_IN",
                pendingBalanceAmount: 0,
                balanceSplits,
                balanceCreditedToAccountName: balanceSplits.length === 1 ? balanceSplits[0].accountName : null,
              }
            : b
        )
      );

      setShowCheckInModal(false);
      setSelectedBooking(null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Check-in failed. Please try again.", "danger");
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const handleEarlyCheckoutSubmit = async () => {
    if (isSubmittingEarlyCheckout) return;
    if (!checkoutReason.trim()) return showToast("Please enter a reason", "warning");
    if (refundAmount === "" || isNaN(parseFloat(refundAmount))) return showToast("Please enter a valid numeric refund amount", "warning");

    const refundValue = parseFloat(refundAmount);
    if (refundValue > 0 && !refundAccount) {
      showToast("Please select which account the refund is being paid out from.", "warning");
      return;
    }

    const calculatedTargetStatus = selectedBooking.status === "CHECKED_IN" ? "EARLY_CHECK_OUT" : "CANCELLED";

    setIsSubmittingEarlyCheckout(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${selectedBooking.id}/exit`, {
        method: "PUT",
        headers: {
          ...config.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exitStatus: calculatedTargetStatus,
          reason: checkoutReason,
          refundAmount: refundValue,
          refundAccountId: refundValue > 0 ? refundAccount.value : null,
        }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("You can only cancel or check out bookings you created.");
        }
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to process exit");
      }
      const updatedBooking = await res.json();

      setBookings((prev) =>
        prev.map((b) => (b.id === selectedBooking.id ? { ...b, ...updatedBooking, bookingItems: [] } : b))
      );

      setShowEarlyCheckoutModal(false);
      setSelectedBooking(null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to process booking exit. Please try again.", "danger");
    } finally {
      setIsSubmittingEarlyCheckout(false);
    }
  };

  if (loadingResorts) return <p style={{ padding: "20px" }}>Loading resorts...</p>;

  return (
    <div className="user-inventory-wrapper">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <h2 className="page-title">Inventory Dashboard</h2>

      {/* Control Filters Block */}
      <div className="filters">
        <div className="filters-group">
          <div className="filter-item">
            <label>Resort</label>
            <Select
              classNamePrefix="react-select"
              options={resorts}
              value={selectedResort}
              onChange={setSelectedResort}
              placeholder="Select resort..."
              isDisabled={isSingleResortRole && resorts.length === 1}
              // Render the menu into a portal on <body> rather than inline: nested
              // here, it's a flex item inside .filters-group, and flex items paint
              // in their own implicit stacking context, so no z-index on the menu
              // itself could out-rank the Date field painted right after it in the
              // stacked mobile layout - portalling escapes that entirely, and also
              // .content-viewport's overflow-y:auto, which was clipping/truncating
              // the option list to a single row instead of just letting it scroll.
              menuPortalTarget={menuPortalTarget}
              menuPosition={menuPosition}
              styles={resortSelectStyles}
            />
          </div>
          <div className="filter-item">
            <label>Date</label>
            <DatePicker
              selected={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              dateFormat="dd/MM/yyyy"
              className="custom-datepicker"
            />
          </div>
        </div>

        {/* Perspective View Switcher Tabs */}
        <div className="view-switcher-tabs">
          <button
            className={`view-tab-btn ${activeTab === "GRID" ? "active" : ""}`}
            onClick={() => setActiveTab("GRID")}
          >
            Room Grid View
          </button>
          <button
            className={`view-tab-btn ${activeTab === "BOOKINGS" ? "active" : ""}`}
            onClick={() => updateViewState({ tab: "BOOKINGS", bookingFilterId: null })}
          >
            Active Bookings ({activeBookingsList.length})
          </button>
        </div>
      </div>

      {/* PERSPECTIVE ONE: PHYSICAL ROOM GRID VIEW */}
      {activeTab === "GRID" && (
        <div className="inventory-categories">
          {categories.length === 0 ? (
            <p style={{ padding: "20px" }}>No rooms configured for this resort selection.</p>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="category-card">
                <div className="category-header" onClick={() => toggleCategory(cat.id)}>
                  <h3>{cat.name}</h3>
                  <span>{collapsedCategories[cat.id] ? "+" : "-"}</span>
                </div>
                {!collapsedCategories[cat.id] && (
                  <div className="rooms-container">
                    {cat.rooms.map((room) => {
                      const booking = room.booking;
                      const roomStatusClass = !booking
                        ? "available"
                        : booking.status === "CHECKED_IN"
                        ? "checked-in"
                        : "booked";
                      return (
                        <div key={room.id} className={`room-card ${roomStatusClass}`}>
                          <h4>Room {room.roomNumber}</h4>
                          {booking ? (
                            <div className="booking-info">
                              <p><strong>Guest:</strong> <strong>{booking.customerName}</strong></p>
                              <p><strong>Status:</strong> {booking.status}</p>
                              <button
                                className="checkin-btn"
                                style={{ width: "100%", marginTop: "8px", padding: "4px" }}
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  viewSingleBookingInList(booking);
                                }}
                              >
                                View Linked Booking
                              </button>
                            </div>
                          ) : (
                            <p>Available</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* PERSPECTIVE TWO: COMPREHENSIVE ACTIVE BOOKINGS LIST VIEW */}
      {activeTab === "BOOKINGS" && (
        <div className="bookings-list-view">
          <div className="view-switcher-tabs bookings-list-view__filter-tabs">
            <button
              className={`view-tab-btn ${arrivalDepartureFilter === "ALL" ? "active" : ""}`}
              onClick={() => setArrivalDepartureFilter("ALL")}
            >
              All ({activeBookingsList.length})
            </button>
            <button
              className={`view-tab-btn ${arrivalDepartureFilter === "ARRIVALS" ? "active" : ""}`}
              onClick={() => setArrivalDepartureFilter("ARRIVALS")}
            >
              Check-ins ({arrivalsCount})
            </button>
            <button
              className={`view-tab-btn ${arrivalDepartureFilter === "DEPARTURES" ? "active" : ""}`}
              onClick={() => setArrivalDepartureFilter("DEPARTURES")}
            >
              Check-outs ({departuresCount})
            </button>
          </div>

          {(pendingCheckInCount > 0 || pendingDocVerificationCount > 0) && (
            <div className="inventory-alerts-row">
              {pendingCheckInCount > 0 && (
                <div className="inventory-alert-banner inventory-alert-banner--warning">
                  <span>⚠ {pendingCheckInCount} booking{pendingCheckInCount === 1 ? "" : "s"} awaiting check-in</span>
                </div>
              )}
              {pendingDocVerificationCount > 0 && (
                <div className="inventory-alert-banner inventory-alert-banner--danger">
                  <span>⚠ {pendingDocVerificationCount} booking{pendingDocVerificationCount === 1 ? "" : "s"} awaiting document verification</span>
                </div>
              )}
            </div>
          )}

          {bookingFilterId != null && (
            <div className="inventory-alert-banner inventory-alert-banner--info">
              <span>Showing only the booking selected from Room Grid View.</span>
              <button
                type="button"
                className="checkin-btn inventory-alert-banner__action"
                onClick={() => setBookingFilterId(null)}
              >
                Show All Bookings
              </button>
            </div>
          )}

          {displayedBookingsList.length === 0 ? (
            <p className="inventory-empty-state">No active reservations tracked on this date target room matrix.</p>
          ) : (
            displayedBookingsList.map((b) => (
              <div key={b.id} className="booking-list-card">
                <div className="booking-list-card__header">
                  <div>
                    <h3 className="booking-list-card__title">{b.customerName} <span className="booking-list-card__title-id">(ID: #{b.id})</span></h3>
                    <p className="booking-list-card__meta">Contact: {b.customerContactNumber} | Source: <strong>{sourceLabel(b.source)}</strong></p>
                    {b.extendedFromBookingId && (
                      <p className="booking-list-card__tag">
                        <span className="vt-badge vt-badge-danger">
                          Extended from Booking #{b.extendedFromBookingId} ({b.extendedFromCustomerName})
                        </span>
                      </p>
                    )}
                    {b.extendedIntoBookingId && (
                      <p className="booking-list-card__tag">
                        <span className="vt-badge vt-badge-success">
                          → Extended into Booking #{b.extendedIntoBookingId}
                        </span>
                      </p>
                    )}
                    <p className="booking-list-card__total"><strong>Total Headcount:</strong> {(b.adults ?? 0) + (b.kids ?? 0)} People ({b.adults ?? 0} Adults, {b.kids ?? 0} Kids)</p>
                    {b.remarks && (
                      <p className="booking-list-card__remarks">
                        <strong>Remarks:</strong> {b.remarks}
                      </p>
                    )}
                  </div>
                  <div className="booking-list-card__status-col">
                    <span className={`vt-badge ${b.status === "CHECKED_IN" ? "vt-badge-success" : "vt-badge-warning"}`}>
                      {b.status}
                    </span>
                    <p className="booking-list-card__stay">Stay: {formatDateDMY(b.checkInDate)} to {formatDateDMY(b.checkOutDate)} ({b.numberOfNights} Night)</p>
                    {b.createdByUser && (
                      <p className="booking-list-card__created-by">Created By: <strong>{b.createdByUser}</strong></p>
                    )}
                  </div>
                </div>

                {/* Rooms composition details structure layout block */}
                <div className="booking-list-card__rooms">
                  <div className="booking-list-card__rooms-main">
                    <h4 className="booking-list-card__rooms-title">Allocated Room Inventory Breakdown</h4>
                    <div className="booking-list-card__rooms-grid">
                      {b.bookingItems?.map((item, idx) => (
                        <div key={idx} className="booking-list-card__room-item">
                          <strong>{item.roomCategoryName}:</strong> {item.roomNumbers?.join(", ")}
                        </div>
                      ))}
                    </div>
                  </div>

                  {getCheckInUrl(b) && (
                    <div className="booking-list-card__qr">
                      <span className={`vt-badge ${b.documentsVerified ? "vt-badge-success" : "vt-badge-danger"} booking-list-card__qr-badge`}>
                        {b.documentsVerified ? "Document Verification Completed" : "Document Verification Pending"}
                      </span>
                      <a
                        href={getCheckInUrl(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="booking-list-card__qr-link"
                        title="Open guest self check-in page in a new tab"
                      >
                        <QRCodeSVG value={getCheckInUrl(b)} size={90} />
                        <p className="booking-list-card__qr-label">Guest Check-In</p>
                      </a>
                    </div>
                  )}
                </div>

                {/* Financial Ledger Section */}
                <div className="booking-list-card__ledger">
                  <div>
                    <div className="booking-list-card__ledger-items">
                      <p><strong>🛏️ Room Bill:</strong> ₹{b.totalAmount}</p>
                      <p><strong>Paid Advance:</strong> ₹{b.advanceAmount}</p>
                      <p>
                        <strong>Balance Due:</strong>{" "}
                        <span className={(b.pendingBalanceAmount ?? b.balanceAmount) === 0 ? "booking-list-card__amount-ok" : "booking-list-card__amount-due"}>
                          ₹{b.pendingBalanceAmount ?? b.balanceAmount}
                        </span>
                      </p>
                      {b.status === "CHECKED_IN" && b.balanceSplits?.length > 0 && (
                        <p>
                          <strong>Balance Collected In:</strong>{" "}
                          {b.balanceSplits.map((s) => `${s.accountName} (₹${s.amount})`).join(", ")}
                        </p>
                      )}
                      {b.status === "CHECKED_IN" && !(b.balanceSplits?.length > 0) && b.balanceCreditedToAccountName && (
                        <p>
                          <strong>Balance Collected In:</strong> {b.balanceCreditedToAccountName}
                        </p>
                      )}
                      {b.discountAmount > 0 && (
                        <p>
                          <span
                            title={b.discountReason || undefined}
                            className="vt-badge vt-badge-warning"
                          >
                            Discount Applied: ₹{b.discountAmount}{b.discountReason ? ` (${b.discountReason})` : ""}
                          </span>
                        </p>
                      )}
                      {b.lateCheckoutCharge > 0 && (
                        <p>
                          <strong>Late Checkout:</strong> ₹{b.lateCheckoutCharge}
                          {b.lateCheckoutCreditedToAccountName ? ` (${b.lateCheckoutCreditedToAccountName})` : ""}
                          {b.lateCheckoutReason ? ` - ${b.lateCheckoutReason}` : ""}
                        </p>
                      )}
                      {b.extraCharge > 0 && (
                        <p>
                          <strong>Extra Charge:</strong> ₹{b.extraCharge}
                          {b.extraChargeCreditedToAccountName ? ` (${b.extraChargeCreditedToAccountName})` : ""}
                          {b.extraChargeReason ? ` - ${b.extraChargeReason}` : ""}
                        </p>
                      )}
                    </div>

                    {b.foodPreorder && (() => {
                      // Food is collected at check-in the same as the room
                      // balance, so both settle together once checked in.
                      const roomBalance = b.pendingBalanceAmount ?? b.balanceAmount ?? 0;
                      const foodBalance = b.status === "CHECKED_IN" ? 0 : (b.foodBalanceAmount ?? 0);
                      const totalDue = roomBalance + foodBalance;
                      return (
                        <div className="booking-list-card__food-ledger">
                          <p><strong>🍽 Food Total:</strong> ₹{b.totalFoodAmount ?? 0}</p>
                          <p><strong>Food Advance:</strong> ₹{b.advanceFoodAmount ?? 0}</p>
                          <p>
                            <strong>Food Balance:</strong>{" "}
                            <span className={foodBalance === 0 ? "booking-list-card__amount-ok" : "booking-list-card__amount-due"}>
                              ₹{foodBalance}
                            </span>
                          </p>
                          <p>
                            <strong>Total Due:</strong>{" "}
                            <span className={totalDue === 0 ? "booking-list-card__amount-ok" : "booking-list-card__amount-due"}>
                              ₹{totalDue}
                            </span>
                          </p>
                        </div>
                      );
                    })()}
                  </div>

{/* Actions Engine Panel Context */}
                  <div className="booking-list-card__actions">
                    <button
                      className="checkin-btn"
                      onClick={() => {
                        setSelectedBooking(b);
                        setShowManageCheckIn(true);
                      }}
                    >
                      View Documents
                    </button>

                    {b.status === "BOOKED" && (
                      <button
                        className="checkin-btn"
                        onClick={() => openCheckInModal(b)}
                        disabled={!canCheckInToday(b)}
                        title={
                          canCheckInToday(b)
                            ? undefined
                            : todayStr < b.checkInDate
                            ? `Check-in opens on ${formatDateDMY(b.checkInDate)}`
                            : `Check-in window closed after ${formatDateDMY(b.checkOutDate)}`
                        }
                      >
                        Check In
                      </button>
                    )}

                    {b.status === "BOOKED" && (
                      <button
                        className="checkin-btn"
                        onClick={() => openEarlyCheckoutModal(b)}
                      >
                        Cancel Booking
                      </button>
                    )}

                    {b.status === "CHECKED_IN" && (
                      <button
                        className="checkin-btn"
                        onClick={() => openEarlyCheckoutModal(b)}
                        disabled={!canEarlyCheckoutToday(b)}
                        title={
                          !canEarlyCheckoutToday(b)
                            ? `Early checkout is only available before the scheduled checkout date (${formatDateDMY(b.checkOutDate)})`
                            : undefined
                        }
                      >
                        Process Early Checkout
                      </button>
                    )}

                    {b.status === "CHECKED_IN" && !b.extendedIntoBookingId && (
                      <button className="checkin-btn" onClick={() => openExtendStayModal(b)}>
                        Extend Stay
                      </button>
                    )}

                    {b.status === "CHECKED_IN" && (b.pendingBalanceAmount ?? b.balanceAmount) > 0 && (
                      <button className="checkin-btn" onClick={() => openCollectBalanceModal(b)}>
                        Collect Balance
                      </button>
                    )}

                    {b.status === "CHECKED_IN" && (
                      <button
                        className="checkin-btn"
                        onClick={() => openLateCheckoutModal(b)}
                      >
                        Late Checkout
                      </button>
                    )}

                    {b.status === "CHECKED_IN" && (
                      <button
                        className="checkin-btn"
                        onClick={() => openExtraChargeModal(b)}
                      >
                        Extra Charge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Manage Check-In Documents Drawer */}
      {showManageCheckIn && selectedBooking && (
        <ManageCheckInDrawer
          booking={selectedBooking}
          onClose={() => {
            setShowManageCheckIn(false);
            setSelectedBooking(null);
            // Document approve/reject actions happen inside the drawer without
            // telling this list about it — re-fetch so the "Document
            // Verification Pending/Completed" badge is current without
            // needing a full page refresh.
            fetchBookings();
          }}
          onCompleted={() => {
            setShowManageCheckIn(false);
            setSelectedBooking(null);
            fetchBookings();
          }}
        />
      )}

      {/* Check-In Payment Collection Modal Overlay Container */}
      {showCheckInModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal checkin-modal">
            <h3>Complete Check-In &amp; Collect Balance</h3>

            <div className="checkin-modal__summary">
              <p><strong>Lead Guest:</strong> {selectedBooking.customerName}</p>
              <p><strong>Total Bill:</strong> ₹{selectedBooking.totalAmount}</p>
              <p><strong>Outstanding Balance Due:</strong> <span className="checkin-modal__balance">₹{selectedBooking.pendingBalanceAmount ?? selectedBooking.balanceAmount}</span></p>
            </div>

            {(selectedBooking.pendingBalanceAmount ?? selectedBooking.balanceAmount) > 0
              && (selectedBooking.source === "CALL" || selectedBooking.source === "CALLS_GST") && (
              <div className="checkin-modal__section">
                <label className="field-label">Discount (optional) - Vintara bookings only</label>
                <input
                  type="number"
                  min="0"
                  max={selectedBooking.pendingBalanceAmount ?? selectedBooking.balanceAmount}
                  value={checkInDiscount}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  placeholder="0"
                  className="checkin-modal__input"
                />
                {parseFloat(checkInDiscount) > 0 && (
                  <>
                    <input
                      type="text"
                      value={checkInDiscountReason}
                      onChange={(e) => setCheckInDiscountReason(e.target.value)}
                      placeholder="Reason for discount (required)"
                      className="checkin-modal__input"
                      style={{ marginTop: "8px" }}
                    />
                    <p className="checkin-modal__hint">
                      Amount to collect after discount: <strong>₹{effectiveBalanceDue}</strong>
                    </p>
                  </>
                )}
              </div>
            )}

            {effectiveBalanceDue > 0 && (
              <div className="checkin-modal__section">
                <label className="field-label">
                  Credit Account Destination{splitRows.length > 1 ? "s (split payment)" : ""}
                </label>
                {splitRows.map((row) => (
                  <div key={row.key} className="split-row">
                    <div className="split-row__account">
                      <Select
                        options={creditDestinations}
                        value={row.paymentAccount}
                        onChange={(opt) => updateSplitRow(row.key, { paymentAccount: opt })}
                        placeholder="Select account..."
                        classNamePrefix="react-select"
                        menuPortalTarget={menuPortalTarget}
                        menuPosition={menuPosition}
                        styles={themedSelectStyles()}
                      />
                    </div>
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) => updateSplitRow(row.key, { amount: e.target.value })}
                      placeholder="Amount"
                      className="checkin-modal__input split-row__amount"
                    />
                    <button
                      type="button"
                      onClick={() => removeSplitRow(row.key)}
                      title="Remove this split"
                      className="split-row__remove"
                      disabled={splitRows.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button type="button" onClick={addSplitRow} className="add-split-btn">
                  + Add Split
                </button>

                <p className={`allocation-status ${splitTotal === effectiveBalanceDue ? "is-balanced" : "is-mismatched"}`}>
                  Allocated: ₹{splitTotal} / ₹{effectiveBalanceDue}
                </p>
              </div>
            )}

            <div className="checkin-modal__actions">
              <button
                className="checkin-btn"
                onClick={handleCheckInSubmit}
                disabled={
                  isSubmittingCheckIn ||
                  (effectiveBalanceDue > 0 && splitTotal !== effectiveBalanceDue) ||
                  (parseFloat(checkInDiscount) > 0 && !checkInDiscountReason.trim())
                }
              >
                {isSubmittingCheckIn ? "Checking In..." : "Confirm Check-In"}
              </button>
              <button className="cancel-btn" onClick={() => setShowCheckInModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Stay Modal - creates a brand new booking for the extension
          period (old checkout date = new check-in date) instead of
          mutating this booking in place. Staff checks the new booking in
          normally afterward, same as any other booking. */}
      {showExtendStayModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal checkin-modal">
            <h3>Extend Stay</h3>

            <div className="checkin-modal__summary">
              <p><strong>Guest:</strong> {selectedBooking.customerName}</p>
              <p><strong>Current Checkout:</strong> {formatDateDMY(selectedBooking.checkOutDate)}</p>
              <p className="checkin-modal__hint">
                Creates a new booking starting {formatDateDMY(selectedBooking.checkOutDate)} - guest
                details and document verification carry over automatically.
              </p>
            </div>

            <div className="checkin-modal__section">
              <label className="field-label">New Checkout Date</label>
              <input
                type="date"
                min={(() => {
                  const nextDay = new Date(selectedBooking.checkOutDate);
                  nextDay.setDate(nextDay.getDate() + 1);
                  return toLocalDateStr(nextDay);
                })()}
                value={extendNewCheckOutDate}
                onChange={(e) => setExtendNewCheckOutDate(e.target.value)}
                className="checkin-modal__input"
              />

              <label className="field-label field-label--spaced">Room for the Extended Stay</label>
              <div className="split-row">
                <div className="split-row__account">
                  <Select
                    classNamePrefix="react-select"
                    options={extendCategoryOptions}
                    value={extendCategory}
                    onChange={(cat) => { setExtendCategory(cat); setExtendRoom(null); }}
                    placeholder="Category"
                    menuPortalTarget={menuPortalTarget}
                    menuPosition={menuPosition}
                    styles={themedSelectStyles()}
                  />
                </div>
                <div className="split-row__account">
                  <Select
                    classNamePrefix="react-select"
                    options={extendRoomOptions}
                    value={extendRoom}
                    onChange={setExtendRoom}
                    placeholder="Room"
                    isDisabled={!extendCategory}
                    menuPortalTarget={menuPortalTarget}
                    menuPosition={menuPosition}
                    styles={themedSelectStyles()}
                  />
                </div>
              </div>
              {!extendOptionsLoaded && (
                <p className="checkin-modal__hint">Checking room availability for these dates…</p>
              )}
              {extendRoomUnavailable ? (
                <p className="checkin-modal__hint checkin-modal__hint--danger">
                  Room {extendRoom.label} is already booked by another guest for these dates -
                  please select a different room above.
                </p>
              ) : (
                <p className="checkin-modal__hint">
                  Pre-filled with the current room - the dropdown only lists rooms actually free
                  for the extended dates, so change it if this one isn't available.
                </p>
              )}

              <label className="field-label field-label--spaced">Total Amount</label>
              <input
                type="number"
                min="0"
                value={extendTotalAmount}
                onChange={(e) => setExtendTotalAmount(e.target.value)}
                placeholder="0"
                className="checkin-modal__input"
              />
            </div>

            <div className="checkin-modal__actions">
              <button
                className="checkin-btn"
                onClick={handleExtendStaySubmit}
                disabled={isSubmittingExtendStay || !extendOptionsLoaded || extendRoomUnavailable}
              >
                {isSubmittingExtendStay ? "Creating..." : "Create Extension Booking"}
              </button>
              <button className="cancel-btn" onClick={() => setShowExtendStayModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Balance Modal - reuses the same split-row UI as check-in,
          for any checked-in booking with a genuine outstanding balance
          (e.g. right after an extension, or any other reason). */}
      {showCollectBalanceModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal checkin-modal">
            <h3>Collect Balance</h3>

            <div className="checkin-modal__summary">
              <p><strong>Guest:</strong> {selectedBooking.customerName}</p>
              <p><strong>Outstanding Balance Due:</strong> <span className="checkin-modal__balance">₹{selectedBooking.pendingBalanceAmount ?? selectedBooking.balanceAmount}</span></p>
            </div>

            <div className="checkin-modal__section">
              <label className="field-label">
                Credit Account Destination{splitRows.length > 1 ? "s (split payment)" : ""}
              </label>
              {splitRows.map((row) => (
                <div key={row.key} className="split-row">
                  <div className="split-row__account">
                    <Select
                      options={creditDestinations}
                      value={row.paymentAccount}
                      onChange={(opt) => updateSplitRow(row.key, { paymentAccount: opt })}
                      placeholder="Select account..."
                      classNamePrefix="react-select"
                      menuPortalTarget={menuPortalTarget}
                      menuPosition={menuPosition}
                      styles={themedSelectStyles()}
                    />
                  </div>
                  <input
                    type="number"
                    value={row.amount}
                    onChange={(e) => updateSplitRow(row.key, { amount: e.target.value })}
                    placeholder="Amount"
                    className="checkin-modal__input split-row__amount"
                  />
                  <button
                    type="button"
                    onClick={() => removeSplitRow(row.key)}
                    title="Remove this split"
                    className="split-row__remove"
                    disabled={splitRows.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button type="button" onClick={addSplitRow} className="add-split-btn">
                + Add Split
              </button>

              <p className={`allocation-status ${splitTotal === (selectedBooking.pendingBalanceAmount ?? selectedBooking.balanceAmount) ? "is-balanced" : "is-mismatched"}`}>
                Allocated: ₹{splitTotal} / ₹{selectedBooking.pendingBalanceAmount ?? selectedBooking.balanceAmount}
              </p>
            </div>

            <div className="checkin-modal__actions">
              <button
                className="checkin-btn"
                onClick={handleCollectBalanceSubmit}
                disabled={isSubmittingCollectBalance || splitTotal !== (selectedBooking.pendingBalanceAmount ?? selectedBooking.balanceAmount)}
              >
                {isSubmittingCollectBalance ? "Collecting..." : "Confirm Collection"}
              </button>
              <button className="cancel-btn" onClick={() => setShowCollectBalanceModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Late Checkout Charge Modal - a standalone same-day fee, kept
          separate from the room balance/total (see BookingPayment.
          lateCheckoutCharge on the backend for why). Single account, not
          the multi-row split-payment UI used for the room balance. */}
      {showLateCheckoutModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal checkin-modal">
            <h3>Late Checkout</h3>

            <div className="checkin-modal__summary">
              <p><strong>Guest:</strong> {selectedBooking.customerName}</p>
            </div>

            <div className="checkin-modal__section">
              <label className="field-label">Amount</label>
              <input
                type="number"
                min="0"
                value={lateCheckoutAmount}
                onChange={(e) => setLateCheckoutAmount(e.target.value)}
                placeholder="0"
                className="checkin-modal__input"
              />

              <label className="field-label field-label--spaced">Credit Account Destination</label>
              <Select
                options={creditDestinations}
                value={lateCheckoutAccount}
                onChange={setLateCheckoutAccount}
                placeholder="Select account..."
                classNamePrefix="react-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />

              <label className="field-label field-label--spaced">Reason (optional)</label>
              <input
                type="text"
                value={lateCheckoutReason}
                onChange={(e) => setLateCheckoutReason(e.target.value)}
                placeholder="e.g. Late checkout till 3 PM"
                className="checkin-modal__input"
              />
            </div>

            <div className="checkin-modal__actions">
              <button className="checkin-btn" onClick={handleLateCheckoutChargeSubmit} disabled={isSubmittingLateCheckout}>
                {isSubmittingLateCheckout ? "Adding..." : "Add Charge"}
              </button>
              <button className="cancel-btn" onClick={() => setShowLateCheckoutModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extra Charge Modal - a standalone charge for extra guests, an
          extra mattress, etc. (see BookingPayment.extraCharge on the
          backend for why). Single account, not the multi-row split-payment
          UI used for the room balance. */}
      {showExtraChargeModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal checkin-modal">
            <h3>Extra Charge</h3>

            <div className="checkin-modal__summary">
              <p><strong>Guest:</strong> {selectedBooking.customerName}</p>
            </div>

            <div className="checkin-modal__section">
              <label className="field-label">Amount</label>
              <input
                type="number"
                min="0"
                value={extraChargeAmount}
                onChange={(e) => setExtraChargeAmount(e.target.value)}
                placeholder="0"
                className="checkin-modal__input"
              />

              <label className="field-label field-label--spaced">Credit Account Destination</label>
              <Select
                options={creditDestinations}
                value={extraChargeAccount}
                onChange={setExtraChargeAccount}
                placeholder="Select account..."
                classNamePrefix="react-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />

              <label className="field-label field-label--spaced">Reason (optional)</label>
              <input
                type="text"
                value={extraChargeReason}
                onChange={(e) => setExtraChargeReason(e.target.value)}
                placeholder="e.g. 2 extra guests, extra mattress"
                className="checkin-modal__input"
              />
            </div>

            <div className="checkin-modal__actions">
              <button className="checkin-btn" onClick={handleExtraChargeSubmit} disabled={isSubmittingExtraCharge}>
                {isSubmittingExtraCharge ? "Adding..." : "Add Charge"}
              </button>
              <button className="cancel-btn" onClick={() => setShowExtraChargeModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Early Checkout / Cancellation Modal Overlay Container */}
      {showEarlyCheckoutModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal early-checkout-modal">
            <h3>
              {selectedBooking.status === "CHECKED_IN" ? "Group Checkout Processing" : "Cancel Reservation Group Contract"}
            </h3>
            <p><strong>Guest:</strong> {selectedBooking.customerName}</p>
            <p><strong>Total Account Bill:</strong> ₹{selectedBooking.totalAmount}</p>

            <div className="modal-field">
              <label>Reason:</label>
              <textarea
                value={checkoutReason}
                onChange={(e) => setCheckoutReason(e.target.value)}
                placeholder="Why is this status state modification occurring?"
                rows={3}
              />
            </div>

            <div className="modal-field">
              <label>Refund Amount Distributed (₹):</label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="modal-field">
              <label>Refunded From Account:</label>
              <Select
                options={creditDestinations}
                value={refundAccount}
                onChange={setRefundAccount}
                placeholder="Select payment account refund came from..."
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
            </div>

            <div className="modal-actions">
              <button
                className="checkin-btn"
                onClick={handleEarlyCheckoutSubmit}
                disabled={isSubmittingEarlyCheckout || (parseFloat(refundAmount) > 0 && !refundAccount)}
              >
                {isSubmittingEarlyCheckout ? "Processing..." : "Confirm"}
              </button>
              <button className="cancel-btn" onClick={() => setShowEarlyCheckoutModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserInventory;