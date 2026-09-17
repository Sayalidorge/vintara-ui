import React, { useCallback, useEffect, useState } from "react";
import Select from "react-select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import config from "../config";
import "../css/theme.css";
import "../css/components.css";
import "./PerformanceDashboard.css";
import { getUserRole } from "../utils/auth";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";

// Brand-only (teal/purple derived), not an arbitrary rainbow - each user's
// bar gets a different shade of teal or purple rather than an unrelated hue.
const BAR_COLORS = ["#008080", "#800080", "#4da6a6", "#b366b3", "#005f5f", "#590059", "#7fbfbf", "#cc99cc"];

const money = (n) => (n === null || n === undefined ? "-" : `₹${Number(n).toLocaleString()}`);

const monthOptions = [
    { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
    { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
    { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
];

// 0 is a sentinel for "All Months" (whole-year scope) - Top Performers can
// be viewed either way, independent of the two graphs above it.
const performerMonthOptions = [{ value: 0, label: "All Months" }, ...monthOptions];

const PerformanceDashboard = () => {
    // A plain USER only ever sees their own data - no user picker, locked to
    // self server-side too (see PerformanceController/PerformanceService).
    const canSeeEveryone = getUserRole() !== "USER";

    const [resorts, setResorts] = useState([]);
    const [selectedResort, setSelectedResort] = useState(null); // null = "All"
    const [userOptions, setUserOptions] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null); // null = "All"
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [yearlySeries, setYearlySeries] = useState(null);
    const [monthlySeries, setMonthlySeries] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    // Top Performers has its own Year/Month scope, independent of the
    // graphs above - 0 means "All Months" (whole year).
    const [performersYear, setPerformersYear] = useState(new Date().getFullYear());
    const [performersMonth, setPerformersMonth] = useState(0);
    const [topPerformers, setTopPerformers] = useState([]);
    const isSuperAdmin = getUserRole() === "SUPER_ADMIN";

    useEffect(() => {
        fetch(`${config.BASE_URL}/api/resorts`, { headers: config.getHeaders() })
            .then((res) => res.json())
            .then((data) => setResorts((data || []).map((r) => ({ value: r.id, label: r.name }))))
            .catch(() => setResorts([]));
    }, []);

    useEffect(() => {
        if (!canSeeEveryone) return;
        fetch(`${config.BASE_URL}/users/attendance-users`, { headers: config.getHeaders() })
            .then((res) => res.json())
            .then((data) => setUserOptions((data || []).map((u) => ({ value: u.id, label: u.name }))))
            .catch(() => setUserOptions([]));
    }, [canSeeEveryone]);

    const buildQuery = useCallback((extra) => {
        const params = new URLSearchParams();
        if (selectedResort) params.set("resortId", selectedResort.value);
        if (canSeeEveryone && selectedUser) params.set("userId", selectedUser.value);
        Object.entries(extra).forEach(([k, v]) => params.set(k, v));
        return params.toString();
    }, [selectedResort, selectedUser, canSeeEveryone]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [yearlyRes, monthlyRes, summaryRes] = await Promise.all([
                fetch(`${config.BASE_URL}/api/performance/turnover/yearly?${buildQuery({ year })}`, { headers: config.getHeaders() }),
                fetch(`${config.BASE_URL}/api/performance/turnover/monthly?${buildQuery({ year, month })}`, { headers: config.getHeaders() }),
                fetch(`${config.BASE_URL}/api/performance/summary?${buildQuery({ year })}`, { headers: config.getHeaders() }),
            ]);
            setYearlySeries(await yearlyRes.json());
            setMonthlySeries(await monthlyRes.json());
            setSummary(await summaryRes.json());
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, [buildQuery, year, month]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!isSuperAdmin) return;
        const params = { year: performersYear };
        if (performersMonth) params.month = performersMonth;
        fetch(`${config.BASE_URL}/api/performance/top-performers?${buildQuery(params)}`, { headers: config.getHeaders() })
            .then((res) => res.json())
            .then(setTopPerformers)
            .catch(() => setTopPerformers([]));
    }, [buildQuery, performersYear, performersMonth, isSuperAdmin]);

    const renderChart = (series) => (
        <ResponsiveContainer width="100%" height={320}>
            <BarChart data={series?.rows || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--chart-axis-line)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => money(v)} />
                <Legend />
                {(series?.users || []).map((u, i) => (
                    <Bar
                        key={u.userId}
                        dataKey={String(u.userId)}
                        name={u.userName}
                        fill={BAR_COLORS[i % BAR_COLORS.length]}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );

    return (
        <div className="performance-dashboard">
            <div className="vt-page-header">
                <h2>Performance</h2>
            </div>

            <div className="filters">
                <div className="filter-item">
                    <label>Resort</label>
                    <Select
                        isClearable
                        options={resorts}
                        value={selectedResort}
                        onChange={setSelectedResort}
                        placeholder="All resorts"
                        menuPortalTarget={menuPortalTarget}
                        menuPosition={menuPosition}
                        styles={themedSelectStyles()}
                    />
                </div>

                {canSeeEveryone && (
                    <div className="filter-item">
                        <label>User</label>
                        <Select
                            isClearable
                            options={userOptions}
                            value={selectedUser}
                            onChange={setSelectedUser}
                            placeholder="All users"
                            menuPortalTarget={menuPortalTarget}
                            menuPosition={menuPosition}
                            styles={themedSelectStyles()}
                        />
                    </div>
                )}

                <div className="filter-item filter-item--narrow">
                    <label>Year</label>
                    <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
                </div>
            </div>

            {loading && <p>Loading…</p>}

            {summary && (
                <div className="ticker-row">
                    {summary.tickers.map((t) => (
                        <div className="ticker-card" key={t.userId}>
                            <div className="ticker-name">{t.userName}</div>
                            <div className="ticker-value">{money(t.turnover)}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="chart-card">
                <h3>Yearly Turnover — {year} (by month)</h3>
                {renderChart(yearlySeries)}
            </div>

            <div className="chart-card">
                <div className="chart-card-header">
                    <h3>Monthly Turnover — {monthOptions.find((m) => m.value === month)?.label} {year} (by day)</h3>
                    <div className="filter-item filter-item--inline">
                        <label>Month</label>
                        <Select
                            options={monthOptions}
                            value={monthOptions.find((m) => m.value === month)}
                            onChange={(opt) => setMonth(opt.value)}
                            menuPortalTarget={menuPortalTarget}
                            menuPosition={menuPosition}
                            styles={themedSelectStyles()}
                        />
                    </div>
                </div>
                {renderChart(monthlySeries)}
            </div>

            {isSuperAdmin && (
                <div className="chart-card top-performers">
                    <div className="chart-card-header">
                        <h3>
                            Top Performers — {performersMonth
                                ? `${performerMonthOptions.find((m) => m.value === performersMonth)?.label} ${performersYear}`
                                : performersYear}
                        </h3>
                        <div className="filter-item filter-item--inline filter-item--narrow">
                            <label>Year</label>
                            <input type="number" value={performersYear} onChange={(e) => setPerformersYear(Number(e.target.value))} />
                        </div>
                        <div className="filter-item filter-item--inline">
                            <label>Month</label>
                            <Select
                                options={performerMonthOptions}
                                value={performerMonthOptions.find((m) => m.value === performersMonth)}
                                onChange={(opt) => setPerformersMonth(opt.value)}
                                menuPortalTarget={menuPortalTarget}
                                menuPosition={menuPosition}
                                styles={themedSelectStyles()}
                            />
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Rooms Assigned</th>
                                <th>Bookings</th>
                                <th>Booking Ratio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topPerformers.map((p, i) => (
                                <tr key={p.userId}>
                                    <td><span className="rank-badge">{i + 1}</span>{p.userName}</td>
                                    <td className="numeric">{p.roomsAssigned}</td>
                                    <td className="numeric">{p.bookingsCount}</td>
                                    <td className="numeric">{p.bookingRatio ?? "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default PerformanceDashboard;
