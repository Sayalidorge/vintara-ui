// src/components/MyAttendanceLeave.jsx
import React, { useEffect, useState } from "react";
import { checkIn, checkOut, getTodayStatus } from "../services/AttendanceService";
import EmployeeLeavePortal from "./EmployeeLeavePortal";
import "../css/theme.css";
import "../css/components.css";
import "./MyAttendanceLeave.css";
import ToastContainer, { useToast } from "./common/Toast";

const LOCATION_BADGE = {
  OFFICE: { label: "Office", className: "badge-office" },
  REMOTE: { label: "Remote", className: "badge-remote" },
  UNKNOWN: { label: "Unknown", className: "badge-unknown" },
};

function LocationBadge({ type }) {
  if (!type) return null;
  const badge = LOCATION_BADGE[type] || LOCATION_BADGE.UNKNOWN;
  return <span className={`location-badge ${badge.className}`}>{badge.label}</span>;
}

function formatTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Wraps getCurrentPosition in a promise; resolves with {lat, lng} or
// {lat: null, lng: null} on any failure/denial - check-in proceeds either
// way (soft enforcement), the server just falls back to IP matching.
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.warn("Geolocation unavailable/denied:", err.message);
        resolve({ lat: null, lng: null });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

const MyAttendanceLeave = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadToday = async () => {
    try {
      const status = await getTodayStatus();
      setToday(status);
    } catch (err) {
      console.error("Failed to load today's attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadToday();
  }, []);

  const handleCheckIn = async () => {
    setBusy(true);
    try {
      const { lat, lng } = await getLocation();
      const result = await checkIn(lat, lng);
      setToday(result);
    } catch (err) {
      showToast(err.message || "Check-in failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    setBusy(true);
    try {
      const { lat, lng } = await getLocation();
      const result = await checkOut(lat, lng);
      setToday(result);
    } catch (err) {
      showToast(err.message || "Check-out failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  const hasCheckedIn = !!today?.checkInTime;
  const hasCheckedOut = !!today?.checkOutTime;

  return (
    <div className="my-attendance-leave">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="vt-page-header">
        <h2>My Attendance &amp; Leave</h2>
      </div>
      <div className="attendance-card">
        <h2>Today's Attendance</h2>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="attendance-status-row">
            <div className="attendance-status-item">
              <span className="attendance-status-label">Check-In</span>
              <span className="attendance-status-value">
                {formatTime(today?.checkInTime)} <LocationBadge type={today?.checkInLocationType} />
              </span>
            </div>
            <div className="attendance-status-item">
              <span className="attendance-status-label">Check-Out</span>
              <span className="attendance-status-value">
                {formatTime(today?.checkOutTime)} <LocationBadge type={today?.checkOutLocationType} />
              </span>
            </div>
          </div>
        )}

        <div className="attendance-buttons">
          <button
            className="btn-checkin"
            onClick={handleCheckIn}
            disabled={busy || loading || hasCheckedIn}
          >
            {busy && !hasCheckedIn ? "Checking In..." : "Check In"}
          </button>
          <button
            className="btn-checkout"
            onClick={handleCheckOut}
            disabled={busy || loading || !hasCheckedIn || hasCheckedOut}
          >
            {busy && hasCheckedIn && !hasCheckedOut ? "Checking Out..." : "Check Out"}
          </button>
        </div>

        <small>Location access is optional - if denied, check-in still works, just without office/remote detection.</small>
      </div>

      <EmployeeLeavePortal />
    </div>
  );
};

export default MyAttendanceLeave;
