// src/components/RecordExpenseForm.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/theme.css";
import "./RecordExpenseForm.css";

const RecordExpenseForm = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const expenseToEdit = location.state?.expenseToEdit || null;

  const [description, setDescription] = useState(expenseToEdit?.description || "");
  const [amount, setAmount] = useState(expenseToEdit?.amount || 0);
  const [expenseDate, setExpenseDate] = useState(
    expenseToEdit?.expenseDate || new Date().toISOString().split("T")[0]
  );
  const [paidBy, setPaidBy] = useState(expenseToEdit?.paidBy || "AJAY");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!description || !amount || !expenseDate || !paidBy) {
      alert("Please fill all fields");
      return;
    }

    const newExpense = {
      id: expenseToEdit ? expenseToEdit.id : Date.now(),
      description,
      amount: Number(amount),
      expenseDate,
      paidBy,
    };

    navigate("/admin/expenses", {
      state: { newExpense },
      replace: true, // avoids duplicates in history
    });
  };

  return (
    <div className="form-wrapper">
      <h2>{expenseToEdit ? "Edit Expense" : "Record New Expense"}</h2>

      {/* Back to Expenses Dashboard Button */}
      <button
        type="button"
        className="back-bookings-btn"
        onClick={() => navigate("/admin/expenses")}
      >
        &larr; Back To Dashboard
      </button>

      <form onSubmit={handleSubmit} className="create-entry-form">
        <div className="filter-item">
          <label>Description:</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="filter-item">
          <label>Amount:</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="filter-item">
          <label>Date:</label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
          />
        </div>

        <div className="filter-item">
          <label>Paid By:</label>
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            <option value="AJAY">AJAY</option>
            <option value="ROHAN">ROHAN</option>
            <option value="CASH">CASH</option>
          </select>
        </div>

        <button type="submit" className="create-booking-btn">
          {expenseToEdit ? "Update Expense" : "Record Expense"}
        </button>
      </form>
    </div>
  );
};

export default RecordExpenseForm;
