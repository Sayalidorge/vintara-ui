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
import { getYearlyRevenue, getDailyRevenue, getResortYearlyRevenue, getResortDailyRevenue } from "../services/RevenueService";
import config from "../config";
import "./RevenueDashboard.css";

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

  // ================= RENDER =================
  return (
    <div className="page-container revenue-dashboard">
      <h2 className="page-title">Revenue Dashboard</h2>

      {/* Yearly Revenue */}
      <section className="revenue-section">
        <div className="section-header">
          <h3>Yearly Revenue</h3>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            {Array.from({ length: 5 }).map((_, i) => {
              const yr = currentYear - i;
              return <option key={yr} value={yr}>{yr}</option>;
            })}
          </select>
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
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div style={{
                        background: "#fff",
                        border: "1px solid #ccc",
                        padding: "10px",
                        borderRadius: "6px",
                      }}>
                        <div><strong>{data.label}</strong></div>
                        <div style={{ color: "var(--primary-teal)" }}>Direct: ₹ {data.directRevenue}</div>
                        <div style={{ color: "var(--primary-purple)" }}>OTA: ₹ {data.otaRevenue}</div>
                        <div>Total: ₹ {data.directRevenue + data.otaRevenue}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
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
    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
      {monthLabels.map((m, idx) => (
        <option key={idx + 1} value={idx + 1}>{m}</option>
      ))}
    </select>
  </div>

  <div className="cards">
    <div className="card">
      <h4>Total Revenue</h4>
      <p>₹ {getTotal(dailyRevenueData)}</p>
    </div>
  </div>

  <div className="chart-wrapper">
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={dailyRevenueData}> {/* Ensure dailyRevenueData is set correctly */}
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" /> {/* 'label' will map to day */}
        <YAxis />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div style={{
                  background: "#fff",
                  border: "1px solid #ccc",
                  padding: "10px",
                  borderRadius: "6px",
                }}>
                  <div><strong>{data.label}</strong></div>
                  <div style={{ color: "var(--primary-teal)" }}>Direct: ₹ {data.directRevenue}</div>
                  <div style={{ color: "var(--primary-purple)" }}>OTA: ₹ {data.otaRevenue}</div>
                  <div>Total: ₹ {data.directRevenue + data.otaRevenue}</div>
                </div>
              );
            }
            return null;
          }}
        />
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
            <select value={selectedResort} onChange={(e) => setSelectedResort(e.target.value)}>
              {resorts.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
              {Array.from({ length: 5 }).map((_, i) => {
                const yr = currentYear - i;
                return <option key={yr} value={yr}>{yr}</option>;
              })}
            </select>
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
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div style={{
                        background: "#fff",
                        border: "1px solid #ccc",
                        padding: "10px",
                        borderRadius: "6px",
                      }}>
                        <div><strong>{data.label}</strong></div>
                        <div style={{ color: "var(--primary-teal)" }}>Direct: ₹ {data.directRevenue}</div>
                        <div style={{ color: "var(--primary-purple)" }}>OTA: ₹ {data.otaRevenue}</div>
                        <div>Total: ₹ {data.directRevenue + data.otaRevenue}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
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
      <select value={selectedResort} onChange={(e) => setSelectedResort(e.target.value)}>
        {resorts.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
        {monthLabels.map((m, idx) => (
          <option key={idx + 1} value={idx + 1}>{m}</option>
        ))}
      </select>
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
      <LineChart data={resortDailyData}> {/* Ensure resortDailyData is set correctly */}
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" /> {/* Corrected from 'day' to 'label' */}
        <YAxis />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div style={{
                  background: "#fff",
                  border: "1px solid #ccc",
                  padding: "10px",
                  borderRadius: "6px",
                }}>
                  <div><strong>{data.label}</strong></div>
                  <div style={{ color: "var(--primary-teal)" }}>Direct: ₹ {data.directRevenue}</div>
                  <div style={{ color: "var(--primary-purple)" }}>OTA: ₹ {data.otaRevenue}</div>
                  <div>Total: ₹ {data.directRevenue + data.otaRevenue}</div>
                </div>
              );
            }
            return null;
          }}
        />
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