import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./AdminDashboard.css";
import {
  FaHotel,
  FaUsers,
  FaChartBar,
  FaDollarSign,
  FaCog,
  FaTachometerAlt,
  FaUserCircle,
} from "react-icons/fa";
import config from "../config";
import { Link, useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const loggedInUsername = "Sayali Dorge";

  // ================= SUMMARY (Keep mock or replace later with API) =================
  const summaryMock = {
    totalBookings: 120,
    otaBookings: 70,
    directBookings: 50,
    occupancyRate: 75,
  };

  // ================= BOOKING TREND =================
  const [bookingTrend, setBookingTrend] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [errorTrend, setErrorTrend] = useState(null);
  const [trendView, setTrendView] = useState("weekly");

  // ================= RESORT LIST =================
  const [resorts, setResorts] = useState([]);
  const [loadingResorts, setLoadingResorts] = useState(true);
  const [selectedResort, setSelectedResort] = useState("");

  // ================= OCCUPANCY =================
  const [occupancyData, setOccupancyData] = useState([]);
  const [loadingOccupancy, setLoadingOccupancy] = useState(true);
  const [errorOccupancy, setErrorOccupancy] = useState(null);
  const [occupancyView, setOccupancyView] = useState("weekly");

  // ================= DAILY INVENTORY =================
  const [dailyOccupancy, setDailyOccupancy] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [errorDaily, setErrorDaily] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // ================= DASHBOARD CARDS =================
const [roomsSummary, setRoomsSummary] = useState({
  activeRooms: 0,
  occupiedRooms: 0,
  availableRooms: 0,
  occupancyPercent: 0,
});
const [loadingSummary, setLoadingSummary] = useState(true);
const [errorSummary, setErrorSummary] = useState(null);

// =====================================================
  // FETCH Card Details
  // =====================================================
const fetchRoomsSummary = async () => {
  try {
    setLoadingSummary(true);
    setErrorSummary(null);

    const response = await fetch(
      `${config.BASE_URL}/api/admin/dashboard/today-occupancy`, // your backend endpoint
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch rooms summary");

    const data = await response.json();
    setRoomsSummary(data);
  } catch (err) {
    setErrorSummary(err.message);
  } finally {
    setLoadingSummary(false);
  }
};

useEffect(() => {
  fetchRoomsSummary();
}, []);
  // =====================================================
  // FETCH RESORT DROPDOWN
  // =====================================================
  const fetchResorts = async () => {
    try {
      setLoadingResorts(true);

      const response = await fetch(
        `${config.BASE_URL}/api/resorts/resort-names-drop-down`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch resorts");

      const data = await response.json();
      setResorts(data);

      if (data.length > 0) {
        setSelectedResort(data[0].id.toString());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingResorts(false);
    }
  };

  useEffect(() => {
    fetchResorts();
  }, []);

  // =====================================================
  // FETCH BOOKING TREND
  // =====================================================
  const fetchBookingTrend = async (view) => {
    try {
      setLoadingTrend(true);
      setErrorTrend(null);

      const response = await fetch(
        `${config.BASE_URL}/api/admin/dashboard/booking-trend?view=${view}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch booking trend");

      const data = await response.json();
      setBookingTrend(data);
    } catch (err) {
      setErrorTrend(err.message);
    } finally {
      setLoadingTrend(false);
    }
  };

  useEffect(() => {
    fetchBookingTrend(trendView);
  }, [trendView]);

  // =====================================================
  // FETCH OCCUPANCY TREND
  // =====================================================
  const fetchOccupancy = async (resortId, view) => {
    if (!resortId) return;

    try {
      setLoadingOccupancy(true);
      setErrorOccupancy(null);

      const response = await fetch(
        `${config.BASE_URL}/api/admin/dashboard/${resortId}/occupancy?view=${view}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch occupancy");

      const data = await response.json();

      const formatted = data.map((item) => ({
        ...item,
        availableRooms: item.totalRooms - item.bookedRooms,
      }));

      setOccupancyData(formatted);
    } catch (err) {
      setErrorOccupancy(err.message);
    } finally {
      setLoadingOccupancy(false);
    }
  };

  useEffect(() => {
    fetchOccupancy(selectedResort, occupancyView);
  }, [selectedResort, occupancyView]);

  // =====================================================
  // FETCH DAILY INVENTORY
  // =====================================================
  const fetchDailyOccupancy = async (date) => {
    try {
      setLoadingDaily(true);
      setErrorDaily(null);

      const response = await fetch(
        `${config.BASE_URL}/api/bookings/inventory?date=${date}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch daily occupancy");

      const data = await response.json();

      const formatted = data.map((item) => ({
        resortName: item.resortName,
        bookedRooms: item.bookedRooms,
        availableRooms: item.totalRooms - item.bookedRooms,
      }));

      setDailyOccupancy(formatted);
    } catch (err) {
      setErrorDaily(err.message);
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    fetchDailyOccupancy(selectedDate);
  }, [selectedDate]);

   const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const handleChangePassword = () => {
    navigate("/change-password");
  };

  // =====================================================
  // UI
  // =====================================================
  return (
      <div className="admin-dashboard-content">

        {/* SUMMARY */}
        <div className="summary-cards">
  {loadingSummary ? (
    <p>Loading summary...</p>
  ) : errorSummary ? (
    <p style={{ color: "red" }}>{errorSummary}</p>
  ) : (
    <>
      <div className="card">
        <h4>Active Rooms</h4>
        <p>{roomsSummary.activeRooms}</p>
      </div>
      <div className="card">
        <h4>Occupied Rooms</h4>
        <p>{roomsSummary.occupiedRooms}</p>
      </div>
      <div className="card">
        <h4>Occupancy %</h4>
        <p>{roomsSummary.occupancyPercent.toFixed(2)}%</p>
      </div>
      <div className="card">
        <h4>Available Rooms</h4>
        <p>{roomsSummary.availableRooms}</p>
      </div>
    </>
  )}
</div>
      

{/* ================= RESORT-WISE DAILY OCCUPANCY ================= */}
<div className="chart-container">
  <div className="chart-header">
    <h3>Resort-wise Daily Occupancy</h3>
    <input
      type="date"
      value={selectedDate}
      onChange={(e) => setSelectedDate(e.target.value)}
    />
  </div>

  {loadingDaily ? (
    <p>Loading...</p>
  ) : errorDaily ? (
    <p style={{ color: "red" }}>{errorDaily}</p>
  ) : (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dailyOccupancy}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="resortName" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar
          dataKey="bookedRooms"
          stackId="rooms"
          fill="var(--primary-purple)"
        />
        <Bar
          dataKey="availableRooms"
          stackId="rooms"
          fill="var(--primary-teal)"
        />
      </BarChart>
    </ResponsiveContainer>
  )}
</div>
        {/* BOOKING TREND */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Booking Trend</h3>
            <select
              value={trendView}
              onChange={(e) => setTrendView(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {loadingTrend ? (
            <p>Loading...</p>
          ) : errorTrend ? (
            <p style={{ color: "red" }}>{errorTrend}</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bookingTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="otaBookings"
                  stroke="var(--primary-purple)"
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="directBookings"
                  stroke="var(--primary-teal)"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* OCCUPANCY TREND */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Resort Occupancy Trend</h3>

            <div>
              <select
                value={selectedResort}
                onChange={(e) => setSelectedResort(e.target.value)}
              >
                {loadingResorts ? (
                  <option>Loading...</option>
                ) : (
                  resorts.map((resort) => (
                    <option key={resort.id} value={resort.id}>
                      {resort.name}
                    </option>
                  ))
                )}
              </select>

              <select
                value={occupancyView}
                onChange={(e) => setOccupancyView(e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

 {loadingOccupancy ? (
  <p>Loading...</p>
) : errorOccupancy ? (
  <p style={{ color: "red" }}>{errorOccupancy}</p>
) : (
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={occupancyData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="label" />
      <YAxis />

      <Tooltip
        content={({ active, payload }) => {
          if (active && payload && payload.length) {
            const data = payload[0].payload;

            const occupancyPercent =
              data.totalRooms > 0
                ? Math.round((data.bookedRooms / data.totalRooms) * 100)
                : 0;

            return (
              <div
                style={{
                  background: "white",
                  border: "1px solid #ddd",
                  padding: "12px",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  minWidth: "180px",
                }}
              >
                <div style={{ fontWeight: "600", marginBottom: "6px" }}>
                  {data.label}
                </div>

                <div>🏨 Total Rooms: <strong>{data.totalRooms}</strong></div>
                <div>🟣 Occupied: {data.bookedRooms}</div>
                <div>🟢 Available: {data.availableRooms}</div>
                <div style={{ marginTop: "6px", fontWeight: "500" }}>
                  Occupancy: {occupancyPercent}%
                </div>
              </div>
            );
          }
          return null;
        }}
      />

      <Legend />

      <Bar
        dataKey="bookedRooms"
        stackId="rooms"
        fill="var(--primary-purple)"
      />
      <Bar
        dataKey="availableRooms"
        stackId="rooms"
        fill="var(--primary-teal)"
      />
    </BarChart>
  </ResponsiveContainer>
)}
      
      </div>
    </div>
  );
};

export default AdminDashboard;