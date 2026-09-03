import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import classnames from "classnames";
import {
    FaExclamationTriangle,
    FaHashtag,
    FaUser,
    FaHotel,
    FaCalendarAlt,
    FaCalendarCheck,
    FaUsers,
    FaCrown,
    FaUserPlus,
    FaCheckCircle,
    FaMobileAlt,
    FaVenusMars,
    FaCar,
    FaTimes,
    FaPlus,
} from "react-icons/fa";
import config from "../../config";
import "../../css/theme.css";
import "./GuestCheckInPage.css";

const GuestCheckInPage = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(null);
    const [guests, setGuests] = useState([]);
    const [savingIndex, setSavingIndex] = useState(null);

    // State to handle the image preview modal
    const [previewUrl, setPreviewUrl] = useState(null);

    // Maintain an array of form objects for all guests (expected + any extra added)
    const [guestForms, setGuestForms] = useState([]);

    // Helper to safely format file URLs to use the backend file controller.
    // The backend sometimes returns the raw local upload path (or that path
    // appended after a URL prefix) instead of a bare filename, so always pull
    // out just the last path segment and rebuild a clean URL from it.
    const getFileViewUrl = (filePathOrName) => {
        if (!filePathOrName) return "";
        // Backend appends a short-lived "?access=<signed-token>" - split it off
        // before extracting the path, then reattach as a real query string.
        // Documents are stored under resort/date subfolders now, so the whole
        // relative path (not just the last segment) must be preserved - encode
        // each segment individually so "/" stays literal (encoding the full
        // path at once would turn "/" into "%2F", which Spring Security's
        // strict firewall rejects in request paths).
        const [pathPart, queryPart] = filePathOrName.split("?");
        const encodedPath = pathPart.split("/").map((s) => encodeURIComponent(s)).join("/");
        const base = `${config.BASE_URL}/api/files/${encodedPath}`;
        return queryPart ? `${base}?${queryPart}` : base;
    };

    useEffect(() => {
        loadBooking();
    }, []);

    const loadBooking = async () => {
        try {
            const response = await fetch(`${config.BASE_URL}/api/checkin/${token}`);
            if (!response.ok) throw new Error("Invalid token");

            const data = await response.json();
            setBooking(data);
            setGuests(data.guests || []);

            const expected = data.expectedGuests || 1;
            const submittedList = data.guests || [];

            // Determine total slots needed: max of expected guests OR already submitted guests
            const totalSlots = Math.max(expected, submittedList.length);

            setGuestForms(prevForms => {
                const initialForms = [];
                for (let i = 0; i < totalSlots; i++) {
                    const existingGuest = submittedList[i];
                    const prevForm = prevForms[i] || {};

                    initialForms.push({
                        guestId: existingGuest ? existingGuest.guestId : (prevForm.guestId || null),
                        submitted: existingGuest ? true : (prevForm.submitted || false),
                        name: existingGuest ? existingGuest.name : (prevForm.name || (i === 0 ? data.customerName || "" : "")),
                        mobile: existingGuest ? (existingGuest.contactNumber || "") : (prevForm.mobile || (i === 0 ? data.contactNumber || "" : "")),
                        vehicleNumber: existingGuest ? (existingGuest.vehicleNumber || "") : (prevForm.vehicleNumber || ""),
                        gender: existingGuest ? existingGuest.gender || "" : (prevForm.gender || ""),
                        leadGuest: i === 0,
                        primaryDocumentUrl: existingGuest ? existingGuest.primaryDocumentUrl : prevForm.primaryDocumentUrl,
                        secondaryDocumentUrl: existingGuest ? existingGuest.secondaryDocumentUrl : prevForm.secondaryDocumentUrl,
                        primaryDocument: null,
                        secondaryDocument: null
                    });
                }
                return initialForms;
            });

        } catch (e) {
            console.error(e);
            alert("Invalid or expired check-in link.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="guest-page">
                <div className="state-card">
                    <span className="spinner" />
                    <p>Loading your check-in details…</p>
                </div>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="guest-page">
                <div className="state-card">
                    <FaExclamationTriangle className="state-icon" />
                    <p>Booking not found or link expired.</p>
                </div>
            </div>
        );
    }

    const handleFormChange = (index, field, value) => {
        const updated = [...guestForms];
        updated[index][field] = value;
        setGuestForms(updated);
    };

    const handleFileChange = (index, docType, file) => {
        const updated = [...guestForms];
        updated[index][docType] = file;
        setGuestForms(updated);
    };

    // Function to dynamically add a blank extra guest slot
    const handleAddExtraGuest = () => {
        setGuestForms([
            ...guestForms,
            {
                guestId: null,
                submitted: false,
                name: "",
                mobile: "",
                gender: "",
                leadGuest: false,
                primaryDocumentUrl: null,
                secondaryDocumentUrl: null,
                primaryDocument: null,
                secondaryDocument: null
            }
        ]);
    };

    const saveSpecificGuest = async (index) => {
        const form = guestForms[index];

        if (!form.name || !form.name.trim()) {
            alert(`Guest ${index + 1} name is mandatory.`);
            return;
        }

        if (!form.primaryDocument && !form.primaryDocumentUrl) {
            alert(`Primary document is mandatory for Guest ${index + 1}.`);
            return;
        }

        setSavingIndex(index);

        try {
            const formData = new FormData();

            if (form.guestId) {
                formData.append("guestId", form.guestId);
            }
            formData.append("name", form.name.trim());
            formData.append("mobile", form.mobile || "");
            formData.append("gender", form.gender || "");
            formData.append("leadGuest", form.leadGuest || false);
            if (form.leadGuest) {
                formData.append("vehicleNumber", (form.vehicleNumber || "").trim());
            }

            if (form.primaryDocument instanceof File) {
                formData.append("primaryDocument", form.primaryDocument);
            }
            if (form.secondaryDocument instanceof File) {
                formData.append("secondaryDocument", form.secondaryDocument);
            }

            const url = form.guestId
                ? `${config.BASE_URL}/api/checkin/${token}/guest-with-docs/${form.guestId}`
                : `${config.BASE_URL}/api/checkin/${token}/guest-with-docs`;

            const response = await fetch(url, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "Unable to save guest details.");
            }

            alert(`Guest ${index + 1} details saved successfully.`);
            await loadBooking();

        } catch (e) {
            console.error(e);
            alert(e.message || "Failed to save guest.");
        } finally {
            setSavingIndex(null);
        }
    };

    const handleEnableReupload = (index) => {
        const updated = [...guestForms];
        updated[index].submitted = false;
        setGuestForms(updated);
    };

    const progressPct = Math.min(
        100,
        Math.round((guests.length / Math.max(booking.expectedGuests || 1, 1)) * 100)
    );
    const progressComplete = guests.length >= booking.expectedGuests;

    return (
        <div className="guest-page">
            <div className="booking-card">
                <h2 className="booking-card__title">Online Check-In</h2>
                <p className="booking-card__welcome">
                    Welcome to {booking.resortName}, {booking.customerName}!
                </p>

                <div className="booking-info-grid">
                    <div className="booking-info-item">
                        <FaHashtag className="booking-info-icon" />
                        <div>
                            <span className="booking-info-label">Booking ID</span>
                            <span className="booking-info-value">{booking.bookingId}</span>
                        </div>
                    </div>
                    <div className="booking-info-item">
                        <FaUser className="booking-info-icon" />
                        <div>
                            <span className="booking-info-label">Lead Guest</span>
                            <span className="booking-info-value">{booking.customerName}</span>
                        </div>
                    </div>
                    <div className="booking-info-item">
                        <FaHotel className="booking-info-icon" />
                        <div>
                            <span className="booking-info-label">Resort</span>
                            <span className="booking-info-value">{booking.resortName}</span>
                        </div>
                    </div>
                    <div className="booking-info-item">
                        <FaUsers className="booking-info-icon" />
                        <div>
                            <span className="booking-info-label">Expected Guests</span>
                            <span className="booking-info-value">{booking.expectedGuests}</span>
                        </div>
                    </div>
                    <div className="booking-info-item">
                        <FaCalendarAlt className="booking-info-icon" />
                        <div>
                            <span className="booking-info-label">Check In</span>
                            <span className="booking-info-value">{booking.checkInDate}</span>
                        </div>
                    </div>
                    <div className="booking-info-item">
                        <FaCalendarCheck className="booking-info-icon" />
                        <div>
                            <span className="booking-info-label">Check Out</span>
                            <span className="booking-info-value">{booking.checkOutDate}</span>
                        </div>
                    </div>
                </div>

                <div className="checkin-progress">
                    <div className="checkin-progress__label">
                        <span>Guest Check-In Progress</span>
                        <span>{guests.length} / {booking.expectedGuests}</span>
                    </div>
                    <div className="progress-track">
                        <div
                            className={classnames("progress-fill", { "progress-fill--complete": progressComplete })}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            </div>

            <h3 className="section-heading">
                <FaUsers /> Guest Details
            </h3>

            {guestForms.map((form, index) => {
                const primaryPreviewSrc = form.primaryDocument
                    ? URL.createObjectURL(form.primaryDocument)
                    : getFileViewUrl(form.primaryDocumentUrl) || null;
                const secondaryPreviewSrc = form.secondaryDocument
                    ? URL.createObjectURL(form.secondaryDocument)
                    : getFileViewUrl(form.secondaryDocumentUrl) || null;
                const isExtraGuest = index >= booking.expectedGuests;

                return (
                <div
                    key={index}
                    className={classnames("guest-form-card", { "guest-form-card--submitted": form.submitted })}
                >
                    <div className="guest-card-header">
                        <div className="guest-card-header__title">
                            <span className="guest-avatar">{index + 1}</span>
                            <h3>Guest {index + 1}</h3>
                        </div>
                        <div className="guest-card-header__badges">
                            {form.leadGuest && (
                                <span className="badge badge--lead"><FaCrown /> Lead Guest</span>
                            )}
                            {isExtraGuest && (
                                <span className="badge badge--extra"><FaUserPlus /> Extra Guest</span>
                            )}
                            {form.submitted && (
                                <span className="badge badge--submitted"><FaCheckCircle /> Submitted</span>
                            )}
                        </div>
                    </div>

                    {form.submitted ? (
                        <div>
                            <div className="guest-summary-grid">
                                <div className="guest-summary-item">
                                    <FaUser className="guest-summary-icon" />
                                    <div>
                                        <span className="guest-summary-label">Name</span>
                                        <span className="guest-summary-value">{form.name}</span>
                                    </div>
                                </div>
                                <div className="guest-summary-item">
                                    <FaMobileAlt className="guest-summary-icon" />
                                    <div>
                                        <span className="guest-summary-label">Mobile</span>
                                        <span className="guest-summary-value">{form.mobile || "-"}</span>
                                    </div>
                                </div>
                                <div className="guest-summary-item">
                                    <FaVenusMars className="guest-summary-icon" />
                                    <div>
                                        <span className="guest-summary-label">Gender</span>
                                        <span className="guest-summary-value">{form.gender || "-"}</span>
                                    </div>
                                </div>
                                {form.leadGuest && (
                                    <div className="guest-summary-item">
                                        <FaCar className="guest-summary-icon" />
                                        <div>
                                            <span className="guest-summary-label">Vehicle Number</span>
                                            <span className="guest-summary-value">{form.vehicleNumber || "-"}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="guest-documents-box">
                                <div className="guest-documents-row">
                                    {form.primaryDocumentUrl && (
                                        <div>
                                            <p className="doc-thumb-label">Front Side</p>
                                            <img
                                                src={getFileViewUrl(form.primaryDocumentUrl)}
                                                alt="Primary Document"
                                                className="doc-thumb"
                                                onClick={() => setPreviewUrl(getFileViewUrl(form.primaryDocumentUrl))}
                                                title="Click to preview"
                                            />
                                        </div>
                                    )}
                                    {form.secondaryDocumentUrl && (
                                        <div>
                                            <p className="doc-thumb-label">Back Side</p>
                                            <img
                                                src={getFileViewUrl(form.secondaryDocumentUrl)}
                                                alt="Secondary Document"
                                                className="doc-thumb"
                                                onClick={() => setPreviewUrl(getFileViewUrl(form.secondaryDocumentUrl))}
                                                title="Click to preview"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="verified-text"><FaCheckCircle /> Details verified & saved.</p>

                            <button
                                className="secondary-btn secondary-btn--sm"
                                onClick={() => handleEnableReupload(index)}
                            >
                                Edit Details / Re-upload Documents
                            </button>
                        </div>
                    ) : (
                        <>
                            <label>Full Name {form.leadGuest && "(Locked for Lead Guest)"}</label>
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={form.name}
                                disabled={form.leadGuest}
                                onChange={(e) => handleFormChange(index, "name", e.target.value)}
                            />

                            <label>Mobile Number {form.leadGuest && "(Locked for Lead Guest)"}</label>
                            <input
                                type="text"
                                placeholder="Mobile Number"
                                value={form.mobile}
                                disabled={form.leadGuest}
                                onChange={(e) => handleFormChange(index, "mobile", e.target.value)}
                            />

                            <label>Gender</label>
                            <select
                                value={form.gender}
                                onChange={(e) => handleFormChange(index, "gender", e.target.value)}
                            >
                                <option value="">Select Gender</option>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                            </select>

                            {form.leadGuest && (
                                <>
                                    <label>Vehicle Number (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. MH12AB1234"
                                        value={form.vehicleNumber || ""}
                                        onChange={(e) => handleFormChange(index, "vehicleNumber", e.target.value.toUpperCase())}
                                    />
                                </>
                            )}

                            <label>Primary Document</label>
                            {primaryPreviewSrc ? (
                                <div className="doc-preview-box">
                                    <img
                                        src={primaryPreviewSrc}
                                        alt={form.primaryDocument ? "Selected Primary" : "Current Primary"}
                                        className="doc-thumb doc-thumb--sm"
                                        onClick={() => setPreviewUrl(primaryPreviewSrc)}
                                        title="Click to preview"
                                    />
                                    <div className="doc-preview-meta">
                                        {form.primaryDocument ? (
                                            <>
                                                <span className="doc-preview-status">New file selected</span>
                                                <span className="doc-preview-hint">{form.primaryDocument.name}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="doc-preview-status">Current file uploaded</span>
                                                <span className="doc-preview-hint">(Upload a new file below only to replace)</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="doc-missing-warning">No primary document uploaded yet.</div>
                            )}
                            <input
                                type="file"
                                accept="image/*,.pdf,.png,.jpg,.jpeg"
                                onChange={(e) => handleFileChange(index, "primaryDocument", e.target.files[0])}
                            />

                            <label style={{ marginTop: "10px" }}>Secondary Document (Optional)</label>
                            {secondaryPreviewSrc ? (
                                <div className="doc-preview-box">
                                    <img
                                        src={secondaryPreviewSrc}
                                        alt={form.secondaryDocument ? "Selected Secondary" : "Current Secondary"}
                                        className="doc-thumb doc-thumb--sm"
                                        onClick={() => setPreviewUrl(secondaryPreviewSrc)}
                                        title="Click to preview"
                                    />
                                    <div className="doc-preview-meta">
                                        {form.secondaryDocument ? (
                                            <>
                                                <span className="doc-preview-status">New file selected</span>
                                                <span className="doc-preview-hint">{form.secondaryDocument.name}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="doc-preview-status">Current secondary file uploaded</span>
                                                <span className="doc-preview-hint">(Upload a new file below only to replace)</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="doc-missing-note">No secondary document uploaded yet.</div>
                            )}
                            <input
                                type="file"
                                accept="image/*,.pdf,.png,.jpg,.jpeg"
                                onChange={(e) => handleFileChange(index, "secondaryDocument", e.target.files[0])}
                            />

                            <button
                                className="primary-btn"
                                onClick={() => saveSpecificGuest(index)}
                                disabled={savingIndex === index}
                            >
                                {savingIndex === index ? "Saving..." : `Save Guest ${index + 1}`}
                            </button>
                        </>
                    )}
                </div>
                );
            })}

            <div className="add-guest-wrapper">
                <button className="add-guest-btn" onClick={handleAddExtraGuest}>
                    <FaPlus /> Add Extra Guest
                </button>
            </div>

            {/* In-Page Image Preview Modal */}
            {previewUrl && (
                <div
                    className="doc-preview-modal-overlay"
                    onClick={() => setPreviewUrl(null)}
                >
                    <div
                        className="doc-preview-modal-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="doc-preview-modal-close"
                            onClick={() => setPreviewUrl(null)}
                        >
                            <FaTimes />
                        </button>
                        <img
                            src={previewUrl}
                            alt="Document Preview"
                            className="doc-preview-modal-image"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuestCheckInPage;
