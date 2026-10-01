import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import {
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "../css/theme.css";
import "../css/components.css";
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
import { toLocalDateStr, parseLocalDateStr } from "../utils/date";
import { downloadCsv } from "../utils/csv";
import { isSuperAdmin } from "../utils/auth";

// One consistent tooltip card for the Booking Trend chart - color swatch +
// name + value per series, instead of recharts' bare default box.
const BookingTrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-title">{label}</div>
      {payload.map((entry) => (
        <div className="trend-tooltip-row" key={entry.dataKey}>
          <span className="trend-tooltip-key">
            <span className="trend-tooltip-swatch" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="trend-tooltip-val">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const VIEW_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

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
    toLocalDateStr(new Date())
  );
  // selectedDate is stored as a string (API calls/filenames use it as one),
  // but DatePicker needs a Date object for `selected` - memoized so it's the
  // SAME object reference across re-renders whenever selectedDate itself
  // hasn't changed. Without this, parseLocalDateStr(selectedDate) inline in
  // the JSX below returns a brand-new Date every render, which sent
  // DatePicker into a render loop that hung the whole page on open.
  const selectedDateObj = useMemo(() => parseLocalDateStr(selectedDate), [selectedDate]);

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
const fetchRoomsSummary = async (date) => {
  try {
    setLoadingSummary(true);
    setErrorSummary(null);

    const response = await fetch(
      `${config.BASE_URL}/api/admin/dashboard/today-occupancy?date=${date}`,
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

// Shares the same date filter as Resort-wise Daily Occupancy below it -
// these cards previously always showed today regardless of that filter.
useEffect(() => {
  fetchRoomsSummary(selectedDate);
}, [selectedDate]);
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
  // CSV EXPORTS
  // =====================================================
  const exportDailyOccupancy = () => {
    downloadCsv(
      `daily-occupancy_${selectedDate}.csv`,
      dailyOccupancy,
      [
        { key: "resortName", header: "Resort" },
        { key: "bookedRooms", header: "Booked Rooms" },
        { key: "availableRooms", header: "Available Rooms" },
      ]
    );
  };

  const exportBookingTrend = () => {
    downloadCsv(
      `booking-trend_${trendView}.csv`,
      bookingTrend,
      [
        { key: "label", header: "Period" },
        { key: "otaBookings", header: "OTA Bookings" },
        { key: "directBookings", header: "Direct Bookings" },
      ]
    );
  };

  const exportOccupancyTrend = () => {
    const resortName =
      resorts.find((r) => r.id.toString() === selectedResort)?.name || "resort";
    downloadCsv(
      `occupancy-trend_${resortName}_${occupancyView}.csv`,
      occupancyData,
      [
        { key: "label", header: "Period" },
        { key: "totalRooms", header: "Total Rooms" },
        { key: "bookedRooms", header: "Booked Rooms" },
        { key: "availableRooms", header: "Available Rooms" },
      ]
    );
  };

  const resortOptions = resorts.map((r) => ({ value: r.id.toString(), label: r.name }));

  // KPI tiles above the Booking Trend chart - summed across whatever period
  // (daily/weekly/monthly) is currently selected, so they always match what
  // the chart below is showing rather than a fixed all-time total.
  const trendDirectTotal = bookingTrend.reduce((sum, d) => sum + (d.directBookings || 0), 0);
  const trendOtaTotal = bookingTrend.reduce((sum, d) => sum + (d.otaBookings || 0), 0);
  const trendGrandTotal = trendDirectTotal + trendOtaTotal;
  const trendDirectPct = trendGrandTotal > 0 ? Math.round((trendDirectTotal / trendGrandTotal) * 100) : 0;

  // KPI tiles above the Resort Occupancy Trend chart. Occupancy is a snapshot
  // per period, not an additive event like bookings, so these average/peak
  // across the shown range instead of summing (summing rooms across days
  // would double-count the same rooms).
  const occPeriodPcts = occupancyData.map((d) =>
    d.totalRooms > 0 ? (d.bookedRooms / d.totalRooms) * 100 : 0
  );
  const occAvgPct = occPeriodPcts.length > 0
    ? Math.round(occPeriodPcts.reduce((sum, p) => sum + p, 0) / occPeriodPcts.length)
    : 0;
  const occPeakPct = occPeriodPcts.length > 0 ? Math.round(Math.max(...occPeriodPcts)) : 0;
  const occLatestTotalRooms = occupancyData.length > 0 ? occupancyData[occupancyData.length - 1].totalRooms : 0;
  const occAvgOccupied = occupancyData.length > 0
    ? Math.round(occupancyData.reduce((sum, d) => sum + d.bookedRooms, 0) / occupancyData.length)
    : 0;

  // =====================================================
  // UI
  // =====================================================
  return (
      <div className="admin-dashboard-content">

        <div className="vt-page-header">
          <h2>Dashboard Overview</h2>
        </div>

        {/* SUMMARY */}
        <div className="summary-cards">
  {loadingSummary ? (
    <p>Loading summary...</p>
  ) : errorSummary ? (
    <p style={{ color: "var(--color-danger-text)" }}>{errorSummary}</p>
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
    <div className="chart-header-controls">
      <DatePicker
        selected={selectedDateObj}
        onChange={(date) => date && setSelectedDate(toLocalDateStr(date))}
        dateFormat="dd/MM/yyyy"
        className="custom-datepicker"
        withPortal
      />
      {isSuperAdmin() && (
        <button type="button" className="export-csv-btn" onClick={exportDailyOccupancy}>
          Export CSV
        </button>
      )}
    </div>
  </div>

  {loadingDaily ? (
    <p>Loading...</p>
  ) : errorDaily ? (
    <p style={{ color: "var(--color-danger-text)" }}>{errorDaily}</p>
  ) : dailyOccupancy.length === 0 ? (
    <p>No resorts to show for this date.</p>
  ) : (
    // Occupancy meters: "which properties are nearly full" is a ratio-against-
    // a-limit question, not a magnitude comparison, so a scorecard of gauges
    // reads faster here than bars - and sidesteps the label-overlap/skipping
    // the stacked bar version hit once there were more than a handful of
    // resorts, since each one gets its own row instead of fighting for x-axis width.
    <div className="occ-meter-list">
      {dailyOccupancy.map((r) => {
        const total = r.bookedRooms + r.availableRooms;
        const pct = total > 0 ? Math.round((r.bookedRooms / total) * 100) : 0;
        return (
          <div className="occ-meter-row" key={r.resortName}>
            <div className="occ-meter-top">
              <span className="occ-meter-name">{r.resortName}</span>
              <span className="occ-meter-frac">{r.bookedRooms} / {total} rooms</span>
            </div>
            <div className="occ-meter-inner">
              <div className="occ-meter-track">
                <div className="occ-meter-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="occ-meter-pct">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>
        {/* BOOKING TREND */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Booking Trend</h3>
            <div className="chart-header-controls">
              <Select
                options={VIEW_OPTIONS}
                value={VIEW_OPTIONS.find((o) => o.value === trendView)}
                onChange={(opt) => setTrendView(opt.value)}
                isSearchable={false}
                classNamePrefix="react-select"
                className="react-select-container chart-header-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
              {isSuperAdmin() && (
                <button type="button" className="export-csv-btn" onClick={exportBookingTrend}>
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {loadingTrend ? (
            <p>Loading...</p>
          ) : errorTrend ? (
            <p style={{ color: "var(--color-danger-text)" }}>{errorTrend}</p>
          ) : (
            <>
              <div className="trend-kpi-row">
                <div className="trend-kpi">
                  <span className="trend-kpi-label">Total Bookings</span>
                  <span className="trend-kpi-value">{trendGrandTotal}</span>
                </div>
                <div className="trend-kpi">
                  <span className="trend-kpi-label">Direct</span>
                  <span className="trend-kpi-value">{trendDirectTotal}</span>
                </div>
                <div className="trend-kpi">
                  <span className="trend-kpi-label">OTA</span>
                  <span className="trend-kpi-value">{trendOtaTotal}</span>
                </div>
                <div className="trend-kpi trend-kpi--accent">
                  <span className="trend-kpi-label">Direct Share</span>
                  <span className="trend-kpi-value">{trendDirectPct}%</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={bookingTrend}>
                  <defs>
                    <linearGradient id="directBookingsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary-teal)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--primary-teal)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="none" vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={{ stroke: "var(--chart-axis-line)" }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BookingTrendTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="directBookings"
                    name="Direct"
                    stroke="var(--primary-teal)"
                    strokeWidth={2.5}
                    fill="url(#directBookingsFill)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="otaBookings"
                    name="OTA"
                    stroke="var(--primary-purple)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* OCCUPANCY TREND */}
        <div className="chart-container">
          <div className="chart-header">
            <h3>Resort Occupancy Trend</h3>

            <div className="chart-header-controls">
              <Select
                options={resortOptions}
                value={resortOptions.find((o) => o.value === selectedResort) || null}
                onChange={(opt) => setSelectedResort(opt ? opt.value : "")}
                isLoading={loadingResorts}
                isDisabled={loadingResorts || resortOptions.length === 0}
                isSearchable={false}
                placeholder="Select resort..."
                classNamePrefix="react-select"
                className="react-select-container chart-header-select chart-header-select--resort"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />

              <Select
                options={VIEW_OPTIONS}
                value={VIEW_OPTIONS.find((o) => o.value === occupancyView)}
                onChange={(opt) => setOccupancyView(opt.value)}
                isSearchable={false}
                classNamePrefix="react-select"
                className="react-select-container chart-header-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />

              {isSuperAdmin() && (
                <button type="button" className="export-csv-btn" onClick={exportOccupancyTrend}>
                  Export CSV
                </button>
              )}
            </div>
          </div>

 {loadingOccupancy ? (
  <p>Loading...</p>
) : errorOccupancy ? (
  <p style={{ color: "var(--color-danger-text)" }}>{errorOccupancy}</p>
) : (
  <>
  <div className="trend-kpi-row">
    <div className="trend-kpi">
      <span className="trend-kpi-label">Total Rooms</span>
      <span className="trend-kpi-value">{occLatestTotalRooms}</span>
    </div>
    <div className="trend-kpi">
      <span className="trend-kpi-label">Avg. Occupied</span>
      <span className="trend-kpi-value">{occAvgOccupied}</span>
    </div>
    <div className="trend-kpi">
      <span className="trend-kpi-label">Peak Occupancy</span>
      <span className="trend-kpi-value">{occPeakPct}%</span>
    </div>
    <div className="trend-kpi trend-kpi--accent">
      <span className="trend-kpi-label">Avg. Occupancy</span>
      <span className="trend-kpi-value">{occAvgPct}%</span>
    </div>
  </div>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={occupancyData}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
      <XAxis dataKey="label" tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={{ stroke: "var(--chart-axis-line)" }} tickLine={false} />
      <YAxis tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />

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
                  border: "1px solid var(--gray-300)",
                  padding: "12px",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-md)",
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
  </>
)}
      
      </div>
    </div>
  );
};

export default AdminDashboard;