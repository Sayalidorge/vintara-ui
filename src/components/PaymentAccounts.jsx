// src/components/PaymentAccounts.jsx
import React, { useState, useEffect } from "react";
import config from "../config";

// Always rendered embedded now (as a tab inside ManageResorts.jsx - see
// App.js/menuConfig.js for why there's no standalone route/page anymore).
// viewOnly hides the add/edit form and the Edit/Status controls - the real
// enforcement is server-side (PaymentAccountController only allows
// SUPER_ADMIN to POST/PUT), this is just matching UX to that.
const PaymentAccounts = ({ viewOnly = false }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);
  const [companyAccount, setCompanyAccount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${config.BASE_URL}/api/payment-accounts`, {
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch payment accounts");
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      console.error(err);
      alert("Error fetching payment accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim()) return alert("Please enter an account name");

    const payload = { name: name.trim(), active: true, companyAccount };

    setIsSubmitting(true);
    try {
      const url = editId
        ? `${config.BASE_URL}/api/payment-accounts/${editId}`
        : `${config.BASE_URL}/api/payment-accounts`;

      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: {
          ...config.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save payment account");

      setName("");
      setEditId(null);
      setCompanyAccount(false);
      fetchAccounts();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (account) => {
    setEditId(account.id);
    setName(account.name);
    setCompanyAccount(!!account.companyAccount);
  };

  const handleToggleActive = async (account) => {
    try {
      const res = await fetch(`${config.BASE_URL}/api/payment-accounts/${account.id}`, {
        method: "PUT",
        headers: {
          ...config.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: account.name, active: !account.active, companyAccount: account.companyAccount }),
      });
      if (!res.ok) throw new Error("Failed to update payment account");
      fetchAccounts();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      {!viewOnly && (
        <div className="user-management-section" style={{ border: "1px solid #ccc", padding: "25px", borderRadius: "6px", marginBottom: "30px", background: "#fff", boxSizing: "border-box" }}>
          <h3 style={{ marginTop: 0, marginBottom: "20px", color: "#333" }}>
            {editId ? `Edit Payment Account (ID: #${editId})` : "Add Payment Account"}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-row" style={{ display: "flex", gap: "20px", marginBottom: "20px", alignItems: "flex-end" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g. CASH, VINTARA, or a stakeholder's name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", height: "38px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Company Account?</label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", height: "38px", fontSize: "14px", color: "#333" }}>
                  <input
                    type="checkbox"
                    checked={companyAccount}
                    onChange={(e) => setCompanyAccount(e.target.checked)}
                  />
                  Yes, GST applies to money collected here
                </label>
              </div>

              <div className="button-group" style={{ display: "flex", gap: "12px" }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "0 24px", height: "40px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", fontSize: "14px" }}
                >
                  {isSubmitting ? "Saving..." : editId ? "Update Account" : "Add Account"}
                </button>
                {editId && (
                  <button
                    type="button"
                    onClick={() => { setEditId(null); setName(""); setCompanyAccount(false); }}
                    style={{ padding: "0 24px", height: "40px", cursor: "pointer", backgroundColor: "var(--primary-teal)", border: "1px solid #ccc", borderRadius: "4px", color: "#ffffff", fontSize: "14px" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      <h3>Configured Payment Accounts</h3>
      {loading ? <p>Loading payment accounts...</p> : (
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="resorts-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f2f2f2", textAlign: "left" }}>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Name</th>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Status</th>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Company Account</th>
                {!viewOnly && <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr><td colSpan={viewOnly ? 3 : 4} style={{ textAlign: "center", padding: "20px" }}>No payment accounts configured</td></tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px" }}>{account.name}</td>
                    <td style={{ padding: "10px" }}>
                      {viewOnly ? (
                        <span className={account.active ? "active-status" : "inactive-status"}>
                          {account.active ? "Active" : "Inactive"}
                        </span>
                      ) : (
                        <select
                          value={account.active ? "ACTIVE" : "INACTIVE"}
                          className={`status-dropdown ${account.active ? "active-status" : "inactive-status"}`}
                          onChange={() => handleToggleActive(account)}
                          style={{ padding: "4px", borderRadius: "4px" }}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      )}
                    </td>
                    <td style={{ padding: "10px" }}>{account.companyAccount ? "Yes" : "No"}</td>
                    {!viewOnly && (
                      <td className="actions" style={{ padding: "10px", whiteSpace: "nowrap" }}>
                        <button
                          className="edit-btn"
                          onClick={() => handleEdit(account)}
                          style={{ padding: "6px 14px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PaymentAccounts;
