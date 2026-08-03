// src/components/AdminExpensesDashboard.jsx
import React, { useState, useEffect } from "react";
import config from "../config";
import "./AdminExpensesDashboard.css";
import Select from "react-select";

const AdminExpensesDashboard = () => {
  const [expenses, setExpenses] = useState([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [selectedResort, setSelectedResort] = useState(null); // react-select object {value, label}
  const [editId, setEditId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const [collectors, setCollectors] = useState([]);
  const [resorts, setResorts] = useState([]);

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

  // Fetch expenses whenever month or resort filter changes
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        let url = `${config.BASE_URL}/api/expenses/fetch?month=${selectedMonth}`;
        if (selectedResort) url += `&resortId=${selectedResort.value}`;

        const res = await fetch(url, { headers: config.getHeaders() });
        if (!res.ok) throw new Error("Failed to fetch expenses");

        const data = await res.json();
        setExpenses(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchExpenses();
  }, [selectedMonth, selectedResort]);

  // Form submit handler
  const handleAddOrEdit = async (e) => {
    e.preventDefault();
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

      if (!res.ok) throw new Error("Failed to save expense");
      const data = await res.json();

      setExpenses(prev => editId ? prev.map(e => e.id === editId ? data : e) : [...prev, data]);

      // Reset form
      setEditId(null);
      setDescription("");
      setAmount("");
      setExpenseDate("");
      setPaidBy("");
      setSelectedResort(null);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleEdit = (exp) => {
    setEditId(exp.id);
    setDescription(exp.description);
    setAmount(exp.amount);
    setExpenseDate(exp.expenseDate);
    setPaidBy(exp.paidBy);
    setSelectedResort({ value: exp.resortId, label: exp.resortName });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      const res = await fetch(`${config.BASE_URL}/api/expenses/${id}`, {
        method: "DELETE",
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete expense");
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="resorts-page-container">
      <div className="page-header">
        <h2>Manage Expenses</h2>
      </div>

      {/* Expense Form */}
      <form className="resort-form" onSubmit={handleAddOrEdit}>
        <div className="form-row">
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <input
            type="date"
            value={expenseDate}
            onChange={e => setExpenseDate(e.target.value)}
            required
          />

          <select value={paidBy} onChange={e => setPaidBy(e.target.value)} required>
            <option value="">Paid By</option>
            {collectors.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <Select
            className="react-select-container"
            classNamePrefix="react-select"
            placeholder="Select Resort"
            options={resorts}
            value={selectedResort}
            onChange={setSelectedResort}
            isClearable
          />
        </div>

        <div className="form-row">
          <button type="submit">{editId ? "Update Expense" : "Add Expense"}</button>
          <button type="button" className="cancel-btn" onClick={() => {
            setEditId(null);
            setDescription("");
            setAmount("");
            setExpenseDate("");
            setPaidBy("");
            setSelectedResort(null);
          }}>Cancel</button>
        </div>
      </form>

      {/* Month & Resort Filters */}
      <div className="form-row month-picker" style={{ margin: "12px 0" }}>
        <label>Select Month:</label>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />

        <label style={{ marginLeft: "16px" }}>Select Resort:</label>
        <Select
          options={resorts}
          value={selectedResort}
          onChange={setSelectedResort}
          placeholder="All Resorts"
          isClearable
        />
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
                    <button className="edit-booking-btn" onClick={() => handleEdit(exp)}>Edit</button>
                    <button className="delete-booking-btn" onClick={() => handleDelete(exp.id)}>Delete</button>
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
                  <strong>₹{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}</strong>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default AdminExpensesDashboard;