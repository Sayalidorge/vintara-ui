import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./ResortDailyFinance.css";
import config from "../config";
import { toLocalDateStr } from "../utils/date";
import { downloadCsv } from "../utils/csv";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";

const ResortDailyFinance = () => {

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch (e) {
      return null;
    }
  }, []);

  const isAdminView = ["ADMIN", "SUPER_ADMIN"].includes(user?.role);
  const isSingleResortRole = ["PROPERTY_MANAGER", "RECEPTION"].includes(user?.role);

  const [loading, setLoading] = useState(true);

  const [allResorts, setAllResorts] = useState([]);
  const [selectedResort, setSelectedResort] = useState(null);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const [foodBillCollection, setfoodBillCollection] = useState("");

  const [expenseAmount, setExpenseAmount] = useState("");

  // Which account the expense was paid out of - fetched per selected resort,
  // same source used for check-in balance collection (payment-account
  // assignments per resort).
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState(null);

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

  // Resort list is already scoped server-side (GET /api/resorts/active
  // filters to the caller's assigned resorts for every non-SUPER_ADMIN role),
  // so no client-side filtering is needed here.
  const resorts = allResorts;

  //---------------------------------------------------------
  // Load payment accounts assigned to the selected resort
  //---------------------------------------------------------

  useEffect(() => {

    if (!selectedResort) {
      setPaymentAccounts([]);
      return;
    }

    const loadPaymentAccounts = async () => {
      try {
        const res = await fetch(
          `${config.BASE_URL}/api/resorts/${selectedResort.value}/payment-accounts`,
          { headers: config.getHeaders() }
        );
        if (!res.ok) throw new Error("Unable to load payment accounts");
        const data = await res.json();
        setPaymentAccounts(data.map((a) => ({ value: a.id, label: a.name })));
      } catch (e) {
        console.error(e);
        setPaymentAccounts([]);
      }
    };

    loadPaymentAccounts();

  }, [selectedResort]);

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
        `&fromDate=${toLocalDateStr(fromDate)}` +
        `&toDate=${toLocalDateStr(toDate)}`;

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

    setSelectedPaymentAccount(null);
  };

  //---------------------------------------------------------
  // Continue in Part 2...
  //---------------------------------------------------------
    //---------------------------------------------------------
  // Save Food Collection / Expense
  //---------------------------------------------------------

const handleSave = async () => {
  if (saving) return;

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
    financeDate: toLocalDateStr(selectedDate),
    foodBillCollection: Number(foodBillCollection),
    expenseAmount: Number(expenseAmount),
    paymentAccountId: selectedPaymentAccount ? selectedPaymentAccount.value : null,
  };
console.log(payload);
  setSaving(true);
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

  } finally {
    setSaving(false);
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

const exportFinanceEntries = () => {
  const rows = financeEntries.map((entry) => ({
    date: formatDate(entry.financeDate),
    resortName: entry.resortName,
    foodBillCollection: entry.foodBillCollection,
    expenseAmount: entry.expenseAmount,
    profit: Number(entry.foodBillCollection) - Number(entry.expenseAmount),
    paymentAccountName: entry.paymentAccountName || "-",
  }));
  downloadCsv(
    `property-collection_${selectedResort?.label || "resort"}_${toLocalDateStr(fromDate)}_to_${toLocalDateStr(toDate)}.csv`,
    rows,
    [
      { key: "date", header: "Date" },
      { key: "resortName", header: "Resort" },
      { key: "foodBillCollection", header: "Food Collection" },
      { key: "expenseAmount", header: "Expense" },
      { key: "profit", header: "Profit" },
      { key: "paymentAccountName", header: "Paid From" },
    ]
  );
};

const totalProfit = totalFoodCollection - totalExpense;

    return (
    <div className="finance-wrapper">

      <h2 className="page-title" style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-dark)", textAlign: "left", margin: "12px 0 18px", paddingLeft: "10px", borderLeft: "4px solid var(--primary-teal)" }}>
  {isAdminView
    ? "Food Collection & Expenses"
    : "Resort Daily Finance"}
</h2>
      <div className="filters">

        <div className="filter-item">
          <label>Resort</label>

          <Select
            classNamePrefix="react-select"
            options={resorts}
            value={selectedResort}
            onChange={setSelectedResort}
            placeholder="Select Resort"
            isDisabled={
              isSingleResortRole &&
              resorts.length === 1
            }
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            styles={themedSelectStyles()}
          />
        </div>

        <div className="filter-item">
          <label>Date</label>

          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="dd/MM/yyyy"
            className="custom-datepicker"
          />
        </div>

      </div>
      {/* Tabs */}



      {/* Form */}

{/* Finance Entry */}

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

    <div className="finance-input">

      <label>Paid From</label>

      <Select
        classNamePrefix="react-select"
        options={paymentAccounts}
        value={selectedPaymentAccount}
        onChange={setSelectedPaymentAccount}
        placeholder="Select account..."
        isClearable
        menuPortalTarget={menuPortalTarget}
        menuPosition={menuPosition}
        styles={themedSelectStyles()}
      />

    </div>

    <div className="finance-button">

<button
    className="save-btn"
    onClick={handleSave}
    disabled={saving}
>
    {saving ? "Saving..." : "Save"}
</button>

    </div>

  </div>

</div>

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
    dateFormat="dd/MM/yyyy"
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
    dateFormat="dd/MM/yyyy"
    className="custom-datepicker"
/>

        </div>
<div className="filter-item">
          <label>Resort</label>

          <Select
            classNamePrefix="react-select"
            options={resorts}
            value={selectedResort}
            onChange={setSelectedResort}
            placeholder="Select Resort"
            isDisabled={
              isSingleResortRole &&
              resorts.length === 1
            }
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPosition}
            styles={themedSelectStyles()}
          />
        </div>
        {user?.role === "SUPER_ADMIN" && (
          <div className="filter-item">
            <button type="button" className="export-csv-btn" onClick={exportFinanceEntries}>
              Export CSV
            </button>
          </div>
        )}
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
{isAdminView && (
        <th>Profit</th>
    )}
              <th>Paid From</th>
            </tr>

          </thead>

          <tbody>

            {loading ? (

              <tr>

                <td
                  colSpan={isAdminView ? 6 : 5}
                  style={{textAlign:"center"}}
                >
                  Loading...
                </td>

              </tr>

            ) : financeEntries.length===0 ? (

              <tr>

                <td
                  colSpan={isAdminView ? 6 : 5}
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
                  {isAdminView && (
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
                  <td>{entry.paymentAccountName || "-"}</td>
                </tr>

              ))

            )}

          </tbody>
<tfoot>

<tr>

<td colSpan="2"><strong>Total</strong></td>

<td><strong>₹{totalFoodCollection.toLocaleString()}</strong></td>

<td><strong>₹{totalExpense.toLocaleString()}</strong></td>

{isAdminView && (
    <td><strong>₹{totalProfit.toLocaleString()}</strong></td>
)}
<td></td>
</tr>

</tfoot>
        </table>

      </div>

    </div>

  );

};

export default ResortDailyFinance;