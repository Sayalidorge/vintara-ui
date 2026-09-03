// src/components/UserInventory.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./DailyEntryDashboard.css";
import "./UserInventory.css";
import config from "../config";
import ManageCheckInDrawer from "./checkin/ManageCheckInDrawer";
import { toLocalDateStr } from "../utils/date";
import { QRCodeSVG } from "qrcode.react";

// The guest self check-in page a booking's link/QR points to (see
// GuestCheckInPage.jsx, route /checkin/:token).
const getCheckInUrl = (booking) =>
  booking.checkInToken ? `${window.location.origin}/checkin/${booking.checkInToken}` : null;

const UserInventory = () => {
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
  const [selectedResort, setSelectedResort] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
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

  // Single source of truth for updating ?tab=/?bookingFilterId= — takes
  // whichever of the two changed so a click that sets both (View Linked
  // Booking) does it in one setSearchParams call instead of two separate
  // ones, which would otherwise race (the second call's "previous params"
  // wouldn't yet reflect the first call in the same event handler).
  const updateViewState = ({ tab, bookingFilterId: filterId } = {}) => {
    if (tab !== undefined) setActiveTabState(tab);
    if (filterId !== undefined) setBookingFilterIdState(filterId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab !== undefined) next.set("tab", tab);
      if (filterId !== undefined) {
        if (filterId == null) next.delete("bookingFilterId");
        else next.set("bookingFilterId", String(filterId));
      }
      return next;
    }, { replace: true });
  };

  const setActiveTab = (tab) => updateViewState({ tab });
  const setBookingFilterId = (id) => updateViewState({ bookingFilterId: id });
  const viewSingleBookingInList = (booking) =>
    updateViewState({ tab: "BOOKINGS", bookingFilterId: booking.id });

  // Operational Modals State
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showManageCheckIn, setShowManageCheckIn] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedCreditDestination, setSelectedCreditDestination] = useState(null);
  const [creditDestinations, setCreditDestinations] = useState([]);

  const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState(false);
  const [checkoutReason, setCheckoutReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

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

  // Auto-select first resort fallback
  useEffect(() => {
    if (resorts.length > 0 && !selectedResort) {
      setSelectedResort(resorts[0]);
    }
  }, [resorts, selectedResort]);

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
    } else {
      setBookingFilterId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResort, selectedDate]);

  // Map categories to current active room matches
  const categories = useMemo(() => {
    if (!selectedResort?.categories?.length) return [];

    return selectedResort.categories
      .filter((cat) => cat.rooms?.length > 0)
      .map((cat) => ({
        ...cat,
        rooms: cat.rooms.map((room) => {
          const matchingBooking = bookings.find((booking) =>
            !["EARLY_CHECK_OUT", "CANCELLED"].includes(booking.status) &&
            booking.bookingItems?.some((item) => item.roomIds?.includes(room.id))
          );
          return { ...room, booking: matchingBooking };
        }),
      }));
  }, [selectedResort, bookings]);

  // Filter out any booking profiles that have already departed or been cancelled
  const activeBookingsList = useMemo(() => {
    return bookings.filter((b) => !["EARLY_CHECK_OUT", "CANCELLED"].includes(b.status));
  }, [bookings]);

  // Narrowed to a single booking when arriving via "View Linked Booking" from
  // Grid View; otherwise the full active list, same as before.
  const displayedBookingsList = useMemo(() => {
    if (bookingFilterId == null) return activeBookingsList;
    return activeBookingsList.filter((b) => b.id === bookingFilterId);
  }, [activeBookingsList, bookingFilterId]);

  // Check-in is only allowed on the booking's actual arrival date (checkInDate),
  // not just any date before checkout — a multi-night stay still has a single
  // arrival date, so this is unaffected by how many nights were booked.
  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);
  const canCheckInToday = (booking) => booking.checkInDate === todayStr;

  // Plain USER can only cancel/checkout bookings they personally created;
  // every other role (supervisory or front-desk) can act on any booking —
  // mirrors the backend check in BookingService.processBookingExit.
  const canModifyBooking = (booking) =>
    user?.role !== "USER" || booking.createdByUserId === user?.id;

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
    setSelectedCreditDestination(null);
    setShowCheckInModal(true);
  };

  const openEarlyCheckoutModal = (booking) => {
    setSelectedBooking(booking);
    setCheckoutReason("");
    setRefundAmount("");
    setShowEarlyCheckoutModal(true);
  };

  const handleCheckInSubmit = async () => {
    if (!selectedBooking) return;
    try {
      let url = `${config.BASE_URL}/api/bookings/${selectedBooking.id}/check-in`;
      if (selectedBooking.balanceAmount > 0) {
        if (!selectedCreditDestination) {
          alert("Please select credit destination");
          return;
        }
        url += `?paymentAccountId=${selectedCreditDestination.value}`;
      }
      const res = await fetch(url, {
        method: "PUT",
        headers: config.getHeaders(),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Check-in failed");
      }
      const updatedBooking = await res.json();
      
      setBookings((prev) =>
        prev.map((b) => (b.id === selectedBooking.id ? { ...b, ...updatedBooking, status: "CHECKED_IN", balanceAmount: 0 } : b))
      );
      
      setShowCheckInModal(false);
      setSelectedBooking(null);
    } catch (err) {
      console.error(err);
      alert(err.message || "Check-in failed. Please try again.");
    }
  };

  const handleEarlyCheckoutSubmit = async () => {
    if (!checkoutReason.trim()) return alert("Please enter a reason");
    if (refundAmount === "" || isNaN(parseFloat(refundAmount))) return alert("Please enter a valid numeric refund amount");

    const calculatedTargetStatus = selectedBooking.status === "CHECKED_IN" ? "EARLY_CHECK_OUT" : "CANCELLED";

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
          refundAmount: parseFloat(refundAmount),
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
      alert(err.message || "Failed to process booking exit. Please try again.");
    }
  };

  if (loadingResorts) return <p style={{ padding: "20px" }}>Loading resorts...</p>;

  return (
    <div className="user-inventory-wrapper">
      <h2 className="page-title" style={{ fontSize: "24px", fontWeight: 600, color: "var(--primary-purple)", textAlign: "left", letterSpacing: "0.4px" }}>Inventory Dashboard</h2>

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
                      return (
                        <div key={room.id} className={`room-card ${booking ? "booked" : "available"}`}>
                          <h4>Room {room.roomNumber}</h4>
                          {booking ? (
                            <div className="booking-info">
                              <p><strong>Guest:</strong> {booking.customerName}</p>
                              <p><strong>No of people:</strong> {booking.adults ?? 0} Adults, {booking.kids ?? 0} Kids</p>
                              <p style={{ fontSize: "11px", color: "#fff", margin: "4px 0" }}>
                                Status: <span style={{ fontWeight: "bold" }}>{booking.status}</span>
                              </p>
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
                            <p style={{ color: "inherit" }}>Available</p>
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
        <div className="bookings-list-view" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {bookingFilterId != null && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 15px", background: "#eef6f6", border: "1px solid #cfe8e8", borderRadius: "6px", fontSize: "13px" }}>
              <span>Showing only the booking selected from Room Grid View.</span>
              <button
                type="button"
                className="checkin-btn"
                style={{ padding: "4px 12px" }}
                onClick={() => setBookingFilterId(null)}
              >
                Show All Bookings
              </button>
            </div>
          )}

          {displayedBookingsList.length === 0 ? (
            <p style={{ padding: "20px", textAlign: "center", background: "#f9f9f9", borderRadius: "6px" }}>No active reservations tracked on this date target room matrix.</p>
          ) : (
            displayedBookingsList.map((b) => (
              <div key={b.id} style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "20px", background: "#ffffff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "15px" }}>
                  <div>
                    <h3 style={{ margin: 0, color: "#333" }}>{b.customerName} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#777" }}>(ID: #{b.id})</span></h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#555" }}>Contact: {b.customerContactNumber} | Source: <strong>{b.source}</strong></p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#333" }}><strong>Total Headcount:</strong> {(b.adults ?? 0) + (b.kids ?? 0)} People ({b.adults ?? 0} Adults, {b.kids ?? 0} Kids)</p>
                    {b.remarks && (
                      <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#856404", background: "#fff3cd", border: "1px solid #ffe69c", borderRadius: "6px", padding: "6px 10px", maxWidth: "480px" }}>
                        <strong>Remarks:</strong> {b.remarks}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", background: b.status === "CHECKED_IN" ? "#d4edda" : "#fff3cd", color: b.status === "CHECKED_IN" ? "#155724" : "#856404" }}>
                      {b.status}
                    </span>
                    <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#888" }}>Stay: {b.checkInDate} to {b.checkOutDate} ({b.numberOfNights} Night)</p>
                  </div>
                </div>

                {/* Rooms composition details structure layout block */}
                <div style={{ background: "#f9f9f9", padding: "10px 15px", borderRadius: "6px", marginBottom: "15px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "15px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#666" }}>Allocated Room Inventory Breakdown</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                      {b.bookingItems?.map((item, idx) => (
                        <div key={idx} style={{ fontSize: "13px" }}>
                          <strong>{item.roomCategoryName}:</strong> {item.roomNumbers?.join(", ")}
                        </div>
                      ))}
                    </div>
                  </div>

                  {getCheckInUrl(b) && (
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "20px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          marginBottom: "8px",
                          background: b.documentsVerified ? "#d4edda" : "#f1e5fa",
                          color: b.documentsVerified ? "#155724" : "var(--primary-purple)",
                        }}
                      >
                        {b.documentsVerified ? "Document Verification Completed" : "Document Verification Pending"}
                      </span>
                      <a
                        href={getCheckInUrl(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", textDecoration: "none" }}
                        title="Open guest self check-in page in a new tab"
                      >
                        <QRCodeSVG value={getCheckInUrl(b)} size={90} />
                        <p style={{ margin: "4px 0 0 0", fontSize: "10px", color: "#888" }}>Guest Check-In</p>
                      </a>
                    </div>
                  )}
                </div>

                {/* Financial Ledger Section */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px 30px", fontSize: "14px" }}>
                      <p style={{ margin: 0 }}><strong>🛏️ Room Bill:</strong> ₹{b.totalAmount}</p>
                      <p style={{ margin: 0 }}><strong>Paid Advance:</strong> ₹{b.advanceAmount}</p>
                      <p style={{ margin: 0 }}>
  <strong>Balance Due:</strong>{" "}
  <span style={{ color: (b.status === "CHECKED_IN" || b.balanceAmount === 0) ? "green" : "red", fontWeight: "bold" }}>
    ₹{b.status === "CHECKED_IN" ? 0 : b.balanceAmount}
  </span>
</p>
                    </div>

                    {b.foodPreorder && (() => {
                      // Food is collected at check-in the same as the room
                      // balance, so both settle together once checked in.
                      const roomBalance = b.status === "CHECKED_IN" ? 0 : (b.balanceAmount ?? 0);
                      const foodBalance = b.status === "CHECKED_IN" ? 0 : (b.foodBalanceAmount ?? 0);
                      const totalDue = roomBalance + foodBalance;
                      return (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px 30px", fontSize: "14px", marginTop: "6px" }}>
                          <p style={{ margin: 0 }}><strong>🍽 Food Total:</strong> ₹{b.totalFoodAmount ?? 0}</p>
                          <p style={{ margin: 0 }}><strong>Food Advance:</strong> ₹{b.advanceFoodAmount ?? 0}</p>
                          <p style={{ margin: 0 }}>
  <strong>Food Balance:</strong>{" "}
  <span style={{ color: foodBalance === 0 ? "green" : "red", fontWeight: "bold" }}>
    ₹{foodBalance}
  </span>
</p>
                          <p style={{ margin: 0 }}>
  <strong>Total Amount to be Paid:</strong>{" "}
  <span style={{ color: totalDue === 0 ? "green" : "red", fontWeight: "bold" }}>
    ₹{totalDue}
  </span>
</p>
                        </div>
                      );
                    })()}
                  </div>

{/* Actions Engine Panel Context */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
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
                        title={canCheckInToday(b) ? undefined : `Check-in opens on ${b.checkInDate}`}
                        style={!canCheckInToday(b) ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                      >
                        Check In
                      </button>
                    )}

                    {b.status === "BOOKED" && (
                      <button
                        className="checkin-btn"
                        onClick={() => openEarlyCheckoutModal(b)}
                        disabled={!canModifyBooking(b)}
                        title={canModifyBooking(b) ? undefined : "Only the creator or an admin can cancel this booking"}
                        style={!canModifyBooking(b) ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                      >
                        Cancel Booking
                      </button>
                    )}

                    {b.status === "CHECKED_IN" && (
                      <button
                        className="checkin-btn"
                        onClick={() => openEarlyCheckoutModal(b)}
                        disabled={!canModifyBooking(b)}
                        title={canModifyBooking(b) ? undefined : "Only the creator or an admin can check out this booking"}
                        style={!canModifyBooking(b) ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                      >
                        Process Early Checkout
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
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="modal" style={{ background: "#fff", padding: "25px", borderRadius: "8px", maxWidth: "450px", width: "100%" }}>
            <h3>Complete Check-In & Collect Balance</h3>
            <p><strong>Lead Guest:</strong> {selectedBooking.customerName}</p>
            <p><strong>Total Bill:</strong> ₹{selectedBooking.totalAmount}</p>
            <p><strong>Outstanding Balance Due:</strong> <span style={{ color: "red", fontWeight: "bold" }}>₹{selectedBooking.balanceAmount}</span></p>

            {selectedBooking.balanceAmount > 0 && (
              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", marginBottom: "4px" }}>Credit Account Destination:</label>
                <Select
                  options={creditDestinations}
                  value={selectedCreditDestination}
                  onChange={setSelectedCreditDestination}
                  placeholder="Select payment collection ledger..."
                />
              </div>
            )}

            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button className="checkin-btn" onClick={handleCheckInSubmit}>
                Confirm Check-In
              </button>
              <button className="cancel-btn" onClick={() => setShowCheckInModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Early Checkout / Cancellation Modal Overlay Container */}
      {showEarlyCheckoutModal && selectedBooking && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="modal" style={{ background: "#fff", padding: "25px", borderRadius: "8px", maxWidth: "450px", width: "100%" }}>
            <h3>
              {selectedBooking.status === "CHECKED_IN" ? "Group Checkout Processing" : "Cancel Reservation Group Contract"}
            </h3>
            <p><strong>Guest:</strong> {selectedBooking.customerName}</p>
            <p><strong>Total Account Bill:</strong> ₹{selectedBooking.totalAmount}</p>

            <div style={{ marginTop: "12px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>Reason:</label>
              <textarea
                value={checkoutReason}
                onChange={(e) => setCheckoutReason(e.target.value)}
                placeholder="Why is this status state modification occurring?"
                rows={3}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>Refund Amount Distributed (₹):</label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button className="checkin-btn" onClick={handleEarlyCheckoutSubmit}>
                Confirm
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