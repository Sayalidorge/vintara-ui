// src/components/UserInventory.jsx
import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./DailyEntryDashboard.css";
import "./UserInventory.css";
import config from "../config";
import ManageCheckInDrawer from "./checkin/ManageCheckInDrawer";

const UserInventory = () => {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch (e) {
      console.error("Failed to parse user session", e);
      return null;
    }
  }, []);

  const [allResorts, setAllResorts] = useState([]);
  const [assignedResortIds, setAssignedResortIds] = useState([]);
  const [selectedResort, setSelectedResort] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [loadingResorts, setLoadingResorts] = useState(true);

  // View Switcher Tab State: 'GRID' (Room Focus) or 'BOOKINGS' (Reservation Focus)
  const [activeTab, setActiveTab] = useState("GRID");

  // Operational Modals State
  //const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showManageCheckIn, setShowManageCheckIn] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedCreditDestination, setSelectedCreditDestination] = useState(null);
  const [creditDestinations, setCreditDestinations] = useState([]);

  const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState(false);
  const [checkoutReason, setCheckoutReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  // Fetch credit destinations
  useEffect(() => {
    const fetchCreditDestinations = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/drop-down/credit-destination`, {
          headers: config.getHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch credit destinations");
        const data = await res.json();
        setCreditDestinations(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCreditDestinations();
  }, []);

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

  // Fetch assigned resorts for managers
  useEffect(() => {
    if (user?.role !== "PROPERTY_MANAGER") return;
    const fetchAssignedResorts = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/resorts/manager`, {
          headers: config.getHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch assigned resorts");
        const data = await res.json();
        setAssignedResortIds(data.map((r) => r.id));
      } catch (err) {
        console.error(err);
      }
    };
    fetchAssignedResorts();
  }, [user]);

  // Filter resorts based on access
  const resorts = useMemo(() => {
    if (!allResorts.length) return [];
    if (user?.role === "PROPERTY_MANAGER") {
      return allResorts.filter((r) => assignedResortIds.includes(r.value));
    }
    return allResorts;
  }, [allResorts, assignedResortIds, user]);

  // Auto-select first resort fallback
  useEffect(() => {
    if (resorts.length > 0 && !selectedResort) {
      setSelectedResort(resorts[0]);
    }
  }, [resorts, selectedResort]);

  // Fetch bookings
  useEffect(() => {
    if (!selectedResort) {
      setBookings([]);
      return;
    }
    const fetchBookings = async () => {
      try {
        const dateStr = selectedDate.toISOString().split("T")[0];
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
    fetchBookings();
  }, [selectedResort, selectedDate]);

  // Map categories to current active room matches
  // EARLY CHECKOUT INTEGRATION: Rooms immediately clear up if booking status updates to checkout or cancel
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

  /*const openCheckInModal = (booking) => {
    setSelectedBooking(booking);
    setSelectedCreditDestination(null);
    setShowCheckInModal(true);
  };*/

  const openCheckInModal = (booking) => {
    setSelectedBooking(booking);
    setShowManageCheckIn(true);
};
  const openEarlyCheckoutModal = (booking) => {
    setSelectedBooking(booking);
    setCheckoutReason("");
    setRefundAmount("");
    setShowEarlyCheckoutModal(true);
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

      if (!res.ok) throw new Error("Failed to process exit");
      const updatedBooking = await res.json();

      // OPTION A: If you want to keep the booking record in state but change status:
      setBookings((prev) => 
        prev.map((b) => (b.id === selectedBooking.id ? { ...b, ...updatedBooking, status: "EARLY_CHECK_OUT", bookingItems: [] } : b))
      );

      // OPTION B (SUREFIRE): Completely filter out the booking from the view array entirely
      // setBookings((prev) => prev.filter((b) => b.id !== selectedBooking.id));

      setShowEarlyCheckoutModal(false);
      setSelectedBooking(null); // Break the reference link immediately
    } catch (err) {
      console.error(err);
      alert("Failed to process booking exit. Please try again.");
    }
  };

  if (loadingResorts) return <p style={{ padding: "20px" }}>Loading resorts...</p>;

  return (
    <div className="user-inventory-wrapper">
      <h2 className="page-title">Inventory Dashboard</h2>

      {/* Control Filters Block */}
      <div className="filters" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "20px" }}>
          <div className="filter-item">
            <label>Resort</label>
            <Select
              options={resorts}
              value={selectedResort}
              onChange={setSelectedResort}
              placeholder="Select resort..."
              isDisabled={user?.role === "PROPERTY_MANAGER" && resorts.length === 1}
            />
          </div>
          <div className="filter-item">
            <label>Date</label>
            <DatePicker
              selected={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              dateFormat="yyyy-MM-dd"
              className="custom-datepicker"
              disabled={user?.role === "PROPERTY_MANAGER"}
            />
          </div>
        </div>

        {/* Perspective View Switcher Tabs */}
        <div className="view-switcher-tabs" style={{ display: "flex", border: "1px solid #ccc", borderRadius: "6px", overflow: "hidden" }}>
          <button 
            style={{ padding: "10px 20px", cursor: "pointer", border: "none", background: activeTab === "GRID" ? "#0d47a1" : "#fff", color: activeTab === "GRID" ? "#fff" : "#333", fontWeight: "bold" }}
            onClick={() => setActiveTab("GRID")}
          >
            Room Grid View
          </button>
          <button 
            style={{ padding: "10px 20px", cursor: "pointer", border: "none", background: activeTab === "BOOKINGS" ? "#0d47a1" : "#fff", color: activeTab === "BOOKINGS" ? "#fff" : "#333", fontWeight: "bold" }}
            onClick={() => setActiveTab("BOOKINGS")}
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
                              <p><strong>No of people:</strong> {booking.numberOfPeople || 0}</p>
                              <p style={{ fontSize: "11px", color: "#fff", margin: "4px 0" }}>
                                Status: <span style={{ fontWeight: "bold" }}>{booking.status}</span>
                              </p>
                              <button 
                                className="checkin-btn" 
                                style={{ width: "100%", marginTop: "8px", padding: "4px" }}
                                onClick={() => {
                                  setActiveTab("BOOKINGS");
                                  setSelectedBooking(booking);
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
          {activeBookingsList.length === 0 ? (
            <p style={{ padding: "20px", textAlign: "center", background: "#f9f9f9", borderRadius: "6px" }}>No active reservations tracked on this date target room matrix.</p>
          ) : (
            activeBookingsList.map((b) => (
              <div key={b.id} style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "20px", background: "#ffffff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "15px" }}>
                  <div>
                    <h3 style={{ margin: 0, color: "#333" }}>{b.customerName} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#777" }}>(ID: #{b.id})</span></h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#555" }}>Contact: {b.customerContactNumber} | Source: <strong>{b.source}</strong></p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#333" }}><strong>Total Headcount:</strong> {b.numberOfPeople || 0} People</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", background: b.status === "CHECKED_IN" ? "#d4edda" : "#fff3cd", color: b.status === "CHECKED_IN" ? "#155724" : "#856404" }}>
                      {b.status}
                    </span>
                    <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#888" }}>Stay: {b.checkInDate} to {b.checkOutDate} ({b.numberOfNights} Night)</p>
                  </div>
                </div>

                {/* Rooms composition details structure layout block */}
                <div style={{ background: "#f9f9f9", padding: "10px 15px", borderRadius: "6px", marginBottom: "15px" }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#666" }}>Allocated Room Inventory Breakdown</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                    {b.bookingItems?.map((item, idx) => (
                      <div key={idx} style={{ fontSize: "13px" }}>
                        <strong>{item.roomCategoryName}:</strong> {item.roomNumbers?.join(", ")}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Ledger Section */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "30px", fontSize: "14px" }}>
                    <p style={{ margin: 0 }}><strong>Total Bill:</strong> ₹{b.totalAmount}</p>
                    <p style={{ margin: 0 }}><strong>Paid Advance:</strong> ₹{b.advanceAmount}</p>
                    <p style={{ margin: 0 }}><strong>Balance Due:</strong> <span style={{ color: b.balanceAmount > 0 ? "red" : "green", fontWeight: "bold" }}>₹{b.balanceAmount}</span></p>
                  </div>

{/* Actions Engine Panel Context */}
<div style={{ display: "flex", gap: "10px" }}>
  {b.status === "BOOKED" && (
    <>
      <button className="checkin-btn" onClick={() => openCheckInModal(b)}>
        Check In
      </button>
<button 
  style={{ padding: "6px 14px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white" }} 
  onClick={() => openEarlyCheckoutModal(b)}
>
  Cancel Booking
</button>
    </>
  )}

  {b.status === "CHECKED_IN" && (
    <button className="checkin-btn" onClick={() => openEarlyCheckoutModal(b)}>
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

      {/* Global Check-In Overlay Modal Container */}
{
    showManageCheckIn &&
    selectedBooking && (
        <ManageCheckInDrawer
            booking={selectedBooking}
            onClose={()=>{
                setShowManageCheckIn(false);
                setSelectedBooking(null);
            }}
onCompleted={(response) => {
    setBookings(prev =>
        prev.map(b =>
            b.id === response.bookingId
                ? {
                    ...b,
                    status: response.bookingStatus,
                    checkedInAt: response.checkedInAt
                  }
                : b
        )
    );

    setShowManageCheckIn(false);
    setSelectedBooking(null);
}}
        />
    )
}

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
                defaultValue={0}
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