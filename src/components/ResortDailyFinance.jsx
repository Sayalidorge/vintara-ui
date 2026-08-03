import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./ResortDailyFinance.css";
import config from "../config";

const ResortDailyFinance = () => {

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch (e) {
      return null;
    }
  }, []);

  const [loading, setLoading] = useState(true);

  const [allResorts, setAllResorts] = useState([]);
  const [assignedResortIds, setAssignedResortIds] = useState([]);
  const [selectedResort, setSelectedResort] = useState(null);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const [foodBillCollection, setfoodBillCollection] = useState("");

  const [expenseAmount, setExpenseAmount] = useState("");

  const [financeEntries, setFinanceEntries] = useState([]);

  const [saving, setSaving] = useState(false);

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });

  const [toDate, setToDate] = useState(new Date());

  //---------------------------------------------------------
  // Load active resorts
  //---------------------------------------------------------

  useEffect(() => {

    const loadResorts = async () => {

      try {

        const res = await fetch(
          `${config.BASE_URL}/api/resorts/active`,
          {
            headers: config.getHeaders(),
          }
        );

        if (!res.ok)
          throw new Error("Unable to load resorts");

        const data = await res.json();

        const options = data.map(r => ({
          value: r.id,
          label: r.name
        }));

        setAllResorts(options);

      } catch (e) {
        console.error(e);
      }

    };

    loadResorts();

  }, []);

  //---------------------------------------------------------
  // Load manager assigned resorts
  //---------------------------------------------------------

  useEffect(() => {

    if (user?.role !== "PROPERTY_MANAGER")
      return;

    const loadAssigned = async () => {

      try {

        const res = await fetch(
          `${config.BASE_URL}/api/resorts/manager`,
          {
            headers: config.getHeaders(),
          }
        );

        if (!res.ok)
          throw new Error("Unable to fetch manager resorts");

        const data = await res.json();

        setAssignedResortIds(data.map(r => r.id));

      } catch (e) {
        console.error(e);
      }

    };

    loadAssigned();

  }, [user]);

  //---------------------------------------------------------
  // Filter resorts
  //---------------------------------------------------------

  const resorts = useMemo(() => {

    if (!allResorts.length)
      return [];

    if (user?.role === "PROPERTY_MANAGER") {

      return allResorts.filter(r =>
        assignedResortIds.includes(r.value)
      );

    }

    return allResorts;

  }, [allResorts, assignedResortIds, user]);

  //---------------------------------------------------------
  // Auto select first resort
  //---------------------------------------------------------

  useEffect(() => {

    if (resorts.length > 0 && !selectedResort) {

      setSelectedResort(resorts[0]);

    }

  }, [resorts, selectedResort]);

  //---------------------------------------------------------
  // Load finance history
  //---------------------------------------------------------

  const fetchFinanceEntries = async () => {

    if (!selectedResort)
      return;

    try {

      setLoading(true);

      const url =
        `${config.BASE_URL}/api/resort-daily-finance` +
        `?resortId=${selectedResort.value}` +
        `&fromDate=${fromDate.toISOString().split("T")[0]}` +
        `&toDate=${toDate.toISOString().split("T")[0]}`;

      const res = await fetch(url, {
        headers: config.getHeaders(),
      });

      if (!res.ok)
        throw new Error("Unable to fetch finance");

      const data = await res.json();

      setFinanceEntries(data);

    } catch (e) {

      console.error(e);

      setFinanceEntries([]);

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {

    fetchFinanceEntries();

  }, [selectedResort, fromDate, toDate]);

  //---------------------------------------------------------
  // Clear form after save
  //---------------------------------------------------------

  const clearForm = () => {

    setfoodBillCollection("");

    setExpenseAmount("");
  };

  //---------------------------------------------------------
  // Continue in Part 2...
  //---------------------------------------------------------
    //---------------------------------------------------------
  // Save Food Collection / Expense
  //---------------------------------------------------------

const handleSave = async () => {

  if (!selectedResort) {
    alert("Please select a resort.");
    return;
  }

  if (
    foodBillCollection === "" &&
    expenseAmount === ""
) {
    alert("Please enter Food Collection or Expense.");
    return;
}

  if (expenseAmount === "" || Number(expenseAmount) < 0) {
    alert("Please enter a valid expense amount.");
    return;
  }

  const payload = {
    resortId: selectedResort.value,
    financeDate: selectedDate.toISOString().split("T")[0],
    foodBillCollection: Number(foodBillCollection),
    expenseAmount: Number(expenseAmount),
  };
console.log(payload);
  try {

    const res = await fetch(
      `${config.BASE_URL}/api/resort-daily-finance`,
      {
        method: "POST",
        headers: config.getHeaders(),
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      throw new Error("Unable to save.");
    }

    clearForm();

    fetchFinanceEntries();

  } catch (e) {

    console.error(e);

    alert("Unable to save daily finance.");

  }

};
  const formatDate = (date) => {

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

};

const totalFoodCollection = financeEntries.reduce(
    (sum, item) => sum + Number(item.foodBillCollection || 0),
    0
);

const totalExpense = financeEntries.reduce(
    (sum, item) => sum + Number(item.expenseAmount || 0),
    0
);

const totalProfit = totalFoodCollection - totalExpense;

    return (
    <div className="finance-wrapper">

      <h2 className="page-title">
  {user?.role === "ADMIN"
    ? "Food Collection & Expenses"
    : "Resort Daily Finance"}
</h2>
{user?.role !== "ADMIN" && (
      <div className="filters">

        <div className="filter-item">
          <label>Resort</label>

          <Select
            options={resorts}
            value={selectedResort}
            onChange={setSelectedResort}
            placeholder="Select Resort"
            isDisabled={
              user?.role === "PROPERTY_MANAGER" &&
              resorts.length === 1
            }
          />
        </div>

        <div className="filter-item">
          <label>Date</label>

          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="yyyy-MM-dd"
            className="custom-datepicker"
          />
        </div>

      </div>
)}
      {/* Tabs */}



      {/* Form */}

{/* Finance Entry */}
{user?.role !== "ADMIN" && (
    
<div className="finance-card">

  <div className="finance-entry-row">

    <div className="finance-input">

      <label>Food Collection (₹)</label>

      <input
        type="number"
        min="0"
        value={foodBillCollection}
        onChange={(e) => setfoodBillCollection(e.target.value)}
        placeholder="0"
      />

    </div>

    <div className="finance-input">

      <label>Total Expense (₹)</label>

      <input
        type="number"
        min="0"
        value={expenseAmount}
        onChange={(e) => setExpenseAmount(e.target.value)}
        placeholder="0"
      />

    </div>

    <div className="finance-button">

<button
    className="save-btn"
    onClick={handleSave}
>
    Save
</button>

    </div>

  </div>

</div>
)}
      {/* Search */}

      <div
        className="filters"
        style={{marginTop:30}}
      >

        <div className="filter-item">

          <label>From</label>

          <DatePicker
    selected={fromDate}
    onChange={(d) => setFromDate(d)}
    maxDate={toDate}
    dateFormat="yyyy-MM-dd"
    className="custom-datepicker"
/>
        </div>

        <div className="filter-item">

          <label>To</label>

          <DatePicker
    selected={toDate}
    onChange={(d) => setToDate(d)}
    minDate={fromDate}
    maxDate={new Date()}
    dateFormat="yyyy-MM-dd"
    className="custom-datepicker"
/>

        </div>
<div className="filter-item">
          <label>Resort</label>

          <Select
            options={resorts}
            value={selectedResort}
            onChange={setSelectedResort}
            placeholder="Select Resort"
            isDisabled={
              user?.role === "PROPERTY_MANAGER" &&
              resorts.length === 1
            }
          />
        </div>
      </div>

      {/* Table */}

      <div className="finance-table">

        <table>

          <thead>

            <tr>

              <th>Date</th>

              <th>Resort</th>

              <th>Food Collection</th>

              <th>Expense</th>
{user?.role === "ADMIN" && (
        <th>Profit</th>
    )}
            </tr>

          </thead>

          <tbody>

            {loading ? (

              <tr>

                <td
                  colSpan="4"
                  style={{textAlign:"center"}}
                >
                  Loading...
                </td>

              </tr>

            ) : financeEntries.length===0 ? (

              <tr>

                <td
                  colSpan="4"
                  style={{textAlign:"center"}}
                >
                  No records found.
                </td>

              </tr>

            ) : (

              financeEntries.map(entry=>(

                <tr key={entry.id}>

                  <td>{formatDate(entry.financeDate)}</td>

                  <td>{entry.resortName}</td>

                  <td>
                    ₹{Number(entry.foodBillCollection)
                    .toLocaleString()}
                  </td>

                  <td>
                    ₹{Number(entry.expenseAmount)
                    .toLocaleString()}
                  </td>
                  {user?.role === "ADMIN" && (
    <td
        style={{
            color:
                entry.foodBillCollection - entry.expenseAmount >= 0
                    ? "#2e7d32"
                    : "#d32f2f",
            fontWeight: 600
        }}
    >
        ₹{(
            Number(entry.foodBillCollection) -
            Number(entry.expenseAmount)
        ).toLocaleString()}
    </td>
)}
                </tr>

              ))

            )}

          </tbody>
<tfoot>

<tr>

<td colSpan="2"><strong>Total</strong></td>

<td><strong>₹{totalFoodCollection.toLocaleString()}</strong></td>

<td><strong>₹{totalExpense.toLocaleString()}</strong></td>

{user?.role === "ADMIN" && (
    <td><strong>₹{totalProfit.toLocaleString()}</strong></td>
)}
</tr>

</tfoot>
        </table>

      </div>

    </div>

  );

};

export default ResortDailyFinance;