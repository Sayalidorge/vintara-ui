// src/components/ManageUsers.jsx
import React, { useState, useEffect } from "react";
import "../css/theme.css";
import "./ManageUsers.css";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import config from "../config";

const ManageUsers = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [resorts, setResorts] = useState([]);
  const [roles, setRoles] = useState([]);

  // Form state
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [assignedResorts, setAssignedResorts] = useState([]);
  const [contactNo, setContactNo] = useState("");
  const [contactAlert, setContactAlert] = useState("");

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

  const resetForm = () => {
    setEditId(null);
    setName("");
    setEmail("");
    setContactNo("");
    setRole("");
    setAssignedResorts([]);
    setContactAlert("");
  };

  // Handle add or edit user
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        const body = {
          name,
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
        <h2>Admin Management Panel</h2>
      </div>

      {/* USER PROVISION FORM */}
      <div className="user-management-section" style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "6px", marginBottom: "30px" }}>
        <h3>{editId ? `Modify User Profile (ID: #${editId})` : "Create System User Account"}</h3>
        <form className="user-form" onSubmit={handleSubmit}>
          <div className="form-row" style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
            <div style={{ flex: 1 }}>
              <label>Full Name</label>
              <input
                type="text"
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
                disabled={editId !== null}
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

          <div className="form-row" style={{ display: "flex", gap: "15px", marginBottom: "20px", alignItems: "flex-end" }}>
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
            <div style={{ flex: 2 }}>
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

          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              type="submit" 
              style={{ padding: "8px 20px", cursor: "pointer", fontWeight: "bold", background: "var(--primary-purple)", color: "#fff", border: "none", borderRadius: "4px" }}
            >
              {editId ? "Save Account Updates" : "Provision New User"}
            </button>
            {editId && (
              <button 
                type="button" 
                onClick={resetForm} 
                style={{ padding: "8px 20px", cursor: "pointer", background: "#fff", border: "1px solid #ccc", borderRadius: "4px" }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* USERS DATA TABLE */}
      <h3>Configured Properties Access Matrix Pool</h3>
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
            {users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px" }}>{user.name}</td>
                  <td style={{ padding: "10px" }}>{user.email}</td>
                  <td style={{ padding: "10px" }}>{user.contactNumber || "-"}</td>
                  <td style={{ padding: "10px" }}><strong style={{ color: "#333" }}>{user.role}</strong></td>
                  <td style={{ padding: "10px" }}>{user.resortNames?.length ? user.resortNames.join(", ") : "None Assigned"}</td>
                  <td style={{ padding: "10px" }}>
                    <button 
                      onClick={() => handleEdit(user)} 
                      style={{ marginRight: "8px", padding: "6px 14px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(user.id)} 
                      style={{ padding: "6px 14px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>No active user provision registry records tracked in database.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageUsers;