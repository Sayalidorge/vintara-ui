// src/components/ManageResorts.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select"; 
import config from "../config";
import "../css/theme.css";
import "./ManageResorts.css";

const ManageResorts = () => {
  const [resorts, setResorts] = useState([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [googleMapLink, setGoogleMapLink] = useState("");
  const [propertyManager, setPropertyManager] = useState("");
  const [managerContact, setManagerContact] = useState("");
  const [roomCategories, setRoomCategories] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(true);

  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState("");
  const [managers, setManagers] = useState([]);
  const [contactError, setContactError] = useState("");
  const [commissionModel, setCommissionModel] = useState("");
  const [commissionPercentage, setCommissionPercentage] = useState("");
const STANDARD_CATEGORIES = [
  { label: "Standard Room", value: "Standard Room", prefix: "ST" },
  { label: "Deluxe Suite", value: "Deluxe Suite", prefix: "DX" },
  { label: "Executive Club", value: "Executive Club", prefix: "EX" },
  { label: "Luxury Villa", value: "Luxury Villa", prefix: "VL" },
  { label: "Presidential Suite", value: "Presidential Suite", prefix: "PR" },
  { label: "Other / Custom...", value: "CUSTOM", prefix: "" }
];

  // Fetch managers
  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/users/property-managers`, {
          headers: config.getHeaders(),
        });
        const data = await res.json();
        setManagers(data);
      } catch (err) {
        console.error("Failed to fetch property managers", err);
      }
    };
    fetchManagers();
  }, []);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/locations`, {
          headers: config.getHeaders(),
        });
        const data = await res.json();
        setLocations(data);

        if (editId && resorts.length > 0) {
          const resortToEdit = resorts.find((r) => r.id === editId);
          if (resortToEdit && !data.find((loc) => loc.name === resortToEdit.location)) {
            data.push({ id: 0, name: resortToEdit.location });
            setLocations([...data]);
          }
          setLocation(resortToEdit.location);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchLocations();
  }, [editId, resorts]);

  // Fetch resorts
  const fetchResorts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${config.BASE_URL}/api/resorts`, {
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch resorts");
      const data = await res.json();

      const normalized = data.map((r) => ({
        ...r,
        roomCategories: r.categories || [],
        propertyManagerName: r.propertyManager?.name || "-",
        propertyManagerId: r.propertyManager?.userId || "",
        managerContact: r.managerContact || "-",
      }));

      setResorts(normalized);
    } catch (err) {
      console.error(err);
      alert("Error fetching resorts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResorts();
  }, []);

  // Map choices for React-Select format
  const locationOptions = locations.map((loc) => ({
    value: loc.name,
    label: loc.name,
  }));

  const managerOptions = managers.map((m) => ({
    value: m.userId,
    label: `${m.name} (${m.userId})`,
  }));

  const COMMISSION_MODELS = [
  {
    value: "GROWTH_RENTED",
    label: "Growth Model - Rented",
  },
  {
    value: "GROWTH_REVENUE",
    label: "Growth Model - Revenue",
  },
  {
    value: "GROWTH_MARKETING",
    label: "Growth Model - Marketing",
  },
  {
    value: "STANDARD_RENTED",
    label: "Standard Commission Model - Rented",
  },
  {
    value: "STANDARD_MARKETING",
    label: "Standard Commission Model - Marketing",
  },
];

const COMMISSION_PERCENTAGES = [
  { value: 5, label: "5%" },
  { value: 10, label: "10%" },
  { value: 15, label: "15%" },
  { value: 20, label: "20%" },
];
  // Room category handlers
  const addRoomCategoryRow = () =>
    setRoomCategories([...roomCategories, { name: "", roomPrefix: "", totalRooms: 0, startNumber: 1 }]);

  const removeRoomCategoryRow = (index) => {
    const updated = [...roomCategories];
    updated.splice(index, 1);
    setRoomCategories(updated);
  };

  const handleRoomCategoryChange = (index, field, value) => {
    const updated = [...roomCategories];
    updated[index][field] = value;
    setRoomCategories(updated);
  };

  // Add/Edit resort
  const handleAddOrEdit = async (e) => {
    e.preventDefault();
    if (!name || !location) return alert("Please fill resort name and location");

 const payload = {
  name,
  location,
  googleMapLink,
  propertyManager,
  managerContact,
  active,
  commissionModel,
  commissionPercentage,
  // Clean, lean payload mapping to your updated backend structure
  roomCategories: roomCategories.map((cat) => ({
    name: cat.name,
    roomPrefix: cat.roomPrefix,
    totalRooms: cat.totalRooms
  })),
};

    try {
      let res;
      if (editId) {
        res = await fetch(`${config.BASE_URL}/api/resorts/${editId}`, {
          method: "PUT",
          headers: {
            ...config.getHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${config.BASE_URL}/api/resorts`, {
          method: "POST",
          headers: {
            ...config.getHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error("Failed to save resort");

    setName("");
    setLocation("");
    setGoogleMapLink("");
    setPropertyManager("");
    setManagerContact("");
    setCommissionModel("");
    setCommissionPercentage("");
    setRoomCategories([]);
    setEditId(null);

    fetchResorts();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // Edit resort
  const handleEdit = (resort) => {
    setEditId(resort.id);
    setName(resort.name);
    setLocation(resort.location || "");
    setGoogleMapLink(resort.googleMapLink || "");
    setPropertyManager(resort.propertyManagerId || "");
    setManagerContact(resort.managerContact || "");
    setCommissionModel(resort.commissionModel || "");
    setCommissionPercentage(resort.commissionPercentage || "");
    setRoomCategories(
      resort.roomCategories?.map((c) => ({
        name: c.name,
        roomPrefix: c.roomPrefix,
        totalRooms: c.totalRooms,
        startNumber: c.startNumber || 1,
      })) || []
    );
  };

  // Delete resort
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this resort?")) return;
    try {
      const res = await fetch(`${config.BASE_URL}/api/resorts/${id}`, {
        method: "DELETE",
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete resort");
      fetchResorts();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const customSelectStyles = {
    control: (base) => ({
      ...base,
      height: "38px",
      minHeight: "38px",
      borderRadius: "4px",
      border: "1px solid #ccc",
      boxShadow: "none",
      "&:hover": { border: "1px solid #999" }
    }),
    valueContainer: (base) => ({
      ...base,
      height: "38px",
      padding: "0 12px"
    }),
    input: (base) => ({
      ...base,
      margin: "0px"
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: "38px"
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 })
  };

  return (
    <div className="resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <div className="page-header" style={{ marginBottom: "20px" }}>
        <h2>Manage Resorts</h2>
      </div>    

      <div className="user-management-section" style={{ border: "1px solid #ccc", padding: "25px", borderRadius: "6px", marginBottom: "30px", background: "#fff", boxSizing: "border-box" }}>
        <h3 style={{ marginTop: 0, marginBottom: "20px", color: "#333" }}>
          {editId ? `Modify Resort Properties (ID: #${editId})` : "Create New Resort Listing"}
        </h3>
        
        <form className="resort-form" onSubmit={handleAddOrEdit}>
          
          {/* ROW 1 */}
          <div className="form-row" style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Resort Name *</label>
              <input 
                type="text" 
                placeholder="Enter resort name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                style={{ width: "100%", padding: "8px 12px", height: "38px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Google Map Link</label>
              <input 
                type="text" 
                placeholder="Paste maps link location URL" 
                value={googleMapLink} 
                onChange={(e) => setGoogleMapLink(e.target.value)} 
                style={{ width: "100%", padding: "8px 12px", height: "38px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
          </div>

          {/* ROW 2 */}
          <div className="form-row" style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Geographic Location *</label>
              <Select
                options={locationOptions}
                value={locationOptions.find(o => o.value === location) || null}
                onChange={(selected) => setLocation(selected ? selected.value : "")}
                placeholder="Select Existing Location..."
                menuPortalTarget={document.body}
                styles={customSelectStyles}
              />
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Or Create New Location</label>
              <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                <input
                  type="text"
                  placeholder="Type new location name"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  style={{ flex: 1, padding: "8px 12px", height: "38px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
                />
                <button 
                  type="button" 
                  style={{ height: "38px", padding: "0 18px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }} 
                  onClick={async () => {
                    if (!newLocation.trim()) return alert("Enter a location");
                    try {
                      const res = await fetch(`${config.BASE_URL}/api/locations`, {
                        method: "POST",
                        headers: { ...config.getHeaders(), "Content-Type": "application/json" },
                        body: JSON.stringify({ name: newLocation }),
                      });
                      if (!res.ok) throw new Error("Failed to add location");
                      const added = await res.json();
                      setLocations((prev) => [...prev, added]);
                      setLocation(added.name);
                      setNewLocation("");
                    } catch (err) {
                      console.error(err);
                      alert(err.message);
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* ROW 3 */}
          <div className="form-row" style={{ display: "flex", gap: "20px", marginBottom: "25px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Property Manager</label>
              <Select
                options={managerOptions}
                value={managerOptions.find(o => o.value === propertyManager) || null}
                onChange={(selected) => setPropertyManager(selected ? selected.value : "")}
                placeholder="Select Property Manager..."
                menuPortalTarget={document.body}
                styles={customSelectStyles}
                isClearable
              />
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Manager Contact Number</label>
              <input
                type="text"
                placeholder="10 digit phone number"
                value={managerContact}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ""); 
                  if (val.length <= 10) {
                    setManagerContact(val);
                  }
                  if (val.length > 0 && val.length < 10) {
                    setContactError("Contact number must be 10 digits");
                  } else {
                    setContactError("");
                  }
                }}
                style={{ width: "100%", padding: "8px 12px", height: "38px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
              />
              {contactError && <span style={{ color: "red", fontSize: "12px", marginTop: "2px" }}>{contactError}</span>}
            </div>
          </div>
{/* ROW 4 - Commission */}
<div
  className="form-row"
  style={{
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
  }}
>
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    }}
  >
    <label
      style={{
        fontWeight: "600",
        fontSize: "14px",
        color: "#555",
      }}
    >
      Commission Model
    </label>

    <Select
      options={COMMISSION_MODELS}
      value={
        COMMISSION_MODELS.find(
          (o) => o.value === commissionModel
        ) || null
      }
      onChange={(selected) =>
        setCommissionModel(selected?.value || "")
      }
      placeholder="Select Commission Model"
      styles={customSelectStyles}
      menuPortalTarget={document.body}
    />
  </div>

  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    }}
  >
    <label
      style={{
        fontWeight: "600",
        fontSize: "14px",
        color: "#555",
      }}
    >
      Commission Percentage
    </label>

    <Select
      options={COMMISSION_PERCENTAGES}
      value={
        COMMISSION_PERCENTAGES.find(
          (o) => o.value === commissionPercentage
        ) || null
      }
      onChange={(selected) =>
        setCommissionPercentage(selected?.value || "")
      }
      placeholder="Select Percentage"
      styles={customSelectStyles}
      menuPortalTarget={document.body}
    />
  </div>
</div>
          {/* FIXED ROOM CATEGORIES SECTION */}
          <div className="room-categories-section" style={{ background: "#f9f9f9", padding: "20px", borderRadius: "6px", border: "1px solid #e0e0e0", marginBottom: "25px", boxSizing: "border-box", width: "100%" }}>
            <h4 style={{ margin: "0 0 15px 0", color: "#444", fontSize: "15px" }}>Room Categories Structure Matrix</h4>
            
{roomCategories.map((cat, idx) => {
  // Check if they are using a custom manual override entry
  const isCustom = cat.isCustom || false;

  return (
    <div key={idx} className="room-category-row" style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
      
      {/* CATEGORY SELECT DROPDOWN */}
      {!isCustom ? (
        <select
          value={cat.name}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "CUSTOM") {
              handleRoomCategoryChange(idx, "isCustom", true);
              handleRoomCategoryChange(idx, "name", "");
            } else {
              const matched = STANDARD_CATEGORIES.find(c => c.value === val);
              handleRoomCategoryChange(idx, "name", val);
              handleRoomCategoryChange(idx, "roomPrefix", matched ? matched.prefix : "");
            }
          }}
          className="room-category-field--wide"
          style={{ padding: "8px 12px", height: "36px", borderRadius: "4px", border: "1px solid #ccc" }}
        >
          <option value="">Select Room Category...</option>
          {STANDARD_CATEGORIES.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        /* FALLBACK TEXT BOX FOR CUSTOM ENTRIES */
        <input
          type="text"
          placeholder="Type Custom Category Name..."
          value={cat.name}
          onChange={(e) => handleRoomCategoryChange(idx, "name", e.target.value)}
          required
          className="room-category-field--wide"
          style={{ padding: "8px 12px", height: "36px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
        />
      )}

      {/* PREFIX INPUT (Auto-populated but editable) */}
      <input
        type="text"
        placeholder="Prefix"
        value={cat.roomPrefix}
        onChange={(e) => handleRoomCategoryChange(idx, "roomPrefix", e.target.value.toUpperCase())}
        required
        className="room-category-field--narrow"
        style={{ padding: "8px 12px", height: "36px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
      />

      {/* TOTAL ROOMS */}
      <input
        type="number"
        min="1"
        placeholder="Rooms"
        value={cat.totalRooms || ""}
        onChange={(e) => handleRoomCategoryChange(idx, "totalRooms", parseInt(e.target.value) || 0)}
        required
        className="room-category-field--narrow"
        style={{ padding: "8px 12px", height: "36px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
      />

      <button 
        type="button" 
        onClick={() => removeRoomCategoryRow(idx)}
        style={{ height: "36px", padding: "0 15px", backgroundColor: "Var(--primary-teal)", border: "1px solid Var(--primary-teal)", color: "white", borderRadius: "4px" }}
      >
        Remove
      </button>
    </div>
  );
})}
            
            <button 
              type="button" 
              onClick={addRoomCategoryRow}
              style={{ padding: "8px 15px", cursor: "pointer", backgroundColor: "transparent", color: "var(--primary-purple)", border: "1px dashed var(--primary-purple)", borderRadius: "4px", fontWeight: "bold", marginTop: "5px" }}
            >
              + Add Room Category
            </button>
          </div>

          {/* FIXED SUBMIT & CANCEL BUTTON SIZES */}
          <div className="button-group" style={{ display: "flex", gap: "12px", justifyContent: "flex-start" }}>
            <button 
              type="submit"
              style={{ padding: "0 24px", height: "40px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", fontSize: "14px", display: "inline-block", width: "auto" }}
            >
              {editId ? "Update Resort Entry" : "Save Resort Profile"}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setEditId(null); setName(""); setLocation(""); setGoogleMapLink(""); setPropertyManager(""); setManagerContact(""); setCommissionModel("");setCommissionPercentage("");setRoomCategories([]);
              }}
              style={{ padding: "0 24px", height: "40px", cursor: "pointer", backgroundColor: "var(--primary-teal)", border: "1px solid #ccc", borderRadius: "4px", color: "#ffffff", fontSize: "14px", display: "inline-block", width: "auto" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Resorts Table */}
      <h3>Configured Resort Properties Registry</h3>
      {loading ? <p>Loading resorts...</p> : (
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="resorts-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f2f2f2", textAlign: "left" }}>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Name</th>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Location</th>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Property Manager</th>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Manager Contact</th>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Google Map Link</th>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Room Categories</th>
                <th>Commission Model</th>
              <th>Commission %</th>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Status</th>
                <th style={{ padding: "12px 10px", borderBottom: "2px solid #ddd" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resorts.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>No resorts available</td></tr>
              ) : (
                resorts.map((resort) => (
                  <tr key={resort.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px" }}>{resort.name}</td>
                    <td style={{ padding: "10px" }}>{resort.location}</td>
                    <td style={{ padding: "10px" }}>{resort.propertyManagerName}</td>
                    <td style={{ padding: "10px" }}>{resort.managerContact}</td>
                    <td style={{ padding: "10px" }}>{resort.googleMapLink || "-"}</td>
                    <td style={{ padding: "10px", fontSize: "13px", maxWidth: "250px" }}>
                      {resort.roomCategories?.length > 0
                        ? resort.roomCategories.map(c => `${c.name} (${c.totalRooms}) [${c.rooms?.map(r => r.roomNumber).join(", ")}]`).join("; ")
                        : "-"}
                    </td>
                    <td>{resort.commissionModel || "-"}</td>

<td>
  {resort.commissionPercentage
    ? `${resort.commissionPercentage}%`
    : "-"}
</td>
                    <td style={{ padding: "10px" }}>
                      <select
                        value={resort.active ? "ACTIVE" : "INACTIVE"}
                        className={`status-dropdown ${resort.active ? "active-status" : "inactive-status"}`}
                        onChange={async (e) => {
                          const newStatus = e.target.value === "ACTIVE";
                          try {
                            const res = await fetch(
                              `${config.BASE_URL}/api/resorts/${resort.id}/status?active=${newStatus}`,
                              {
                                method: "PUT",
                                headers: config.getHeaders(),
                              }
                            );
                            if (!res.ok) throw new Error("Failed to update status");

                            setResorts((prev) =>
                              prev.map((r) =>
                                r.id === resort.id ? { ...r, active: newStatus } : r
                              )
                            );
                          } catch (err) {
                            console.error(err);
                            alert("Failed to update status");
                          }
                        }}
                        style={{ padding: "4px", borderRadius: "4px" }}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </td>
                    
                    <td className="actions" style={{ padding: "10px", whiteSpace: "nowrap" }}>
                      <button 
                        className="edit-btn" 
                        onClick={() => handleEdit(resort)}
                        style={{ marginRight: "8px", padding: "6px 14px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
                      >
                        Edit
                      </button>
                      <button 
                        className="delete-btn" 
                        onClick={() => handleDelete(resort.id)}
                        style={{ padding: "6px 14px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
                      >
                        Delete
                      </button>
                    </td>
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

export default ManageResorts;