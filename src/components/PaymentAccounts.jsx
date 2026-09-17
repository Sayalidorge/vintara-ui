// src/components/PaymentAccounts.jsx
import React, { useState, useEffect } from "react";
import Select from "react-select";
import config from "../config";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";
import "../css/theme.css";
import "../css/components.css";
import "./ManageResorts.css";
import "./PaymentAccounts.css";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

// Brand-only tint (teal/gray, no green), matching ManageResorts.jsx's own
// per-row status Select.
const statusSelectStyles = (isActive) => {
  const tone = isActive
    ? { bg: "var(--color-success-bg)", text: "var(--color-success-text)" }
    : { bg: "var(--color-warning-bg)", text: "var(--color-warning-text)" };
  return themedSelectStyles({
    control: (base) => ({
      ...base,
      minHeight: "32px",
      height: "32px",
      backgroundColor: tone.bg,
      borderColor: tone.bg,
      boxShadow: "none",
    }),
    valueContainer: (base) => ({ ...base, height: "32px", padding: "0 8px" }),
    indicatorsContainer: (base) => ({ ...base, height: "32px" }),
    singleValue: (base) => ({ ...base, color: tone.text, fontWeight: 600 }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
  });
};

// Always rendered embedded now (as a tab inside ManageResorts.jsx - see
// App.js/menuConfig.js for why there's no standalone route/page anymore).
// viewOnly hides the add/edit form and the Edit/Status controls - the real
// enforcement is server-side (PaymentAccountController only allows
// SUPER_ADMIN to POST/PUT), this is just matching UX to that.
const PaymentAccounts = ({ viewOnly = false }) => {
  const { toasts, showToast, dismissToast } = useToast();
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
      showToast("Error fetching payment accounts", "danger");
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
    if (!name.trim()) return showToast("Please enter an account name", "warning");

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
      showToast(err.message, "danger");
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
      showToast(err.message, "danger");
    }
  };

  return (
    <div className="resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {!viewOnly && (
        <div className="resort-form-card">
          <h3>{editId ? `Edit Payment Account #${editId}` : "Add Payment Account"}</h3>

          <form onSubmit={handleSubmit}>
            <div className="payment-account-form-row">
              <div className="form-field">
                <label>Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g. CASH, VINTARA, or a stakeholder's name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="payment-account-checkbox-field">
                <label>Company Account?</label>
                <label className="payment-account-checkbox-label">
                  <input
                    type="checkbox"
                    checked={companyAccount}
                    onChange={(e) => setCompanyAccount(e.target.checked)}
                  />
                  Yes, GST applies to money collected here
                </label>
              </div>

              <div className="button-group">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="vt-btn vt-btn-primary"
                >
                  {isSubmitting ? "Saving..." : editId ? "Update Account" : "Add Account"}
                </button>
                {editId && (
                  <button
                    type="button"
                    onClick={() => { setEditId(null); setName(""); setCompanyAccount(false); }}
                    className="vt-btn vt-btn-purple"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      <h3>Payment Accounts ({accounts.length})</h3>
      {loading ? <p>Loading payment accounts...</p> : (
        <div className="table-wrapper">
          <table className="resorts-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Company Account</th>
                {!viewOnly && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr><td colSpan={viewOnly ? 3 : 4} style={{ textAlign: "center", padding: "20px" }}>No payment accounts configured</td></tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>
                      {viewOnly ? (
                        <span className={`vt-badge ${account.active ? "vt-badge-success" : "vt-badge-warning"}`}>
                          {account.active ? "Active" : "Inactive"}
                        </span>
                      ) : (
                        <Select
                          options={STATUS_OPTIONS}
                          value={STATUS_OPTIONS.find((o) => o.value === (account.active ? "ACTIVE" : "INACTIVE"))}
                          onChange={() => handleToggleActive(account)}
                          isSearchable={false}
                          classNamePrefix="react-select"
                          className="react-select-container status-select"
                          menuPortalTarget={menuPortalTarget}
                          menuPosition={menuPosition}
                          styles={statusSelectStyles(account.active)}
                        />
                      )}
                    </td>
                    <td>{account.companyAccount ? "Yes" : "No"}</td>
                    {!viewOnly && (
                      <td className="actions">
                        <button
                          className="vt-btn vt-btn-primary"
                          onClick={() => handleEdit(account)}
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
