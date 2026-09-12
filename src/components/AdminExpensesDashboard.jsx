// src/components/AdminExpensesDashboard.jsx
import React, { useState, useEffect } from "react";
import config from "../config";
import "./AdminExpensesDashboard.css";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { downloadCsv } from "../utils/csv";
import { toLocalDateStr } from "../utils/date";
import { isSuperAdmin } from "../utils/auth";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";

// Mirrors SettlementService.EXPENSE_EDIT_WINDOW_DAYS on the backend - kept in
// sync manually since there's no shared source of truth between the two apps.
const EXPENSE_EDIT_WINDOW_DAYS = 40;

const isWithinEditableWindow = (dateStr) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - EXPENSE_EDIT_WINDOW_DAYS);
  return new Date(dateStr) >= cutoff;
};

const AdminExpensesDashboard = () => {
  const [expenses, setExpenses] = useState([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(toLocalDateStr(new Date()));
  const [paidBy, setPaidBy] = useState("");
  const [selectedResort, setSelectedResort] = useState(null); // react-select object {value, label}
  const [editId, setEditId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedMonth = toLocalDateStr(selectedDate).slice(0, 7);

  const [collectors, setCollectors] = useState([]);
  const [resorts, setResorts] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const PAGE_SIZE = 20;

  // Fetch collectors dropdown
  useEffect(() => {
    const fetchCollectors = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/expenses/collectors`, { headers: config.getHeaders() });
        const data = await res.json();
        setCollectors(data);
      } catch (err) {
        console.error("Failed to fetch collectors", err);
      }
    };
    fetchCollectors();
  }, []);

  // Fetch resorts dropdown
  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/expenses/resort-names-dropdown`, { headers: config.getHeaders() });
        const data = await res.json();
        setResorts(data.map(r => ({ value: r.id, label: r.name })));
      } catch (err) {
        console.error("Failed to fetch resorts", err);
      }
    };
    fetchResorts();
  }, []);

  // Filters changing means a different result set — start back on page 1.
  useEffect(() => {
    setPage(0);
  }, [selectedMonth, selectedResort]);

  // Fetch expenses whenever month, resort filter, or page changes
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        let url = `${config.BASE_URL}/api/expenses/fetch?month=${selectedMonth}&page=${page}&size=${PAGE_SIZE}`;
        if (selectedResort) url += `&resortId=${selectedResort.value}`;

        const res = await fetch(url, { headers: config.getHeaders() });
        if (!res.ok) throw new Error("Failed to fetch expenses");

        const data = await res.json();
        setExpenses(data.content || []);
        setTotalPages(data.totalPages ?? 0);
      } catch (err) {
        console.error(err);
      }
    };
    fetchExpenses();
  }, [selectedMonth, selectedResort, page]);

  // Separate aggregate for the "Total" row — reflects every matching row for
  // the active filters, not just whatever page is currently displayed.
  // Also re-run after add/edit/delete so the total doesn't go stale.
  const fetchTotal = async () => {
    try {
      let url = `${config.BASE_URL}/api/expenses/fetch/total?month=${selectedMonth}`;
      if (selectedResort) url += `&resortId=${selectedResort.value}`;

      const res = await fetch(url, { headers: config.getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch expenses total");

      const total = await res.json();
      setExpensesTotal(total || 0);
    } catch (err) {
      console.error(err);
      setExpensesTotal(0);
    }
  };

  useEffect(() => {
    fetchTotal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedResort]);

  // Form submit handler
  const handleAddOrEdit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!description || !amount || !expenseDate || !paidBy || !selectedResort) {
      return alert("Please fill all fields");
    }

    const payload = {
      description,
      amount: parseFloat(amount),
      expenseDate,
      paidBy,
      resortId: selectedResort.value,
    };

    setIsSubmitting(true);
    try {
      const url = editId
        ? `${config.BASE_URL}/api/expenses/${editId}`
        : `${config.BASE_URL}/api/expenses/create`;
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: config.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to save expense");
      }
      const data = await res.json();

      setExpenses(prev => editId ? prev.map(e => e.id === editId ? data : e) : [...prev, data]);
      fetchTotal();

      // Reset form
      setEditId(null);
      setDescription("");
      setAmount("");
      setExpenseDate(toLocalDateStr(new Date()));
      setPaidBy("");
      setSelectedResort(null);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (exp) => {
    if (!isWithinEditableWindow(exp.expenseDate)) return;

    setEditId(exp.id);
    setDescription(exp.description);
    setAmount(exp.amount);
    setExpenseDate(exp.expenseDate);
    setPaidBy(exp.paidBy);
    setSelectedResort({ value: exp.resortId, label: exp.resortName });
  };

  const exportExpenses = async () => {
    // `expenses` is only the current page — fetch every matching row for
    // the active filters (not just what's on screen) before exporting.
    try {
      let url = `${config.BASE_URL}/api/expenses/fetch?month=${selectedMonth}&page=0&size=10000`;
      if (selectedResort) url += `&resortId=${selectedResort.value}`;

      const res = await fetch(url, { headers: config.getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch expenses for export");
      const data = await res.json();

      const resortLabel = selectedResort ? selectedResort.label : "all-resorts";
      downloadCsv(
        `expenses_${resortLabel}_${selectedMonth}.csv`,
        data.content || [],
        [
          { key: "id", header: "ID" },
          { key: "description", header: "Description" },
          { key: "amount", header: "Amount" },
          { key: "expenseDate", header: "Date" },
          { key: "paidBy", header: "Paid By" },
          { key: "resortName", header: "Resort" },
        ]
      );
    } catch (err) {
      console.error(err);
      alert("Failed to export expenses. Please try again.");
    }
  };

  const handleDelete = async (exp) => {
    if (!isWithinEditableWindow(exp.expenseDate)) return;
    if (!window.confirm("Delete this expense?")) return;
    try {
      const res = await fetch(`${config.BASE_URL}/api/expenses/${exp.id}`, {
        method: "DELETE",
        headers: config.getHeaders(),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to delete expense");
      }
      setExpenses(prev => prev.filter(e => e.id !== exp.id));
      fetchTotal();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <div className="page-header">
        <h2 style={{ fontSize: "23px", fontWeight: 700, color: "var(--text-dark)", textAlign: "left", letterSpacing: "0.2px", marginTop: "4px", marginBottom: "24px", paddingBottom: "6px", borderBottom: "2px dashed var(--primary-teal)" }}>Manage Expenses</h2>
      </div>

      {/* Expense Form */}
      <div className="expense-form-card">
        <h3 className="expense-form-card__title">
          {editId ? `Update Expense (ID: #${editId})` : "Add New Expense"}
        </h3>
        <form className="expense-form" onSubmit={handleAddOrEdit}>
          <div className="expense-form-row">
            <div className="expense-field">
              <label>Description</label>
              <input
                type="text"
                placeholder="Description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="expense-field">
              <label>Amount</label>
              <input
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="expense-form-row">
            <div className="expense-field">
              <label>Date</label>
              <DatePicker
                selected={expenseDate ? new Date(expenseDate) : null}
                onChange={date => setExpenseDate(date ? toLocalDateStr(date) : "")}
                dateFormat="dd/MM/yyyy"
                className="date-picker"
              />
            </div>

            <div className="expense-field">
              <label>Paid By</label>
              <select value={paidBy} onChange={e => setPaidBy(e.target.value)} required>
                <option value="">Paid By</option>
                {collectors.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="expense-field">
              <label>Resort</label>
              <Select
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Select Resort"
                options={resorts}
                value={selectedResort}
                onChange={setSelectedResort}
                isClearable
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
            </div>
          </div>

          <div className="expense-form-actions">
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : editId ? "Update Expense" : "Add Expense"}</button>
            <button type="button" className="cancel-btn" onClick={() => {
              setEditId(null);
              setDescription("");
              setAmount("");
              setExpenseDate(toLocalDateStr(new Date()));
              setPaidBy("");
              setSelectedResort(null);
            }}>Cancel</button>
          </div>
        </form>
      </div>

      {/* Month & Resort Filters */}
      <div className="form-row month-picker" style={{ margin: "12px 0" }}>
        <label>Select Month:</label>
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          dateFormat="dd/MM/yyyy"
          className="date-picker"
        />

        <label style={{ marginLeft: "16px" }}>Select Resort:</label>
        <Select
          className="react-select-container"
          classNamePrefix="react-select"
          options={resorts}
          value={selectedResort}
          onChange={setSelectedResort}
          placeholder="All Resorts"
          isClearable
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPosition}
          styles={themedSelectStyles()}
        />

        {isSuperAdmin() && (
          <button type="button" className="export-csv-btn" style={{ marginLeft: "16px" }} onClick={exportExpenses}>
            Export CSV
          </button>
        )}
      </div>

      {/* Expenses Table */}
      <div className="table-wrapper" style={{ overflowX: "auto" }}>
        <table className="resorts-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Paid By</th>
              <th>Resort</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan="7">No expenses for this month</td></tr>
            ) : (
              expenses.map(exp => (
                <tr key={exp.id}>
                  <td>{exp.id}</td>
                  <td>{exp.description}</td>
                  <td>₹{exp.amount.toLocaleString()}</td>
                  <td>{new Date(exp.expenseDate).toLocaleDateString("en-IN")}</td>
                  <td>{exp.paidBy}</td>
                  <td>{exp.resortName || "-"}</td> {/* resortName directly from DTO */}
                  <td className="actions">
                    {(() => {
                      const editable = isWithinEditableWindow(exp.expenseDate);
                      const title = editable ? undefined : `This expense is more than ${EXPENSE_EDIT_WINDOW_DAYS} days old and can no longer be edited or deleted.`;
                      return (
                        <>
                          <button className="edit-booking-btn" onClick={() => handleEdit(exp)} disabled={!editable} title={title}>Edit</button>
                          <button className="delete-booking-btn" onClick={() => handleDelete(exp)} disabled={!editable} title={title}>Delete</button>
                        </>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="2"><strong>Total</strong></td>
                <td colSpan="5">
                  <strong>₹{Number(expensesTotal).toLocaleString()}</strong>
                </td>
              </tr>
            </tfoot>
          )}
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

export default AdminExpensesDashboard;