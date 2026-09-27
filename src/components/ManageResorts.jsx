// src/components/ManageResorts.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import config from "../config";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import PaymentAccounts from "./PaymentAccounts";
import SimpleSelect from "./common/SimpleSelect";
import ToastContainer, { useToast } from "./common/Toast";
import { useConfirm } from "./common/useConfirm";
import { setResortGbpLocation } from "../services/ReviewService";
import "../css/theme.css";
import "../css/components.css";
import "./ManageResorts.css";

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "REMOVED", label: "Removed" },
];

const ROW_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "REMOVED", label: "Delete" },
];

// Per-row status Select's colors, brand-only (teal/purple/gray, no green/
// red) - reuses the same tokens as .active-status/.inactive-status/
// .removed-status below, just applied via react-select's `styles` prop
// instead of a className, since react-select ignores plain CSS
// background-color on its own control the way a native <select> would take
// it directly.
const statusSelectStyles = (status) => {
  const tone =
    status === "ACTIVE"
      ? { bg: "var(--color-success-bg)", text: "var(--color-success-text)" }
      : status === "REMOVED"
      ? { bg: "var(--color-danger-bg)", text: "var(--color-danger-text)" }
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

const ManageResorts = () => {
  // "RESORTS" (the existing page content) or "PAYMENT_ACCOUNTS" (folded in
  // here instead of its own sidebar item/route - see App.js/menuConfig.js).
  const [activeTab, setActiveTab] = useState("RESORTS");
  const [resorts, setResorts] = useState([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [googleMapLink, setGoogleMapLink] = useState("");
  const [propertyContact, setPropertyContact] = useState("");
  // Form-level GBP Location ID (SUPER_ADMIN only, optional) - separate from
  // editingGbpId/gbpLocationDraft below, which back the table's own inline
  // quick-edit column; both write through the same setResortGbpLocation call.
  const [gbpLocationId, setGbpLocationId] = useState("");
  const [roomCategories, setRoomCategories] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [showForm, setShowForm] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirm();

  // Google Business Profile location mapping - a per-row inline editor
  // rather than part of the main add/edit form, same as googlePlaceId/
  // ezeeHotelCode (also integration details, not business fields staff edit
  // often). editingGbpId tracks which row's editor is open.
  const [editingGbpId, setEditingGbpId] = useState(null);
  const [gbpLocationDraft, setGbpLocationDraft] = useState("");

  const saveGbpLocation = async (resort) => {
    try {
      await setResortGbpLocation(resort.id, gbpLocationDraft.trim());
      setResorts((prev) =>
        prev.map((r) => (r.id === resort.id ? { ...r, gbpLocationId: gbpLocationDraft.trim() || null } : r))
      );
      setEditingGbpId(null);
      showToast("GBP location updated", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to update GBP location", "danger");
    }
  };

  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  // Payment Accounts tab: SUPER_USER gets the same add/edit access as
  // SUPER_ADMIN here - only resort deletion below stays SUPER_ADMIN-only.
  const canManagePaymentAccounts = isSuperAdmin || currentUser?.role === "SUPER_USER";
  const formSectionRef = useRef(null);
  const nameInputRef = useRef(null);
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState("");
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [contactError, setContactError] = useState("");
  const [commissionModel, setCommissionModel] = useState("");
  const [commissionPercentage, setCommissionPercentage] = useState("");
  const [otherOtaCommissionPercentage, setOtherOtaCommissionPercentage] = useState("");
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  // Which of this resort's assigned accounts are eligible to collect its
  // advance - empty means "use the global VINTARA account". More than one
  // means staff pick which account at booking-creation time (see
  // BookingService.resolveAdvanceAccountForBooking on the backend).
  const [advanceAccountIds, setAdvanceAccountIds] = useState([]);
const STANDARD_CATEGORIES = [
  { label: "Standard Room", value: "Standard Room", prefix: "S" },
  { label: "Deluxe Room", value: "Deluxe Room", prefix: "D" },
  { label: "Family Room", value: "Family Room", prefix: "F" },
  { label: "Premium Room", value: "Premium Room", prefix: "P" },
  { label: "Private Villa", value: "Private Villa", prefix: "PV" },
  { label: "Deluxe Room + Balcony", value: "Deluxe Room + Balcony", prefix: "DB" },
  { label: "Standard Room + Balcony", value: "Standard Room + Balcony", prefix: "SB" },
  { label: "Villa Room", value: "Villa Room", prefix: "V" },
  { label: "3BHK Apartment", value: "3BHK Apartment", prefix: "3BHK" },
  { label: "Family Room + Balcony", value: "Family Room + Balcony", prefix: "FB" },
  { label: "Premium Room + Balcony", value: "Premium Room + Balcony", prefix: "PB" },
  { label: "Other / Custom...", value: "CUSTOM", prefix: "" }
];

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

  // Fetch payment accounts (for the per-resort assignment checkboxes)
  useEffect(() => {
    const fetchPaymentAccounts = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/payment-accounts`, {
          headers: config.getHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch payment accounts");
        const data = await res.json();
        setPaymentAccounts(data.filter((a) => a.active));
      } catch (err) {
        console.error(err);
      }
    };
    fetchPaymentAccounts();
  }, []);

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
        propertyContact: r.propertyContact || "",
      }));

      setResorts(normalized);
    } catch (err) {
      console.error(err);
      showToast("Error fetching resorts", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResorts();
  }, []);

  // Scroll/focus the form whenever it opens (Create or Edit) - the form is
  // conditionally rendered now, so the ref isn't attached until after the
  // showForm state change re-renders it, hence this runs as an effect
  // rather than inline in the click handlers.
  useEffect(() => {
    if (showForm) {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInputRef.current?.focus();
    }
  }, [showForm, editId]);

  // Map choices for React-Select format
  const locationOptions = locations.map((loc) => ({
    value: loc.name,
    label: loc.name,
  }));

  const paymentAccountOptions = paymentAccounts.map((account) => ({
    value: account.id,
    label: account.name,
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

const OTHER_OTA_COMMISSION_PERCENTAGES = [
  { value: 0, label: "0%" },
  { value: 5, label: "5%" },
  { value: 10, label: "10%" },
];

const getCommissionModelLabel = (value) =>
  COMMISSION_MODELS.find((m) => m.value === value)?.label || value;
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
    if (isSubmitting) return;
    if (!name || !location) return showToast("Please fill resort name and location", "warning");

    const categoryNames = roomCategories.map((c) => (c.name || "").trim().toLowerCase());
    const duplicateName = categoryNames.find((n, i) => n && categoryNames.indexOf(n) !== i);
    if (duplicateName) {
      return showToast(`Duplicate room category name "${duplicateName}". Each category must be unique.`, "warning");
    }

    const categoryPrefixes = roomCategories.map((c) => (c.roomPrefix || "").trim().toUpperCase());
    const duplicatePrefix = categoryPrefixes.find((p, i) => p && categoryPrefixes.indexOf(p) !== i);
    if (duplicatePrefix) {
      return showToast(`Duplicate room prefix "${duplicatePrefix}". Each category must have a unique prefix.`, "warning");
    }

 const payload = {
  name,
  location,
  googleMapLink,
  propertyContact,
  commissionModel,
  commissionPercentage,
  otherOtaCommissionPercentage,
  advanceAccountIds,
  // Clean, lean payload mapping to your updated backend structure
  roomCategories: roomCategories.map((cat) => ({
    id: cat.id || null,
    name: cat.name,
    roomPrefix: cat.roomPrefix,
    totalRooms: cat.totalRooms
  })),
};

    setIsSubmitting(true);
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
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to save resort");
      }

    const savedResort = await res.json();

    try {
      const paymentAccountsRes = await fetch(`${config.BASE_URL}/api/resorts/${savedResort.id}/payment-accounts`, {
        method: "PUT",
        headers: {
          ...config.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountIds: selectedAccountIds }),
      });
      if (!paymentAccountsRes.ok) {
        const errBody = await paymentAccountsRes.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to assign payment accounts");
      }
    } catch (err) {
      console.error("Failed to assign payment accounts", err);
      showToast(err.message || "Resort saved, but failed to update its payment accounts.", "warning");
    }

    // SUPER_ADMIN only - the field isn't even rendered for anyone else, so
    // gbpLocationId always sits at "" for them; skipping the call entirely
    // (rather than submitting that blank) avoids silently wiping an existing
    // mapping when a SUPER_USER saves a resort for an unrelated reason.
    if (isSuperAdmin) {
      try {
        await setResortGbpLocation(savedResort.id, gbpLocationId.trim());
      } catch (err) {
        console.error("Failed to update GBP location", err);
        showToast(err.message || "Resort saved, but failed to update its GBP location.", "warning");
      }
    }

    setName("");
    setLocation("");
    setGoogleMapLink("");
    setPropertyContact("");
    setGbpLocationId("");
    setCommissionModel("");
    setCommissionPercentage("");
    setOtherOtaCommissionPercentage("");
    setRoomCategories([]);
    setSelectedAccountIds([]);
    setAdvanceAccountIds([]);
    setEditId(null);
    setShowForm(false);

    fetchResorts();
    } catch (err) {
      console.error(err);
      showToast(err.message, "danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit resort
  const handleEdit = async (resort) => {
    setEditId(resort.id);
    setName(resort.name);
    setLocation(resort.location || "");
    setGoogleMapLink(resort.googleMapLink || "");
    setPropertyContact(resort.propertyContact || "");
    setGbpLocationId(resort.gbpLocationId || "");
    setCommissionModel(resort.commissionModel || "");
    setCommissionPercentage(resort.commissionPercentage || "");
    setOtherOtaCommissionPercentage(resort.otherOtaCommissionPercentage ?? "");
    setAdvanceAccountIds(resort.advanceAccountIds || []);
    setRoomCategories(
      resort.roomCategories?.map((c) => ({
        id: c.id || null,
        name: c.name,
        roomPrefix: c.roomPrefix,
        totalRooms: c.totalRooms,
        startNumber: c.startNumber || 1,
      })) || []
    );
    setShowForm(true);

    try {
      const res = await fetch(`${config.BASE_URL}/api/resorts/${resort.id}/payment-accounts`, {
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch assigned payment accounts");
      const data = await res.json();
      setSelectedAccountIds(data.map((a) => a.id));
    } catch (err) {
      console.error(err);
      setSelectedAccountIds([]);
    }
  };

  // customSelectStyles previously had no `option` styling at all, so it fell
  // back to react-select's default blue hover/selected colors - themedSelectStyles
  // (see src/utils/reactSelectTheme.js) supplies the app's purple theme for
  // that plus a themed, focus-aware control border in place of the old
  // static "&:hover" gray.
  const customSelectStyles = themedSelectStyles({
    control: (base, state) => ({
      ...base,
      height: "38px",
      minHeight: "38px",
      borderRadius: "4px",
      border: state.isFocused ? "1px solid var(--primary-purple)" : "1px solid #ccc",
      boxSizing: "border-box",
      "&:hover": { border: "1px solid var(--primary-purple)" },
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
      height: "38px",
      padding: "0 8px"
    }),
    container: (base) => ({
      ...base,
      boxSizing: "border-box",
      margin: 0
    }),
  });

  // Multi-select variant: lets the control grow to fit multiple chips instead of clipping at 38px
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

  const filteredResorts = resorts.filter((resort) => {
    if (statusFilter !== "ALL" && resort.status !== statusFilter) return false;

    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      resort.name?.toLowerCase().includes(q) ||
      resort.location?.toLowerCase().includes(q) ||
      String(resort.id).includes(q)
    );
  });

  const resetForm = () => {
    setEditId(null);
    setName("");
    setLocation("");
    setGoogleMapLink("");
    setPropertyContact("");
    setGbpLocationId("");
    setCommissionModel("");
    setCommissionPercentage("");
    setOtherOtaCommissionPercentage("");
    setRoomCategories([]);
    setSelectedAccountIds([]);
    setAdvanceAccountIds([]);
  };

  return (
    <div className="resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {ConfirmDialogElement}

      <div className="vt-page-header">
        <h2>Resorts</h2>
      </div>

      <div className="resorts-tabs">
        <button
          type="button"
          onClick={() => setActiveTab("RESORTS")}
          className={`resorts-tab-btn ${activeTab === "RESORTS" ? "resorts-tab-btn--active" : ""}`}
        >
          Resorts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("PAYMENT_ACCOUNTS")}
          className={`resorts-tab-btn ${activeTab === "PAYMENT_ACCOUNTS" ? "resorts-tab-btn--active" : ""}`}
        >
          Payment Accounts
        </button>
      </div>

      {activeTab === "PAYMENT_ACCOUNTS" && <PaymentAccounts viewOnly={!canManagePaymentAccounts} />}

      {activeTab === "RESORTS" && (
      <>
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
            + Add Resort
          </button>
        </div>
      )}

      {showForm && (
      <div className="resort-form-card" ref={formSectionRef}>
        <h3>
          {editId ? `Edit Resort #${editId}` : "Add New Resort"}
        </h3>

        <form onSubmit={handleAddOrEdit}>

          {/* ROW 1 */}
          <div className="form-row form-row--2col">
            <div className="form-field">
              <label>Resort Name *</label>
              <input
                type="text"
                ref={nameInputRef}
                placeholder="Enter resort name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Contact Number</label>
              <input
                type="text"
                placeholder="10 digit phone number"
                value={propertyContact}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val.length <= 10) {
                    setPropertyContact(val);
                  }
                  if (val.length > 0 && val.length < 10) {
                    setContactError("Contact number must be 10 digits");
                  } else {
                    setContactError("");
                  }
                }}
              />
              {contactError && <span className="field-error">{contactError}</span>}
            </div>
          </div>

          {/* ROW 2 */}
          <div className="form-row form-row--2col">
            <div className="form-field">
              <label>Location *</label>
              <Select
                options={locationOptions}
                value={locationOptions.find(o => o.value === location) || null}
                onChange={(selected) => setLocation(selected ? selected.value : "")}
                placeholder="Select existing location..."
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={customSelectStyles}
              />
            </div>

            <div className="form-field">
              <label>Add a New Location</label>
              <div className="inline-add-row">
                <input
                  type="text"
                  placeholder="Type new location name"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
                <button
                  type="button"
                  disabled={isAddingLocation}
                  className="vt-btn vt-btn-primary"
                  onClick={async () => {
                    if (isAddingLocation) return;
                    if (!newLocation.trim()) return showToast("Enter a location", "warning");
                    setIsAddingLocation(true);
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
                      showToast(err.message, "danger");
                    } finally {
                      setIsAddingLocation(false);
                    }
                  }}
                >
                  {isAddingLocation ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>

          {/* ROW 3 */}
          <div className="form-row form-row--2col">
            <div className="form-field">
              <label>Google Map Link</label>
              <input
                type="text"
                placeholder="Paste maps link location URL"
                value={googleMapLink}
                onChange={(e) => setGoogleMapLink(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>GBP Location ID</label>
              {isSuperAdmin ? (
                <input
                  type="text"
                  placeholder="locations/1234567890123456789 (optional)"
                  value={gbpLocationId}
                  onChange={(e) => setGbpLocationId(e.target.value)}
                />
              ) : (
                <p className="field-hint">Only a SUPER_ADMIN can set this.</p>
              )}
            </div>
          </div>

          {/* ROW 4 */}
          <div className="form-row form-row--2col">
            <div className="form-field">
              <label>Linked Payment Accounts</label>
              {paymentAccounts.length === 0 ? (
                <p className="field-hint">No payment accounts configured yet.</p>
              ) : (
                <Select
                  isMulti
                  options={paymentAccountOptions}
                  value={paymentAccountOptions.filter((opt) => selectedAccountIds.includes(opt.value))}
                  onChange={(selected) => setSelectedAccountIds((selected || []).map((opt) => opt.value))}
                  placeholder="Select payment accounts..."
                  menuPortalTarget={menuPortalTarget}
                  menuPosition={menuPosition}
                  styles={multiSelectStyles}
                />
              )}
            </div>

            <div className="form-field">
              <label>Advance Collection Account(s)</label>
              <Select
                isMulti
                options={paymentAccountOptions.filter((opt) => selectedAccountIds.includes(opt.value))}
                value={paymentAccountOptions.filter((opt) => advanceAccountIds.includes(opt.value))}
                onChange={(selected) => setAdvanceAccountIds((selected || []).map((opt) => opt.value))}
                placeholder="VINTARA (default)"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={multiSelectStyles}
              />
            </div>
          </div>

          {/* ROW 4 - Commission */}
          <div className="form-row form-row--3col">
            <div className="form-field">
              <label>Commission Model</label>
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
                placeholder="Select commission model"
                styles={customSelectStyles}
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
              />
            </div>

            <div className="form-field">
              <label>Vintara Commission Percentage</label>
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
                placeholder="Select percentage"
                styles={customSelectStyles}
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
              />
            </div>

            <div className="form-field">
              <label>OTA Handling Charges</label>
              <Select
                options={OTHER_OTA_COMMISSION_PERCENTAGES}
                value={
                  OTHER_OTA_COMMISSION_PERCENTAGES.find(
                    (o) => o.value === otherOtaCommissionPercentage
                  ) || null
                }
                onChange={(selected) =>
                  setOtherOtaCommissionPercentage(selected?.value ?? "")
                }
                placeholder="Select percentage"
                styles={customSelectStyles}
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
              />
            </div>
          </div>

          {/* Room categories */}
          <div className="room-categories-section">
            <h4>Room Categories</h4>

            <div className="room-category-grid">
{roomCategories.map((cat, idx) => {
  // Check if they are using a custom manual override entry
  const isCustom = cat.isCustom || false;

  return (
    <React.Fragment key={idx}>

      {/* CATEGORY SELECT DROPDOWN */}
      {!isCustom ? (
        <SimpleSelect
          options={STANDARD_CATEGORIES}
          value={cat.name}
          onChange={(selected) => {
            if (selected.value === "CUSTOM") {
              handleRoomCategoryChange(idx, "isCustom", true);
              handleRoomCategoryChange(idx, "name", "");
            } else {
              handleRoomCategoryChange(idx, "name", selected.value);
              handleRoomCategoryChange(idx, "roomPrefix", selected.prefix || "");
            }
          }}
          placeholder="Select room category..."
        />
      ) : (
        /* FALLBACK TEXT BOX FOR CUSTOM ENTRIES */
        <input
          type="text"
          placeholder="Type custom category name..."
          value={cat.name}
          onChange={(e) => handleRoomCategoryChange(idx, "name", e.target.value)}
          required
        />
      )}

      {/* PREFIX INPUT (Auto-populated but editable) */}
      <input
        type="text"
        placeholder="Prefix"
        value={cat.roomPrefix}
        onChange={(e) => handleRoomCategoryChange(idx, "roomPrefix", e.target.value.toUpperCase())}
        required
      />

      {/* TOTAL ROOMS */}
      <input
        type="number"
        min="1"
        placeholder="Rooms"
        value={cat.totalRooms || ""}
        onChange={(e) => handleRoomCategoryChange(idx, "totalRooms", parseInt(e.target.value) || 0)}
        required
      />

      <button
        type="button"
        onClick={() => removeRoomCategoryRow(idx)}
        className="vt-btn vt-btn-danger"
      >
        Remove
      </button>
    </React.Fragment>
  );
})}
            </div>

            <button
              type="button"
              onClick={addRoomCategoryRow}
              className="add-room-category-btn"
            >
              + Add Room Category
            </button>
          </div>

          {/* Submit & cancel */}
          <div className="button-group">
            <button
              type="submit"
              disabled={isSubmitting}
              className="vt-btn vt-btn-primary"
            >
              {isSubmitting ? "Saving..." : editId ? "Update Resort" : "Save Resort"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="vt-btn vt-btn-purple"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Resorts Table */}
      <h3>Resorts ({resorts.length})</h3>
      <div className="resorts-toolbar">
        <input
          type="text"
          placeholder="Search by name, location, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select
          options={STATUS_FILTER_OPTIONS}
          value={STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)}
          onChange={(selected) => setStatusFilter(selected.value)}
          isSearchable={false}
          classNamePrefix="react-select"
          className="react-select-container filter-select"
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPosition}
          styles={themedSelectStyles()}
        />
      </div>
      {loading ? <p>Loading resorts...</p> : (
        <div className="table-wrapper">
          <table className="resorts-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Google Map</th>
                <th>GBP Location</th>
                <th>Room Categories</th>
                <th>Commission</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResorts.length === 0 ? (
                <tr><td colSpan="10" style={{ textAlign: "center", padding: "20px" }}>{resorts.length === 0 ? "No resorts available" : "No resorts match your search"}</td></tr>
              ) : (
                filteredResorts.map((resort) => {
                  const totalRooms = resort.roomCategories?.reduce((sum, c) => sum + (c.totalRooms || 0), 0) || 0;
                  return (
                  <tr key={resort.id}>
                    <td>{resort.id}</td>
                    <td>{resort.name}</td>
                    <td>{resort.location}</td>
                    <td>{resort.propertyContact || "-"}</td>
                    <td style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {resort.googleMapLink ? (
                        <a
                          href={/^https?:\/\//i.test(resort.googleMapLink) ? resort.googleMapLink : `https://${resort.googleMapLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={resort.googleMapLink}
                          style={{ color: "var(--primary-purple)" }}
                        >
                          {resort.googleMapLink}
                        </a>
                      ) : "-"}
                    </td>
                    <td style={{ maxWidth: "160px" }}>
                      {editingGbpId === resort.id ? (
                        <div style={{ display: "flex", gap: "4px" }}>
                          <input
                            type="text"
                            value={gbpLocationDraft}
                            onChange={(e) => setGbpLocationDraft(e.target.value)}
                            placeholder="locations/..."
                            style={{ width: "110px", fontSize: "12px", padding: "3px 6px" }}
                            autoFocus
                          />
                          <button className="edit-btn" style={{ padding: "3px 8px", fontSize: "12px" }} onClick={() => saveGbpLocation(resort)}>Save</button>
                          <button className="edit-btn" style={{ padding: "3px 8px", fontSize: "12px" }} onClick={() => setEditingGbpId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <span
                          title="Paste the exact locations/{id} value from Accounts/Locations lookup - don't guess by name, some listings are duplicates"
                          style={{ cursor: "pointer", fontSize: "12px", color: resort.gbpLocationId ? "var(--text-dark)" : "var(--gray-500)" }}
                          onClick={() => {
                            setEditingGbpId(resort.id);
                            setGbpLocationDraft(resort.gbpLocationId || "");
                          }}
                        >
                          {resort.gbpLocationId || "Not mapped"}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: "13px", maxWidth: "220px" }}>
                      {resort.roomCategories?.length > 0 ? (
                        <details>
                          <summary style={{ cursor: "pointer", color: "var(--primary-purple)", fontWeight: "bold" }}>
                            {resort.roomCategories.length} categories · {totalRooms} rooms
                          </summary>
                          <div style={{ marginTop: "6px", color: "#555" }}>
                            {resort.roomCategories.map(c => `${c.name} (${c.totalRooms}) [${c.rooms?.map(r => r.roomNumber).join(", ")}]`).join("; ")}
                          </div>
                        </details>
                      ) : "-"}
                    </td>
                    <td>
                      {resort.commissionModel
                        ? `${getCommissionModelLabel(resort.commissionModel)}${resort.commissionPercentage ? ` (${resort.commissionPercentage}%)` : ""}`
                        : "-"}
                      <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
                        OTA Handling Charges: {resort.otherOtaCommissionPercentage != null ? `${resort.otherOtaCommissionPercentage}%` : "-"}
                      </div>
                      <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
                        Advance to: {resort.advanceAccountNames?.length ? resort.advanceAccountNames.join(", ") : "VINTARA (default)"}
                      </div>
                    </td>
                    <td>
                      <Select
                        options={ROW_STATUS_OPTIONS}
                        value={ROW_STATUS_OPTIONS.find((o) => o.value === resort.status)}
                        isOptionDisabled={(option) => option.value === "REMOVED" && !isSuperAdmin}
                        isSearchable={false}
                        classNamePrefix="react-select"
                        className="react-select-container status-select"
                        menuPortalTarget={menuPortalTarget}
                        menuPosition={menuPosition}
                        styles={statusSelectStyles(resort.status)}
                        onChange={async (selected) => {
                          const newStatus = selected.value;
                          if (newStatus === "REMOVED") {
                            const ok = await confirm({
                              title: "Delete resort?",
                              message: `Delete "${resort.name}"? It will no longer appear in booking or expense dropdowns.`,
                              confirmLabel: "Delete",
                              danger: true,
                            });
                            if (!ok) return;
                          }
                          try {
                            const res = await fetch(
                              `${config.BASE_URL}/api/resorts/${resort.id}/status?status=${newStatus}`,
                              {
                                method: "PUT",
                                headers: config.getHeaders(),
                              }
                            );
                            if (!res.ok) throw new Error("Failed to update status");

                            setResorts((prev) =>
                              prev.map((r) =>
                                r.id === resort.id ? { ...r, status: newStatus } : r
                              )
                            );
                          } catch (err) {
                            console.error(err);
                            showToast("Failed to update status", "danger");
                          }
                        }}
                      />
                    </td>

                    <td className="actions" style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="edit-btn"
                        onClick={() => handleEdit(resort)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default ManageResorts;
