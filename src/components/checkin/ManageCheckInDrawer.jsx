// src/components/ManageCheckInDrawer.jsx

import React, { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import "./ManageCheckInDrawer.css";
import config from "../../config";
import Select from "react-select";

const ManageCheckInDrawer = ({
    booking,
    onClose
}) => {

    const [loading, setLoading] = useState(true);

    const [guests, setGuests] = useState([]);

    const [expandedGuest, setExpandedGuest] = useState(null);

    // The booking-summary block never shrank the way each guest card does -
    // on mobile it stacks to 5 full-width rows (see the max-width:768px CSS),
    // eating most of the screen and leaving very little room for the actual
    // guest/documents list below it. Collapsed by default; tap to expand.
    const [showBookingSummary, setShowBookingSummary] = useState(false);

    const [rejectGuestId, setRejectGuestId] = useState(null);

    const [rejectionReason, setRejectionReason] = useState("");

    const [primaryFiles, setPrimaryFiles] = useState({});
    const [secondaryFiles, setSecondaryFiles] = useState({});
    
    // Track which documents are currently in "replacement / re-upload" mode
    const [replacingPrimary, setReplacingPrimary] = useState({});
    const [replacingSecondary, setReplacingSecondary] = useState({});

    const [uploadingGuestId, setUploadingGuestId] = useState(null);
    
    // State to handle document preview popup modal
    const [viewingDocument, setViewingDocument] = useState(null);
    
    // Helper to safely format file URLs to use the backend file controller
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
    const loadGuests = async () => {

        try {

            setLoading(true);

            const response = await fetch(

                `${config.BASE_URL}/api/checkin/${booking.id}/details`,
                {
                    headers: config.getHeaders()
                }
            );

            if (!response.ok)
                throw new Error("Unable to load guest details");

            const data = await response.json();

            setGuests(data.guests || []);

        } catch (e) {

            console.error(e);

            alert("Unable to load guest details.");

        } finally {

            setLoading(false);

        }

    };

    useEffect(() => {

        if (booking?.id)
            loadGuests();

    }, [booking]);

    const verifyDocument = async (
        guestId,
        status,
        reason = ""
    ) => {

        try {

            const url =
                `${config.BASE_URL}/api/checkin/guest/${guestId}/verify?status=${status}`
                + (reason ? `&reason=${encodeURIComponent(reason)}` : "");

            const response = await fetch(url, {

                method: "PUT",

                headers: config.getHeaders()

            });

            if (!response.ok)
                throw new Error();

            await loadGuests();

            setRejectGuestId(null);

            setRejectionReason("");

        } catch (e) {

            console.error(e);

            alert("Verification failed.");

        }

    };

    const uploadDocuments = async (guestId) => {

        const guest = guests.find(g => g.guestId === guestId);

        if (!guest?.primaryDocumentUrl && !primaryFiles[guestId]) {
            alert("Please select primary document.");
            return;
        }

        if (!primaryFiles[guestId] && !secondaryFiles[guestId]) {
            alert("Please select at least one document to upload.");
            return;
        }

        try {

            setUploadingGuestId(guestId);

            const formData = new FormData();

            if (primaryFiles[guestId]) {

                formData.append(
                    "primaryDocument",
                    primaryFiles[guestId]
                );

            }

            if (secondaryFiles[guestId]) {

                formData.append(
                    "secondaryDocument",
                    secondaryFiles[guestId]
                );

            }
            const headers = { ...config.getHeaders() };
            delete headers["Content-Type"];
            const response = await fetch(

                `${config.BASE_URL}/api/checkin/guest/${guestId}/documents`,

                {
                    method: "POST",

                    headers: headers,

                    body: formData
                }
            );

            if (!response.ok) {

                throw new Error("Upload failed");

            }

            await loadGuests();

            // Clear selected local state and replacement states for this guest after successful upload
            setPrimaryFiles(prev => {
                const copy = { ...prev };
                delete copy[guestId];
                return copy;
            });
            setSecondaryFiles(prev => {
                const copy = { ...prev };
                delete copy[guestId];
                return copy;
            });
            setReplacingPrimary(prev => ({ ...prev, [guestId]: false }));
            setReplacingSecondary(prev => ({ ...prev, [guestId]: false }));

            alert("Documents uploaded successfully.");

        }
        catch (e) {

            console.error(e);

            alert("Failed to upload documents.");

        }
        finally {

            setUploadingGuestId(null);

        }

    };

    const getStatusColor = status => {

        switch (status) {

            case "APPROVED":
                return "#2e7d32";

            case "REJECTED":
                return "#c62828";

            default:
                return "#ef6c00";

        }

    };

    const getStatusBackground = status => {

        switch (status) {

            case "APPROVED":
                return "#e8f5e9";

            case "REJECTED":
                return "#ffebee";

            default:
                return "#fff8e1";

        }

    };

    if (loading) {
        return (
            <div className="checkin-drawer-overlay">
                <div className="checkin-drawer">
                    <div className="drawer-loading">
                        Loading guest details...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="checkin-drawer-overlay">

            <div className="checkin-drawer">

                <div className="drawer-header">

                    <div>

                        <h2>Manage Check-In</h2>

                        <p>
                            Booking #{booking.id}
                        </p>

                    </div>

                    <button
                        className="drawer-close"
                        onClick={onClose}
                    >
                        ✕
                    </button>

                </div>

                <button
                    type="button"
                    className="booking-summary-toggle"
                    onClick={() => setShowBookingSummary(prev => !prev)}
                    aria-expanded={showBookingSummary}
                >
                    <span className="booking-summary-toggle__text">
                        {booking.customerName} · {booking.checkInDate} → {booking.checkOutDate}
                    </span>
                    <FaChevronDown
                        className={
                            "booking-summary-toggle__icon" +
                            (showBookingSummary ? " booking-summary-toggle__icon--open" : "")
                        }
                    />
                </button>

                {showBookingSummary && (
                    <div className="booking-summary">

                        <div>
                            <label>Guest</label>
                            <span>{booking.customerName}</span>
                        </div>

                        <div>
                            <label>Contact</label>
                            <span>{booking.customerContactNumber}</span>
                        </div>

                        <div>
                            <label>Stay</label>
                            <span>
                                {booking.checkInDate}
                                {" "}
                                →
                                {" "}
                                {booking.checkOutDate}
                            </span>
                        </div>

                        <div>
                            <label>Guests</label>
                            <span>{booking.adults ?? 0} Adults, {booking.kids ?? 0} Kids</span>
                        </div>

                        <div>
                            <label>Balance</label>
                            <span style={{ color: (booking.status === "CHECKED_IN" || booking.balanceAmount === 0) ? "green" : "red", fontWeight: "bold" }}>
                                ₹{booking.status === "CHECKED_IN" ? 0 : booking.balanceAmount}
                            </span>
                        </div>

                    </div>
                )}

                <div className="guest-list">

                    {

                        guests.length === 0 &&

                        <div className="empty-state">

                            No guests added yet.

                        </div>

                    }

                    {

                        guests.map(guest => (

                            <div
                                key={guest.guestId}
                                className="guest-card"
                            >

                                <div
                                    className="guest-header"
                                    onClick={() =>
                                        setExpandedGuest(
                                            expandedGuest === guest.guestId
                                                ? null
                                                : guest.guestId
                                        )
                                    }
                                >

                                    <div>

                                        <strong>

                                            {guest.name}

                                        </strong>

                                        {

                                            guest.leadGuest &&

                                            <span className="lead-badge">

                                                Lead Guest

                                            </span>

                                        }

                                    </div>

                                    <div>

                                        <span

                                            className="verification-status"

                                            style={{

                                                background:
                                                    getStatusBackground(
                                                        guest.verificationStatus
                                                    ),

                                                color:
                                                    getStatusColor(
                                                        guest.verificationStatus
                                                    )

                                            }}

                                        >

                                            {

                                                guest.verificationStatus ||

                                                "PENDING"

                                            }

                                        </span>

                                    </div>

                                </div>

                                {

                                    expandedGuest === guest.guestId &&

                                    <div className="guest-body">

                                        <div className="guest-info">

                                            <div>

                                                <label>Mobile</label>

                                                <span>

                                                    {guest.mobile || "-"}

                                                </span>

                                            </div>

                                            <div>

                                                {guest.leadGuest && (
                                                    <>
                                                        <label>Vehicle Number</label>

                                                        <span>
                                                            {guest.vehicleNumber || "-"}
                                                        </span>
                                                    </>
                                                )}

                                            </div>

                                            <div>

                                                <label>Gender</label>

                                                <span>

                                                    {guest.gender || "-"}

                                                </span>

                                            </div>

                                        </div>

                                        <div className="documents-row">
{/* Primary Document Column */}
                            <div>
                                <h4>Primary Document</h4>

                                {guest.primaryDocumentUrl && !replacingPrimary[guest.guestId] ? (
                                    <div className="document-preview-container">
                                        <div className="document-preview-trigger">
                                            {guest.primaryDocumentUrl.toLowerCase().endsWith(".pdf") ? (
                                                <button
                                                    type="button"
                                                    className="document-link-btn"
                                                    onClick={() => setViewingDocument({
                                                        url: getFileViewUrl(guest.primaryDocumentUrl),
                                                        title: `${guest.name} - Primary Document (PDF)`,
                                                        isPdf: true
                                                    })}
                                                >
                                                    📄 View Primary Document (PDF)
                                                </button>
                                            ) : (
                                                <div
                                                    className="document-thumb-container"
                                                    onClick={() => setViewingDocument({
                                                        url: getFileViewUrl(guest.primaryDocumentUrl),
                                                        title: `${guest.name} - Primary Document (Image)`,
                                                        isPdf: false
                                                    })}
                                                >
                                                    <img
                                                        src={getFileViewUrl(guest.primaryDocumentUrl)}
                                                        className="document-image-thumb"
                                                        alt="Primary Document"
                                                    />
                                                    <span className="thumb-overlay-text">Click to Preview</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Hidden file input placed here so clicking the button below opens directory immediately */}
                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            capture="environment"
                                            id={`primary-file-${guest.guestId}`}
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;

                                                setPrimaryFiles({
                                                    ...primaryFiles,
                                                    [guest.guestId]: file
                                                });
                                                setReplacingPrimary({ ...replacingPrimary, [guest.guestId]: true });
                                            }}
                                        />

                                        <label
                                            htmlFor={`primary-file-${guest.guestId}`}
                                            className="replace-doc-btn"
                                            style={{ cursor: "pointer", display: "inline-block", textAlign: "center" }}
                                        >
                                            📷 Re-upload / Capture New
                                        </label>
                                    </div>
                                ) : (
                                    <div className="document-upload-box">
                                        {guest.primaryDocumentUrl && (
                                            <button
                                                type="button"
                                                className="cancel-replace-btn"
                                                onClick={() => {
                                                    setReplacingPrimary({ ...replacingPrimary, [guest.guestId]: false });
                                                    setPrimaryFiles(prev => {
                                                        const copy = { ...prev };
                                                        delete copy[guest.guestId];
                                                        return copy;
                                                    });
                                                }}
                                            >
                                                ✕ Cancel
                                            </button>
                                        )}

                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            capture="environment"
                                            id={`primary-file-${guest.guestId}`}
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;

                                                setPrimaryFiles({
                                                    ...primaryFiles,
                                                    [guest.guestId]: file
                                                });
                                            }}
                                        />

                                        <label
                                            htmlFor={`primary-file-${guest.guestId}`}
                                            className="replace-doc-btn"
                                            style={{ cursor: "pointer", display: "inline-block", textAlign: "center" }}
                                        >
                                            📷 Upload Primary Document
                                        </label>

                                        {primaryFiles[guest.guestId] && (
                                            <div className="selected-preview-card" style={{ marginTop: "10px" }}>
                                                {primaryFiles[guest.guestId].type.startsWith("image/") ? (
                                                    <div className="document-thumb-container">
                                                        <img
                                                            src={URL.createObjectURL(primaryFiles[guest.guestId])}
                                                            className="document-image-thumb"
                                                            alt="New Selected Preview"
                                                        />
                                                        <span className="thumb-overlay-text">New Preview</span>
                                                    </div>
                                                ) : (
                                                    <span className="file-selected-text">📄 {primaryFiles[guest.guestId].name}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                                            {/* Secondary Document Column */}
{/* Secondary Document Column */}
{/* Secondary Document Column */}
                            <div>
                                <h4>Secondary Document</h4>

                                {guest.secondaryDocumentUrl && !replacingSecondary[guest.guestId] ? (
                                    <div className="document-preview-container">
                                        <div className="document-preview-trigger">
                                            {guest.secondaryDocumentUrl.toLowerCase().endsWith(".pdf") ? (
                                                <button
                                                    type="button"
                                                    className="document-link-btn"
                                                    onClick={() => setViewingDocument({
                                                        url: getFileViewUrl(guest.secondaryDocumentUrl),
                                                        title: `${guest.name} - Secondary Document (PDF)`,
                                                        isPdf: true
                                                    })}
                                                >
                                                    📄 View Secondary Document (PDF)
                                                </button>
                                            ) : (
                                                <div
                                                    className="document-thumb-container"
                                                    onClick={() => setViewingDocument({
                                                        url: getFileViewUrl(guest.secondaryDocumentUrl),
                                                        title: `${guest.name} - Secondary Document (Image)`,
                                                        isPdf: false
                                                    })}
                                                >
                                                    <img
                                                        src={getFileViewUrl(guest.secondaryDocumentUrl)}
                                                        className="document-image-thumb"
                                                        alt="Secondary Document"
                                                    />
                                                    <span className="thumb-overlay-text">Click to Preview</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Hidden file input placed here so clicking the button below opens directory immediately */}
                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            capture="environment"
                                            id={`secondary-file-${guest.guestId}`}
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;

                                                setSecondaryFiles({
                                                    ...secondaryFiles,
                                                    [guest.guestId]: file
                                                });
                                                setReplacingSecondary({ ...replacingSecondary, [guest.guestId]: true });
                                            }}
                                        />

                                        <label
                                            htmlFor={`secondary-file-${guest.guestId}`}
                                            className="replace-doc-btn"
                                            style={{ cursor: "pointer", display: "inline-block", textAlign: "center" }}
                                        >
                                            📷 Re-upload / Capture New
                                        </label>
                                    </div>
                                ) : (
                                    <div className="document-upload-box">
                                        {guest.secondaryDocumentUrl && (
                                            <button
                                                type="button"
                                                className="cancel-replace-btn"
                                                onClick={() => {
                                                    setReplacingSecondary({ ...replacingSecondary, [guest.guestId]: false });
                                                    setSecondaryFiles(prev => {
                                                        const copy = { ...prev };
                                                        delete copy[guest.guestId];
                                                        return copy;
                                                    });
                                                }}
                                            >
                                                ✕ Cancel
                                            </button>
                                        )}

                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            capture="environment"
                                            id={`secondary-file-${guest.guestId}`}
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;

                                                setSecondaryFiles({
                                                    ...secondaryFiles,
                                                    [guest.guestId]: file
                                                });
                                            }}
                                        />

                                        <label
                                            htmlFor={`secondary-file-${guest.guestId}`}
                                            className="replace-doc-btn"
                                            style={{ cursor: "pointer", display: "inline-block", textAlign: "center" }}
                                        >
                                            📷 Upload Secondary Document
                                        </label>

                                        {secondaryFiles[guest.guestId] && (
                                            <div className="selected-preview-card" style={{ marginTop: "10px" }}>
                                                {secondaryFiles[guest.guestId].type.startsWith("image/") ? (
                                                    <div className="document-thumb-container">
                                                        <img
                                                            src={URL.createObjectURL(secondaryFiles[guest.guestId])}
                                                            className="document-image-thumb"
                                                            alt="New Selected Preview"
                                                        />
                                                        <span className="thumb-overlay-text">New Preview</span>
                                                    </div>
                                                ) : (
                                                    <span className="file-selected-text">📄 {secondaryFiles[guest.guestId].name}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>    
                </div>

                                        {/* Upload Button shows if either document is missing, replacement mode is active, or a new file has been staged */}
                                        {
                                            (!guest.primaryDocumentUrl || !guest.secondaryDocumentUrl || replacingPrimary[guest.guestId] || replacingSecondary[guest.guestId] || primaryFiles[guest.guestId] || secondaryFiles[guest.guestId]) &&

                                            <button

                                                className="primary-btn upload-action-btn"

                                                disabled={uploadingGuestId === guest.guestId}

                                                onClick={() =>
                                                    uploadDocuments(guest.guestId)
                                                }

                                            >

                                                {

                                                    uploadingGuestId === guest.guestId

                                                        ?

                                                        "Uploading..."

                                                        :

                                                        guest.primaryDocumentUrl ? "Save Updated Documents" : "Upload Documents"

                                                }

                                            </button>

                                        }

                                        <div className="verification-actions">

                                            {
                                                guest.verificationStatus !== "APPROVED" && (
                                                    <>
                                                        <button
                                                            className="approve-btn"
                                                            onClick={() =>
                                                                verifyDocument(
                                                                    guest.guestId,
                                                                    "APPROVED"
                                                                )
                                                            }
                                                        >
                                                            ✓ Approve
                                                        </button>

                                                        <button
                                                            className="reject-btn"
                                                            onClick={() =>
                                                                setRejectGuestId(
                                                                    guest.guestId
                                                                )
                                                            }
                                                        >
                                                            ✕ Reject
                                                        </button>
                                                    </>
                                                )
                                            }

                                        </div>

                                        {

                                            rejectGuestId === guest.guestId && (

                                                <div className="reject-panel">

                                                    <textarea

                                                        value={rejectionReason}

                                                        onChange={(e) =>
                                                            setRejectionReason(
                                                                e.target.value
                                                            )
                                                        }

                                                        rows={3}

                                                        placeholder="Enter rejection reason..."

                                                    />

                                                    <div className="reject-buttons">

                                                        <button

                                                            className="reject-btn"

                                                            onClick={() => {

                                                                if (
                                                                    rejectionReason.trim() === ""
                                                                ) {

                                                                    alert(
                                                                        "Please enter rejection reason."
                                                                    );

                                                                    return;

                                                                }

                                                                verifyDocument(

                                                                    guest.guestId,

                                                                    "REJECTED",

                                                                    rejectionReason

                                                                );

                                                            }}

                                                        >

                                                            Submit

                                                        </button>

                                                        <button

                                                            className="cancel-btn"

                                                            onClick={() => {

                                                                setRejectGuestId(
                                                                    null
                                                                );

                                                                setRejectionReason(
                                                                    ""
                                                                );

                                                            }}

                                                        >

                                                            Cancel

                                                        </button>

                                                    </div>

                                                </div>

                                            )

                                        }

                                    </div>

                                }

                            </div>

                        ))

                    }

                </div>

                <div className="drawer-footer">

                    <button

                        className="secondary-btn"

                        onClick={onClose}

                    >

                        Close

                    </button>

                </div>
            </div>

            {/* Document Preview Popup Modal */}
            {viewingDocument && (
                <div className="doc-modal-overlay" onClick={() => setViewingDocument(null)}>
                    <div className="doc-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="doc-modal-header">
                            <h3>{viewingDocument.title}</h3>
                            <button 
                                className="doc-modal-close" 
                                onClick={() => setViewingDocument(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="doc-modal-body">
                            {viewingDocument.isPdf ? (
                                <iframe
                                    src={viewingDocument.url}
                                    title={viewingDocument.title}
                                    className="doc-modal-iframe"
                                />
                            ) : (
                                <img
                                    src={viewingDocument.url}
                                    alt="Document Preview"
                                    className="doc-modal-image"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageCheckInDrawer;