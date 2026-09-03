// src/components/AuditLog.jsx
import React, { useEffect, useState } from "react";
import config from "../config";
import { toLocalDateStr } from "../utils/date";

const formatDateTime = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const thirtyDaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
};

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [fromDate, setFromDate] = useState(thirtyDaysAgo());
  const [toDate, setToDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 20;

  // Filters changing means a different result set — start back on page 1.
  useEffect(() => {
    setPage(0);
  }, [fromDate, toDate]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const url =
          `${config.BASE_URL}/api/audit-log` +
          `?fromDate=${toLocalDateStr(fromDate)}` +
          `&toDate=${toLocalDateStr(toDate)}` +
          `&page=${page}&size=${PAGE_SIZE}`;
        const res = await fetch(url, { headers: config.getHeaders() });
        if (!res.ok) throw new Error("Failed to fetch audit log");
        const data = await res.json();
        setLogs(data.content || []);
        setTotalPages(data.totalPages ?? 0);
      } catch (err) {
        console.error(err);
        setLogs([]);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [fromDate, toDate, page]);

  return (
    <div className="resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <div className="page-header" style={{ marginBottom: "20px" }}>
        <h2>Audit Log</h2>
      </div>

      <div className="form-row" style={{ display: "flex", gap: "16px", alignItems: "flex-end", margin: "12px 0" }}>
        <div>
          <label style={{ display: "block", marginBottom: "4px" }}>From Date</label>
          <input
            type="date"
            value={toLocalDateStr(fromDate)}
            onChange={(e) => setFromDate(new Date(e.target.value))}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "4px" }}>To Date</label>
          <input
            type="date"
            value={toLocalDateStr(toDate)}
            onChange={(e) => setToDate(new Date(e.target.value))}
          />
        </div>
      </div>

      <div className="table-wrapper" style={{ overflowX: "auto" }}>
        <table className="resorts-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Details</th>
              <th>Performed By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="4">No audit entries for this range</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.performedAt)}</td>
                  <td>{log.action}</td>
                  <td>{log.details}</td>
                  <td>{log.performedByName || log.performedByUserId || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginTop: "14px" }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span>Page {page + 1} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
