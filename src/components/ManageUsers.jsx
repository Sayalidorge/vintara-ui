// src/components/ManageUsers.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import "../css/theme.css";
import "../css/components.css";
import "./ManageUsers.css";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import config from "../config";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";
import { useConfirm } from "./common/useConfirm";

// Roles a SUPER_USER isn't allowed to assign or edit (mirrors the backend
// guard in UserService.assertCanAssignRole) - kept in sync manually since
// there's no shared source of truth between the two apps.
const PROTECTED_ROLES = ["SUPER_ADMIN", "ADMIN", "SUPER_USER"];

const ManageUsers = () => {
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const formSectionRef = useRef(null);
  const nameInputRef = useRef(null);
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const isSuperUser = currentUser?.role === "SUPER_USER";

  const [users, setUsers] = useState([]);
  const [resorts, setResorts] = useState([]);
  const [roles, setRoles] = useState([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [assignedResorts, setAssignedResorts] = useState([]);
  const [contactNo, setContactNo] = useState("");
  const [contactAlert, setContactAlert] = useState("");
  const [loginId, setLoginId] = useState("");

  // Table search/filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [resortFilter, setResortFilter] = useState("");

  // Helper to get authorization headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    };
  };

  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${config.BASE_URL}/users`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  // Fetch roles supported by the backend Enum
  const fetchRoles = async () => {
    try {
      const res = await fetch(`${config.BASE_URL}/users/roles`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setRoles(data);
    } catch (err) {
      console.error("Error fetching roles:", err);
    }
  };

  // Fetch resorts from backend
  const fetchResorts = async () => {
    try {
      const res = await fetch(`${config.BASE_URL}/api/resorts/resort-names-drop-down`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setResorts(data);
    } catch (err) {
      console.error("Error fetching resorts:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchResorts();
    fetchRoles();
  }, []);

  const resortOptions = resorts.map((r) => ({
    value: r.id,
    label: r.name
  }));

  // Explicit height so the single-select Role control and the multi-select
  // Assigned Resorts control (which react-select otherwise sizes slightly
  // differently by default, even both empty) match exactly.
  const customSelectStyles = themedSelectStyles({
    control: (base, state) => ({
      ...base,
      minHeight: "38px",
      height: "38px",
      boxSizing: "border-box",
    }),
    valueContainer: (base) => ({
      ...base,
      height: "38px",
      padding: "0 12px",
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: "38px",
    }),
    input: (base) => ({ ...base, margin: "0px" }),
  });

  // Multi-select variant: lets the control grow past 38px to fit multiple
  // chips instead of clipping, while still starting at the same height as
  // the single-select control above.
  const multiSelectStyles = {
    ...customSelectStyles,
    control: (base, state) => ({
      ...customSelectStyles.control(base, state),
      height: "auto",
      minHeight: "38px",
    }),
    valueContainer: (base) => ({
      ...customSelectStyles.valueContainer(base),
      height: "auto",
      flexWrap: "wrap",
    }),
  };

  const roleOptions = roles.map((r) => ({ value: r, label: r }));
  const roleFilterOptions = [{ value: "", label: "All Roles" }, ...roleOptions];
  const resortFilterOptions = [
    { value: "", label: "All Resorts" },
    ...resorts.map((r) => ({ value: r.name, label: r.name })),
  ];

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !term
        || user.name?.toLowerCase().includes(term)
        || user.email?.toLowerCase().includes(term);
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesResort = !resortFilter || user.resortNames?.includes(resortFilter);
      return matchesSearch && matchesRole && matchesResort;
    });
  }, [users, searchTerm, roleFilter, resortFilter]);

  const hasActiveFilters = Boolean(searchTerm || roleFilter || resortFilter);

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("");
    setResortFilter("");
  };

  const resetForm = () => {
    setEditId(null);
    setName("");
    setEmail("");
    setContactNo("");
    setRole("");
    setAssignedResorts([]);
    setContactAlert("");
    setLoginId("");
    setShowForm(false);
  };

  // Extracts a readable message from a failed response - backend errors are
  // JSON ({"message": "..."}, since spring.web.error.include-message=always
  // is set) but fall back to raw text for any non-JSON error body.
  const extractErrorMessage = async (res, fallback) => {
    const text = await res.text().catch(() => null);
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text);
      return parsed.message || parsed.error || text;
    } catch {
      return text;
    }
  };

  // Handle add or edit user
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!role) {
      showToast("Please select a role.", "warning");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editId) {
        const body = {
          name,
          email,
          contactNumber: contactNo,
          role,
          resortIds: assignedResorts.map((r) => r.value),
          userId: loginId,
        };
        const res = await fetch(`${config.BASE_URL}/users/${editId}/update`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await extractErrorMessage(res, "Failed to update user."));
        }
      } else {
        const resortIds = assignedResorts.map((r) => r.value);
        const body = {
          name,
          email,
          contactNumber: contactNo,
          userId: email.split("@")[0],
          password: "welcome",
          role,
          resortIds,
        };
        const res = await fetch(`${config.BASE_URL}/users/create`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await extractErrorMessage(res, "Failed to create user."));
        }
      }
      await fetchUsers();
      resetForm();
    } catch (err) {
      console.error("Error submitting form:", err);
      showToast(err.message || "Something went wrong. Check console.", "danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (user) => {
    if (isSuperUser && PROTECTED_ROLES.includes(user.role)) return;

    setEditId(user.id);
    setName(user.name || "");
    setEmail(user.email || "");
    setRole(user.role || "");
    setContactNo(user.contactNumber || "");
    setContactAlert("");
    setLoginId(user.userId || "");

    if (user.resortNames) {
      const selected = resortOptions.filter((r) =>
        user.resortNames.includes(r.label)
      );
      setAssignedResorts(selected);
    } else {
      setAssignedResorts([]);
    }

    setShowForm(true);
  };

  // Scroll/focus the form once it's actually mounted, rather than right
  // after setShowForm(true) - that used to run before React had rendered
  // the (previously hidden) form section, so formSectionRef/nameInputRef
  // were both still null and the scroll/focus silently did nothing. Also
  // re-fires on editId changing so clicking Edit on a different user while
  // the form is already open still re-focuses it.
  useEffect(() => {
    if (!showForm) return;
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    nameInputRef.current?.focus();
  }, [showForm, editId]);

  const handleResetPassword = async (user) => {
    if (isSuperUser && PROTECTED_ROLES.includes(user.role)) return;
    const ok = await confirm(`Reset ${user.name}'s password to the default ("welcome")?`);
    if (!ok) return;

    try {
      const res = await fetch(`${config.BASE_URL}/users/${user.id}/reset-password`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || errBody?.message || "Failed to reset password");
      }
      showToast(`Password for ${user.name} has been reset to "welcome".`, "success");
    } catch (err) {
      console.error("Error resetting password:", err);
      showToast(err.message, "danger");
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: "Delete user?",
      message: "Are you sure you want to delete this user?",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) {
      try {
        await fetch(`${config.BASE_URL}/users/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        await fetchUsers();
      } catch (err) {
        console.error("Error deleting user:", err);
      }
    }
  };

  return (
    <div className="admin-manage-container">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {ConfirmDialogElement}

      <div className="vt-page-header">
        <h2>Users</h2>
      </div>

      {!showForm && (
        <div style={{ marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="vt-btn vt-btn-primary"
          >
            + Add User
          </button>
        </div>
      )}

      {/* USER PROVISION FORM */}
      {showForm && (
      <div className="user-form-card" ref={formSectionRef}>
        <h3>{editId ? `Edit User #${editId}` : "Add New User"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-field">
              <label>Full Name</label>
              <input
                type="text"
                ref={nameInputRef}
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {editId && (
              <div className="form-field">
                <label>Login ID</label>
                <input
                  type="text"
                  placeholder="Login ID"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                />
                <span className="field-hint">Used to log in - must be unique.</span>
              </div>
            )}
            <div className="form-field">
              <label>Contact Number</label>
              <input
                type="tel"
                placeholder="Contact No"
                value={contactNo || ""}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, "");
                  if (val.length > 10) val = val.slice(0, 10);
                  setContactNo(val);
                  if (val.length > 0 && val.length < 10) {
                    setContactAlert("Contact number should be 10 digits");
                  } else {
                    setContactAlert("");
                  }
                }}
              />
              {contactAlert && <span className="field-error">{contactAlert}</span>}
            </div>
          </div>

          <div className="form-row form-row--2col">
            <div className="form-field">
              <label>Role</label>
              <Select
                options={roleOptions}
                value={roleOptions.find((o) => o.value === role) || null}
                onChange={(selected) => setRole(selected ? selected.value : "")}
                placeholder="Select role..."
                isSearchable={false}
                classNamePrefix="react-select"
                className="react-select-container"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={customSelectStyles}
              />
            </div>
            <div className="form-field">
              <label>Assigned Resorts</label>
              <Select
                isMulti
                options={resortOptions}
                value={assignedResorts}
                onChange={setAssignedResorts}
                placeholder="Select resorts..."
                classNamePrefix="react-select"
                className="react-select-container resorts-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={multiSelectStyles}
              />
            </div>
          </div>

          <div className="button-group">
            <button
              type="submit"
              disabled={isSubmitting}
              className="vt-btn vt-btn-primary"
            >
              {isSubmitting ? "Saving..." : editId ? "Save Changes" : "Add User"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="vt-btn vt-btn-purple"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      )}

      {/* USERS DATA TABLE */}
      <h3>Users ({users.length})</h3>

      <div className="users-toolbar">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select
          options={roleFilterOptions}
          value={roleFilterOptions.find((o) => o.value === roleFilter)}
          onChange={(selected) => setRoleFilter(selected ? selected.value : "")}
          isSearchable={false}
          classNamePrefix="react-select"
          className="react-select-container filter-select"
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPosition}
          styles={themedSelectStyles()}
        />
        <Select
          options={resortFilterOptions}
          value={resortFilterOptions.find((o) => o.value === resortFilter)}
          onChange={(selected) => setResortFilter(selected ? selected.value : "")}
          isSearchable={false}
          classNamePrefix="react-select"
          className="react-select-container filter-select"
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPosition}
          styles={themedSelectStyles()}
        />
        <span className="result-count">
          Showing {filteredUsers.length} of {users.length} users
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="vt-btn vt-btn-purple"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Contact Number</th>
              <th>Role</th>
              <th>Assigned Resorts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.contactNumber || "-"}</td>
                  <td><strong>{user.role}</strong></td>
                  <td>{user.resortNames?.length ? user.resortNames.join(", ") : "None Assigned"}</td>
                  <td>
                    {(() => {
                      const restricted = isSuperUser && PROTECTED_ROLES.includes(user.role);
                      return (
                        <div className="row-actions">
                          <div className="row-actions-line">
                            <button
                              onClick={() => handleEdit(user)}
                              disabled={restricted}
                              title={restricted ? "You do not have permission to edit this account" : undefined}
                              className="vt-btn vt-btn-primary"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              disabled={restricted}
                              title={restricted ? "You do not have permission to delete this account" : undefined}
                              className="vt-btn vt-btn-danger"
                            >
                              Delete
                            </button>
                          </div>
                          <div className="row-actions-line">
                            <button
                              onClick={() => handleResetPassword(user)}
                              disabled={restricted}
                              title={restricted ? "You do not have permission to reset this account's password" : undefined}
                              className="vt-btn vt-btn-teal"
                            >
                              Reset Password
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
                  {users.length === 0
                    ? "No users found."
                    : "No users match your search/filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageUsers;
