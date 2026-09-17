import React, { useState, useEffect } from "react";
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
import Select from "react-select";
import { getYearlyRevenue, getDailyRevenue, getResortYearlyRevenue, getResortDailyRevenue } from "../services/RevenueService";
import config from "../config";
import "../css/theme.css";
import "../css/components.css";
import "./RevenueDashboard.css";
import { downloadCsv } from "../utils/csv";
import { isSuperAdmin } from "../utils/auth";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";

// One consistent tooltip for every chart on this page (Yearly/Daily x
// overall/resort-wise) - previously copy-pasted identically 4 times.
const RevenueTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--gray-300)",
        padding: "10px",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div><strong>{data.label}</strong></div>
      <div style={{ color: "var(--primary-teal)" }}>Direct: ₹ {data.directRevenue}</div>
      <div style={{ color: "var(--primary-purple)" }}>OTA: ₹ {data.otaRevenue}</div>
      <div>Total: ₹ {data.directRevenue + data.otaRevenue}</div>
    </div>
  );
};

const RevenueDashboard = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [resorts, setResorts] = useState([]);
  const [selectedResort, setSelectedResort] = useState("");
  const [yearlyRevenueData, setYearlyRevenueData] = useState([]);
  const [dailyRevenueData, setDailyRevenueData] = useState([]);
  const [resortYearlyData, setResortYearlyData] = useState([]);
  const [resortDailyData, setResortDailyData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const token = localStorage.getItem("token");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ================= FETCH RESORTS =================
  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const res = await fetch(
          `${config.BASE_URL}/api/resorts/resort-names-drop-down`,
          { headers }
        );
        const data = await res.json();
        setResorts(data);
        if (data.length > 0) setSelectedResort(data[0].id.toString());
      } catch (err) {
        console.error("Error fetching resorts:", err);
      }
    };
    fetchResorts();
  }, []);

  // ================= YEARLY REVENUE =================
  useEffect(() => {
    const fetchYearlyRevenue = async () => {
      try {
        const data = await getYearlyRevenue(selectedYear);
        setYearlyRevenueData(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchYearlyRevenue();
  }, [selectedYear]);

  // ================= DAILY REVENUE =================
  useEffect(() => {
    const fetchDailyRevenue = async () => {
      try {
        const data = await getDailyRevenue(selectedYear, selectedMonth);
        setDailyRevenueData(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDailyRevenue();
  }, [selectedMonth, selectedYear]);

  // ================= RESORT-WISE YEARLY =================
  useEffect(() => {
    if (!selectedResort) return;
    const fetchResortYearly = async () => {
      try {
        const data = await getResortYearlyRevenue(selectedResort, selectedYear);
        setResortYearlyData(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchResortYearly();
  }, [selectedResort, selectedYear]);

  // ================= RESORT-WISE DAILY =================
  useEffect(() => {
    if (!selectedResort) return;
    const fetchResortDaily = async () => {
      try {
        const data = await getResortDailyRevenue(selectedResort, selectedYear, selectedMonth);
        setResortDailyData(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchResortDaily();
  }, [selectedResort, selectedMonth, selectedYear]);

  // ================= HELPERS =================
  const monthLabels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const getTotal = (arr) => arr.reduce((acc, d) => acc + d.otaRevenue + d.directRevenue, 0);

  const exportRevenue = (filename, data) => {
    const rows = data.map((d) => ({ ...d, total: d.otaRevenue + d.directRevenue }));
    downloadCsv(filename, rows, [
      { key: "label", header: "Period" },
      { key: "otaRevenue", header: "OTA Revenue" },
      { key: "directRevenue", header: "Direct Revenue" },
      { key: "total", header: "Total" },
    ]);
  };

  const selectedResortName =
    resorts.find((r) => r.id.toString() === selectedResort)?.name || "resort";

  const yearOptions = Array.from({ length: 5 }).map((_, i) => {
    const yr = currentYear - i;
    return { value: yr, label: String(yr) };
  });
  const monthOptions = monthLabels.map((m, idx) => ({ value: idx + 1, label: m }));
  const resortOptions = resorts.map((r) => ({ value: r.id.toString(), label: r.name }));

  // ================= RENDER =================
  return (
    <div className="page-container revenue-dashboard">
      <div className="vt-page-header">
        <h2>Revenue Dashboard</h2>
      </div>

      {/* Yearly Revenue */}
      <section className="revenue-section">
        <div className="section-header">
          <h3>Yearly Revenue</h3>
          <div className="filters">
            <Select
              options={yearOptions}
              value={yearOptions.find((o) => o.value === Number(selectedYear))}
              onChange={(opt) => setSelectedYear(opt.value)}
              isSearchable={false}
              classNamePrefix="react-select"
              className="react-select-container filter-select"
              menuPortalTarget={menuPortalTarget}
              menuPosition={menuPosition}
              styles={themedSelectStyles()}
            />
            {isSuperAdmin() && (
              <button
                type="button"
                className="export-csv-btn"
                onClick={() => exportRevenue(`yearly-revenue_${selectedYear}.csv`, yearlyRevenueData)}
              >
                Export CSV
              </button>
            )}
          </div>
        </div>

        <div className="cards">
          <div className="card">
            <h4>Total Revenue</h4>
            <p>₹ {getTotal(yearlyRevenueData)}</p>
          </div>
        </div>

        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearlyRevenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip content={<RevenueTooltip />} />
              <Legend />
              <Bar dataKey="directRevenue" stackId="revenue" fill="var(--primary-teal)" />
              <Bar dataKey="otaRevenue" stackId="revenue" fill="var(--primary-purple)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Daily Revenue */}
 {/* Overall Daily Revenue */}
<section className="revenue-section">
  <div className="section-header">
    <h3>Overall Daily Revenue</h3>
    <div className="filters">
      <Select
        options={monthOptions}
        value={monthOptions.find((o) => o.value === Number(selectedMonth))}
        onChange={(opt) => setSelectedMonth(opt.value)}
        isSearchable={false}
        classNamePrefix="react-select"
        className="react-select-container filter-select"
        menuPortalTarget={menuPortalTarget}
        menuPosition={menuPosition}
        styles={themedSelectStyles()}
      />
      {isSuperAdmin() && (
        <button
          type="button"
          className="export-csv-btn"
          onClick={() => exportRevenue(`daily-revenue_${monthLabels[selectedMonth - 1]}-${selectedYear}.csv`, dailyRevenueData)}
        >
          Export CSV
        </button>
      )}
    </div>
  </div>

  <div className="cards">
    <div className="card">
      <h4>Total Revenue</h4>
      <p>₹ {getTotal(dailyRevenueData)}</p>
    </div>
  </div>

  <div className="chart-wrapper">
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={dailyRevenueData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip content={<RevenueTooltip />} />
        <Legend />
        <Line type="monotone" dataKey="directRevenue" stroke="var(--primary-teal)" strokeWidth={3} />
        <Line type="monotone" dataKey="otaRevenue" stroke="var(--primary-purple)" strokeWidth={3} />
      </LineChart>
    </ResponsiveContainer>
  </div>
</section>

      {/* Resort-wise Yearly Revenue */}
      <section className="revenue-section">
        <div className="section-header">
          <h3>Resort-wise Yearly Revenue</h3>
          <div className="filters">
            <Select
              options={resortOptions}
              value={resortOptions.find((o) => o.value === selectedResort) || null}
              onChange={(opt) => setSelectedResort(opt ? opt.value : "")}
              isSearchable={false}
              placeholder="Select resort..."
              classNamePrefix="react-select"
              className="react-select-container filter-select filter-select--resort"
              menuPortalTarget={menuPortalTarget}
              menuPosition={menuPosition}
              styles={themedSelectStyles()}
            />
            <Select
              options={yearOptions}
              value={yearOptions.find((o) => o.value === Number(selectedYear))}
              onChange={(opt) => setSelectedYear(opt.value)}
              isSearchable={false}
              classNamePrefix="react-select"
              className="react-select-container filter-select"
              menuPortalTarget={menuPortalTarget}
              menuPosition={menuPosition}
              styles={themedSelectStyles()}
            />
            {isSuperAdmin() && (
              <button
                type="button"
                className="export-csv-btn"
                onClick={() => exportRevenue(`resort-yearly-revenue_${selectedResortName}_${selectedYear}.csv`, resortYearlyData)}
              >
                Export CSV
              </button>
            )}
          </div>
        </div>

        <div className="cards">
          <div className="card">
            <h4>Total Revenue</h4>
            <p>₹ {getTotal(resortYearlyData)}</p>
          </div>
        </div>

        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={resortYearlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip content={<RevenueTooltip />} />
              <Legend />
              <Bar dataKey="directRevenue" stackId="revenue" fill="var(--primary-teal)" />
              <Bar dataKey="otaRevenue" stackId="revenue" fill="var(--primary-purple)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

 {/* Resort-wise Daily Revenue */}
<section className="revenue-section">
  <div className="section-header">
    <h3>Resort-wise Daily Revenue</h3>
    <div className="filters">
      <Select
        options={resortOptions}
        value={resortOptions.find((o) => o.value === selectedResort) || null}
        onChange={(opt) => setSelectedResort(opt ? opt.value : "")}
        isSearchable={false}
        placeholder="Select resort..."
        classNamePrefix="react-select"
        className="react-select-container filter-select filter-select--resort"
        menuPortalTarget={menuPortalTarget}
        menuPosition={menuPosition}
        styles={themedSelectStyles()}
      />
      <Select
        options={monthOptions}
        value={monthOptions.find((o) => o.value === Number(selectedMonth))}
        onChange={(opt) => setSelectedMonth(opt.value)}
        isSearchable={false}
        classNamePrefix="react-select"
        className="react-select-container filter-select"
        menuPortalTarget={menuPortalTarget}
        menuPosition={menuPosition}
        styles={themedSelectStyles()}
      />
      {isSuperAdmin() && (
        <button
          type="button"
          className="export-csv-btn"
          onClick={() => exportRevenue(`resort-daily-revenue_${selectedResortName}_${monthLabels[selectedMonth - 1]}-${selectedYear}.csv`, resortDailyData)}
        >
          Export CSV
        </button>
      )}
    </div>
  </div>

  <div className="cards">
    <div className="card">
      <h4>Total Revenue</h4>
      <p>₹ {getTotal(resortDailyData)}</p>
    </div>
  </div>

  <div className="chart-wrapper">
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={resortDailyData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip content={<RevenueTooltip />} />
        <Legend />
        <Line type="monotone" dataKey="directRevenue" stroke="var(--primary-teal)" strokeWidth={3} />
        <Line type="monotone" dataKey="otaRevenue" stroke="var(--primary-purple)" strokeWidth={3} />
      </LineChart>
    </ResponsiveContainer>
  </div>
</section>
    </div>
  );
};

export default RevenueDashboard;