import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Select from "react-select";
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
    FaChevronDown,
} from "react-icons/fa";
import config from "../../config";
import logo from "../../assets/logo-icon.png";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../../utils/reactSelectTheme";
import "../../css/theme.css";
import "./GuestCheckInPage.css";
import ToastContainer, { useToast } from "../common/Toast";

const GENDER_OPTIONS = [
    { value: "MALE", label: "Male" },
    { value: "FEMALE", label: "Female" },
    { value: "OTHER", label: "Other" },
];

const GuestCheckInPage = () => {
    const { toasts, showToast, dismissToast } = useToast();
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(null);
    const [guests, setGuests] = useState([]);
    const [savingIndex, setSavingIndex] = useState(null);
    // Which guest/document field is currently being resized in the browser
    // before upload - { index, docType } or null. Kept separate from
    // savingIndex since compression happens right after picking the file,
    // before the guest even taps Save.
    const [compressingField, setCompressingField] = useState(null);

    // State to handle the image preview modal
    const [previewUrl, setPreviewUrl] = useState(null);

    // The booking-info card never shrank the way each guest card does once
    // filled in (see guest-form-card--submitted below) - on mobile it ate
    // most of the screen, pushing the actual guest forms down to a sliver.
    // Collapsed by default; a tap expands it back to the full grid.
    const [showBookingDetails, setShowBookingDetails] = useState(false);

    // Maintain an array of form objects for all guests (expected + any extra added)
    const [guestForms, setGuestForms] = useState([]);

    // Per-guest, per-field validation errors - { [index]: { name: true, primaryDocument: true } }.
    // Shown inline next to the field itself rather than a one-off alert(),
    // which is easy to miss on mobile and doesn't point at which of
    // possibly several guests/fields the problem is in.
    const [formErrors, setFormErrors] = useState({});

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
            showToast("Invalid or expired check-in link.", "danger");
        } finally {
            setLoading(false);
        }
    };

    // Shown on every state of this page (loading/error/form) - a guest
    // reaches this via a bare link (WhatsApp/SMS/email), with nothing else
    // on the page identifying who it's from. Logo only, no text label.
    const brandHeader = (
        <div className="guest-brand-header">
            <img src={logo} alt="Vintara Stays" className="guest-brand-logo" />
        </div>
    );

    if (loading) {
        return (
            <div className="guest-page">
                {brandHeader}
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
                <ToastContainer toasts={toasts} onDismiss={dismissToast} />
                {brandHeader}
                <div className="state-card">
                    <FaExclamationTriangle className="state-icon" />
                    <p>Booking not found or link expired.</p>
                </div>
            </div>
        );
    }

    const clearFieldError = (index, field) => {
        setFormErrors((prev) => {
            if (!prev[index]?.[field]) return prev;
            const updatedGuestErrors = { ...prev[index], [field]: false };
            return { ...prev, [index]: updatedGuestErrors };
        });
    };

    const handleFormChange = (index, field, value) => {
        const updated = [...guestForms];
        updated[index][field] = value;
        setGuestForms(updated);
        clearFieldError(index, field);
    };

    // Matches spring.servlet.multipart.max-file-size on the backend - catching
    // an oversized phone-camera photo here gives an immediate, specific
    // message instead of a failed upload after the guest has already waited.
    const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

    // A full-resolution phone camera photo (often several MB) can trip a
    // request-size limit sitting in front of the backend in production
    // (confirmed: a KB-sized file uploads fine, a ~10MB one gets its
    // connection reset outright - the browser then only reports a generic
    // "Load failed", since a proxy killing the connection before any HTTP
    // response exists is indistinguishable from any other network failure
    // to JS). Rather than guess the exact limit, shrink every photo down to
    // a size that comfortably clears any such limit, before it's ever sent.
    const MAX_DOCUMENT_DIMENSION_PX = 1920;
    const DOCUMENT_JPEG_QUALITY = 0.8;
    // Backstop for the rare case compression doesn't get far enough (e.g. an
    // already-dense image) - a clear, specific message beats a silent
    // "Load failed" after the guest has waited for the upload to fail.
    const SAFE_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024;

    // Resizes/re-encodes an image file via canvas so it uploads reliably
    // regardless of the phone camera's original resolution. Non-image files
    // (e.g. a PDF document) can't be processed this way and are returned
    // unchanged - same for any image that fails to process, so a guest is
    // never blocked by this step, only helped by it when it works.
    const compressImageFile = (file) => new Promise((resolve) => {
        if (!file || !file.type || !file.type.startsWith("image/")) {
            resolve(file);
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            const scale = Math.min(1, MAX_DOCUMENT_DIMENSION_PX / Math.max(img.width, img.height));
            const targetWidth = Math.round(img.width * scale);
            const targetHeight = Math.round(img.height * scale);

            const canvas = document.createElement("canvas");
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                resolve(file);
                return;
            }
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            canvas.toBlob((blob) => {
                if (!blob) {
                    resolve(file);
                    return;
                }
                // Only worth it if it actually shrank the file - a small
                // source image re-encoded at a fixed quality can end up
                // larger than the original.
                if (blob.size >= file.size) {
                    resolve(file);
                    return;
                }
                const compressedName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
                resolve(new File([blob], compressedName, { type: "image/jpeg" }));
            }, "image/jpeg", DOCUMENT_JPEG_QUALITY);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };

        img.src = objectUrl;
    });

    const handleFileChange = async (index, docType, file) => {
        if (!file) return;

        if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
            showToast("That file is too large (max 20MB). Please choose a smaller photo, or reduce the camera's photo quality/resolution.", "warning");
            return;
        }

        setCompressingField({ index, docType });
        const processedFile = await compressImageFile(file);
        setCompressingField(null);

        if (processedFile.size > SAFE_UPLOAD_SIZE_BYTES) {
            showToast("This photo is still quite large and may fail to upload. Please choose a smaller photo, or reduce the camera's photo quality/resolution.", "warning");
        }

        const updated = [...guestForms];
        updated[index][docType] = processedFile;
        setGuestForms(updated);
        clearFieldError(index, docType);
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

        const nameMissing = !form.name || !form.name.trim();
        const primaryDocMissing = !form.primaryDocument && !form.primaryDocumentUrl;

        if (nameMissing || primaryDocMissing) {
            setFormErrors((prev) => ({
                ...prev,
                [index]: { ...prev[index], name: nameMissing, primaryDocument: primaryDocMissing },
            }));
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

            // fetch() has no built-in timeout - on a weak/flaky mobile
            // connection a stalled upload just hangs forever, leaving the
            // button stuck on "Saving..." with no error ever surfacing
            // (neither the try nor the catch ever settles). Aborting after a
            // generous window turns that silent hang into a clear, retryable
            // error instead.
            const UPLOAD_TIMEOUT_MS = 45000;
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), UPLOAD_TIMEOUT_MS);

            let response;
            try {
                response = await fetch(url, {
                    method: "POST",
                    body: formData,
                    signal: abortController.signal
                });
            } catch (fetchError) {
                if (fetchError.name === "AbortError") {
                    throw new Error("Upload timed out - please check your connection and try again.");
                }
                throw fetchError;
            } finally {
                clearTimeout(timeoutId);
            }

            if (!response.ok) {
                const errText = await response.text();
                let message = errText;
                try {
                    const parsed = JSON.parse(errText);
                    message = parsed.error || parsed.message || errText;
                } catch {
                    // Not JSON (e.g. a container error page) - fall back to raw text.
                }
                throw new Error(message || "Unable to save guest details.");
            }

            showToast(`Guest ${index + 1} details saved successfully.`, "success");
            await loadBooking();

        } catch (e) {
            console.error(e);
            showToast(e.message || "Failed to save guest.", "danger");
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
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            <div className="booking-card">
                <div className="booking-card__title-row">
                    <img src={logo} alt="Vintara Stays" className="guest-brand-logo" />
                    <h2 className="booking-card__title">Online Check-In</h2>
                </div>
                <p className="booking-card__welcome">
                    Welcome to Vintara Stays, {booking.customerName}!
                </p>

                <button
                    type="button"
                    className="booking-card__toggle"
                    onClick={() => setShowBookingDetails((prev) => !prev)}
                    aria-expanded={showBookingDetails}
                >
                    <span className="booking-card__toggle-summary">
                        #{booking.bookingId} · {booking.resortName} · {booking.checkInDate} to {booking.checkOutDate}
                    </span>
                    <FaChevronDown
                        className={classnames("booking-card__toggle-icon", {
                            "booking-card__toggle-icon--open": showBookingDetails,
                        })}
                    />
                </button>

                {showBookingDetails && (
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
                )}

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
                const errors = formErrors[index] || {};

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
                                className={errors.name ? "field-error" : undefined}
                            />
                            {errors.name && (
                                <div className="field-error-text">Name is mandatory.</div>
                            )}

                            <label>Mobile Number {form.leadGuest && "(Locked for Lead Guest)"}</label>
                            <input
                                type="text"
                                placeholder="Mobile Number"
                                value={form.mobile}
                                disabled={form.leadGuest}
                                onChange={(e) => handleFormChange(index, "mobile", e.target.value)}
                            />

                            <label>Gender</label>
                            <Select
                                classNamePrefix="react-select"
                                className="guest-form-card__select"
                                options={GENDER_OPTIONS}
                                value={GENDER_OPTIONS.find((o) => o.value === form.gender) || null}
                                onChange={(selected) => handleFormChange(index, "gender", selected ? selected.value : "")}
                                placeholder="Select Gender"
                                isClearable
                                isSearchable={false}
                                menuPortalTarget={menuPortalTarget}
                                menuPosition={menuPosition}
                                styles={themedSelectStyles()}
                            />

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
                                disabled={compressingField?.index === index && compressingField?.docType === "primaryDocument"}
                                onChange={(e) => handleFileChange(index, "primaryDocument", e.target.files[0])}
                                className={errors.primaryDocument ? "field-error" : undefined}
                            />
                            {errors.primaryDocument && (
                                <div className="field-error-text">Primary document is mandatory.</div>
                            )}
                            {compressingField?.index === index && compressingField?.docType === "primaryDocument" && (
                                <div className="doc-preview-hint">Compressing photo…</div>
                            )}

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
                                disabled={compressingField?.index === index && compressingField?.docType === "secondaryDocument"}
                                onChange={(e) => handleFileChange(index, "secondaryDocument", e.target.files[0])}
                            />
                            {compressingField?.index === index && compressingField?.docType === "secondaryDocument" && (
                                <div className="doc-preview-hint">Compressing photo…</div>
                            )}

                            <button
                                className="primary-btn"
                                onClick={() => saveSpecificGuest(index)}
                                disabled={savingIndex === index || compressingField?.index === index}
                            >
                                {savingIndex === index
                                    ? "Saving..."
                                    : compressingField?.index === index
                                        ? "Compressing…"
                                        : `Save Guest ${index + 1}`}
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
