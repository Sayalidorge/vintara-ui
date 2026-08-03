import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import config from "../../config";
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
        return <h3 style={{ padding: "40px" }}>Loading...</h3>;
    }

    if (!booking) {
        return <h3 style={{ padding: "40px" }}>Booking not found.</h3>;
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

    return (
        <div className="guest-page">
            <div className="booking-card">
                <h2>Online Check-In</h2>
                <p><strong>Booking ID :</strong> {booking.bookingId}</p>
                <p><strong>Lead Guest :</strong> {booking.customerName}</p>
                <p><strong>Resort :</strong> {booking.resortName}</p>
                <p><strong>Check In :</strong> {booking.checkInDate}</p>
                <p><strong>Check Out :</strong> {booking.checkOutDate}</p>
                <p><strong>Expected Guests :</strong> {booking.expectedGuests}</p>
                <p><strong>Submitted Guests :</strong> {guests.length}</p>
            </div>

            <h3>Guest Details</h3>

            {guestForms.map((form, index) => (
                <div key={index} className="guest-form-card" style={{ marginBottom: "20px", border: form.submitted ? "2px solid #28a745" : "1px solid #ccc" }}>
                    <h3>
                        Guest {index + 1} 
                        {form.leadGuest && <span style={{ color: "#007bff", fontSize: "0.8em", marginLeft: "10px" }}>(Lead Guest)</span>}
                        {index >= booking.expectedGuests && <span style={{ color: "#ffc107", fontSize: "0.8em", marginLeft: "10px" }}>(Extra Guest)</span>}
                        {form.submitted && <span style={{ color: "green", float: "right" }}>✔ Submitted</span>}
                    </h3>

                    {form.submitted ? (
                        <div style={{ padding: "10px 0" }}>
                            <p><strong>Name:</strong> {form.name}</p>
                            <p><strong>Mobile:</strong> {form.mobile || "-"}</p>
                            <p><strong>Gender:</strong> {form.gender || "-"}</p>
                            
                            <div style={{ margin: "10px 0", background: "#f8f9fa", padding: "10px", borderRadius: "4px" }}>
                                <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                                    {form.primaryDocumentUrl && (
                                        <div>
                                            <p style={{ fontSize: "12px", marginBottom: "4px", fontWeight: "bold" }}>Front Side</p>
                                            <img 
                                                src={form.primaryDocumentUrl} 
                                                alt="Primary Document" 
                                                style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "4px", cursor: "pointer", border: "1px solid #ccc" }}
                                                onClick={() => setPreviewUrl(form.primaryDocumentUrl)}
                                                title="Click to preview"
                                            />
                                        </div>
                                    )}
                                    {form.secondaryDocumentUrl && (
                                        <div>
                                            <p style={{ fontSize: "12px", marginBottom: "4px", fontWeight: "bold" }}>Back Side</p>
                                            <img 
                                                src={form.secondaryDocumentUrl} 
                                                alt="Secondary Document" 
                                                style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "4px", cursor: "pointer", border: "1px solid #ccc" }}
                                                onClick={() => setPreviewUrl(form.secondaryDocumentUrl)}
                                                title="Click to preview"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p style={{ color: "green", fontWeight: "bold" }}>Details verified & saved.</p>

                            <button 
                                className="secondary-btn"
                                onClick={() => handleEnableReupload(index)}
                                style={{ fontSize: "12px", padding: "5px 10px", marginTop: "5px" }}
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
                                style={form.leadGuest ? { backgroundColor: "#e9ecef", cursor: "not-allowed" } : {}}
                            />

                            <label>Mobile Number {form.leadGuest && "(Locked for Lead Guest)"}</label>
                            <input
                                type="text"
                                placeholder="Mobile Number"
                                value={form.mobile}
                                disabled={form.leadGuest}
                                onChange={(e) => handleFormChange(index, "mobile", e.target.value)}
                                style={form.leadGuest ? { backgroundColor: "#e9ecef", cursor: "not-allowed" } : {}}
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

                            <label>Primary Document</label>
                            {form.primaryDocumentUrl ? (
                                <div style={{ marginBottom: "8px", background: "#f1f3f5", padding: "8px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "10px" }}>
                                    <img 
                                        src={form.primaryDocumentUrl} 
                                        alt="Current Primary" 
                                        style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px", cursor: "pointer", border: "1px solid #ccc" }}
                                        onClick={() => setPreviewUrl(form.primaryDocumentUrl)}
                                        title="Click to preview"
                                    />
                                    <div>
                                        <span style={{ fontSize: "13px", color: "#495057", display: "block" }}>Current file uploaded</span>
                                        <span style={{ fontSize: "11px", color: "#6c757d" }}>(Upload a new file below only to replace)</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: "12px", color: "#dc3545", marginBottom: "5px" }}>No primary document uploaded yet.</div>
                            )}
                            <input
                                type="file"
                                accept="image/*,.pdf,.png,.jpg,.jpeg"
                                onChange={(e) => handleFileChange(index, "primaryDocument", e.target.files[0])}
                            />

                            <label style={{ marginTop: "10px" }}>Secondary Document (Optional)</label>
                            {form.secondaryDocumentUrl ? (
                                <div style={{ marginBottom: "8px", background: "#f1f3f5", padding: "8px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "10px" }}>
                                    <img 
                                        src={form.secondaryDocumentUrl} 
                                        alt="Current Secondary" 
                                        style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px", cursor: "pointer", border: "1px solid #ccc" }}
                                        onClick={() => setPreviewUrl(form.secondaryDocumentUrl)}
                                        title="Click to preview"
                                    />
                                    <div>
                                        <span style={{ fontSize: "13px", color: "#495057", display: "block" }}>Current secondary file uploaded</span>
                                        <span style={{ fontSize: "11px", color: "#6c757d" }}>(Upload a new file below only to replace)</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: "12px", color: "#6c757d", marginBottom: "5px" }}>No secondary document uploaded yet.</div>
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
                                style={{ marginTop: "15px" }}
                            >
                                {savingIndex === index ? "Saving..." : `Save Guest ${index + 1}`}
                            </button>
                        </>
                    )}
                </div>
            ))}

            <div style={{ margin: "20px 0", textAlign: "center" }}>
                <button 
                    onClick={handleAddExtraGuest}
                    style={{ padding: "10px 20px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                    + Add Extra Guest
                </button>
            </div>

            {/* In-Page Image Preview Modal */}
            {previewUrl && (
                <div 
                    onClick={() => setPreviewUrl(null)}
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 1000,
                        cursor: "pointer"
                    }}
                >
                    <div 
                        style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setPreviewUrl(null)}
                            style={{
                                position: "absolute",
                                top: "-40px",
                                right: "0px",
                                background: "#fff",
                                color: "#000",
                                border: "none",
                                borderRadius: "50%",
                                width: "30px",
                                height: "30px",
                                fontSize: "16px",
                                fontWeight: "bold",
                                cursor: "pointer"
                            }}
                        >
                            ✕
                        </button>
                        <img 
                            src={previewUrl} 
                            alt="Document Preview" 
                            style={{ 
                                maxWidth: "100%", 
                                maxHeight: "85vh", 
                                objectFit: "contain", 
                                borderRadius: "4px", 
                                background: "#fff" 
                            }} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuestCheckInPage;