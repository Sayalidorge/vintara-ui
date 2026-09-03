// src/components/ManageUsers.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import "../css/theme.css";
import "./ManageUsers.css";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import config from "../config";

// Roles a SUPER_USER isn't allowed to assign or edit (mirrors the backend
// guard in UserService.assertCanAssignRole) - kept in sync manually since
// there's no shared source of truth between the two apps.
const PROTECTED_ROLES = ["SUPER_ADMIN", "ADMIN", "SUPER_USER"];

const ManageUsers = () => {
  const navigate = useNavigate();
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [assignedResorts, setAssignedResorts] = useState([]);
  const [contactNo, setContactNo] = useState("");
  const [contactAlert, setContactAlert] = useState("");

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
    setShowForm(false);
  };

  // Handle add or edit user
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        const body = {
          name,
          email,
          contactNumber: contactNo,
          role,
          resortIds: assignedResorts.map((r) => r.value),
        };
        await fetch(`${config.BASE_URL}/users/${editId}/update`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
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
        await fetch(`${config.BASE_URL}/users/create`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
      }
      await fetchUsers(); 
      resetForm();
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("Something went wrong. Check console.");
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

    if (user.resortNames) {
      const selected = resortOptions.filter((r) =>
        user.resortNames.includes(r.label)
      );
      setAssignedResorts(selected);
    } else {
      setAssignedResorts([]);
    }

    setShowForm(true);
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    nameInputRef.current?.focus();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
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
    <div className="admin-manage-container" style={{ padding: "0px 20px 20px 20px" }}>
      <div className="page-header">
        <h2 style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary-purple)", textAlign: "left", letterSpacing: "0.4px", marginTop: "6px", marginBottom: "18px" }}>Admin Management Panel</h2>
      </div>

      {!showForm && (
        <div style={{ marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            style={{ padding: "10px 20px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", fontSize: "14px" }}
          >
            + Create User
          </button>
        </div>
      )}

      {/* USER PROVISION FORM */}
      {showForm && (
      <div className="user-management-section" ref={formSectionRef} style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "6px", marginBottom: "30px" }}>
        <h3>{editId ? `Modify User Profile (ID: #${editId})` : "Create System User Account"}</h3>
        <form className="user-form" onSubmit={handleSubmit}>
          <div className="form-row" style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
            <div style={{ flex: 1 }}>
              <label>Full Name</label>
              <input
                type="text"
                ref={nameInputRef}
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
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
                style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
              />
              {contactAlert && <div style={{ color: "red", fontSize: "11px", marginTop: "2px" }}>{contactAlert}</div>}
            </div>
          </div>

          <div className="form-row role-property-row" style={{ display: "flex", gap: "15px", marginBottom: "20px", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <label>Assigned Authorization Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                style={{ width: "100%", padding: "6px", height: "38px" }}
              >
                <option value="" disabled>Select Role...</option>
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Permitted Property Access</label>
              <Select
                isMulti
                options={resortOptions}
                value={assignedResorts}
                onChange={setAssignedResorts}
                placeholder="Select Resort Profiles..."
                className="basic-multi-select"
                classNamePrefix="select"
                menuPortalTarget={document.body}
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 9999 })
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
            <button
              type="submit"
              style={{ padding: "8px 20px", cursor: "pointer", fontWeight: "bold", background: "var(--primary-purple)", color: "#fff", border: "none", borderRadius: "4px" }}
            >
              {editId ? "Save Account Updates" : "Create User"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{ padding: "8px 20px", cursor: "pointer", background: "#fff", border: "1px solid #ccc", borderRadius: "4px" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      )}

      {/* USERS DATA TABLE */}
      <h3>Configured Properties Access Matrix Pool</h3>

      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "15px" }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: "7px 10px", minWidth: "160px", flex: "0 1 200px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box" }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ padding: "7px 10px", height: "34px", border: "1px solid #ccc", borderRadius: "4px" }}
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={resortFilter}
          onChange={(e) => setResortFilter(e.target.value)}
          style={{ padding: "7px 10px", height: "34px", border: "1px solid #ccc", borderRadius: "4px" }}
        >
          <option value="">All Resorts</option>
          {resorts.map((r) => (
            <option key={r.id} value={r.name}>{r.name}</option>
          ))}
        </select>
        <span style={{ fontSize: "13px", color: "#666" }}>
          Showing {filteredUsers.length} of {users.length} users
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            style={{ padding: "7px 14px", background: "#fff", color: "#555", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer" }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="users-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f2f2f2", textAlign: "left" }}>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Name</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Email</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Contact Number</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Role</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Assigned Resorts</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Actions Control</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px" }}>{user.name}</td>
                  <td style={{ padding: "10px" }}>{user.email}</td>
                  <td style={{ padding: "10px" }}>{user.contactNumber || "-"}</td>
                  <td style={{ padding: "10px" }}><strong style={{ color: "#333" }}>{user.role}</strong></td>
                  <td style={{ padding: "10px" }}>{user.resortNames?.length ? user.resortNames.join(", ") : "None Assigned"}</td>
                  <td style={{ padding: "10px" }}>
                    {(() => {
                      const restricted = isSuperUser && PROTECTED_ROLES.includes(user.role);
                      return (
                        <>
                          <button
                            onClick={() => handleEdit(user)}
                            disabled={restricted}
                            title={restricted ? "You do not have permission to edit this account" : undefined}
                            style={{ marginRight: "8px", padding: "6px 14px", cursor: restricted ? "not-allowed" : "pointer", backgroundColor: restricted ? "#ccc" : "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={restricted}
                            title={restricted ? "You do not have permission to delete this account" : undefined}
                            style={{ padding: "6px 14px", cursor: restricted ? "not-allowed" : "pointer", backgroundColor: restricted ? "#ccc" : "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
                          >
                            Delete
                          </button>
                        </>
                      );
                    })()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                  {users.length === 0
                    ? "No active user provision registry records tracked in database."
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