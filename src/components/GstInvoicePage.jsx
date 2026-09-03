// src/components/GstInvoicePage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import config from "../config";
import { downloadBlob, downloadCsv } from "../utils/csv";
import { isSuperAdmin } from "../utils/auth";

const invoiceFileName = (invoiceNumber) =>
  `${(invoiceNumber || "gst-bill").replace(/\//g, "-")}.pdf`;

const GstInvoicePage = () => {
  const [searchParams] = useSearchParams();
  const [bookingIdInput, setBookingIdInput] = useState(searchParams.get("bookingId") || "");
  const [booking, setBooking] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Maharashtra");
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailing, setEmailing] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Inline preview for an already-generated invoice — shown directly below
  // the search result card (same pattern as the "All Invoices" tab's inline
  // swap), not a popup, since the user has already confirmed this bill.
  const [existingInvoicePreviewUrl, setExistingInvoicePreviewUrl] = useState(null);
  const existingInvoicePreviewUrlRef = useRef(null);
  useEffect(() => {
    existingInvoicePreviewUrlRef.current = existingInvoicePreviewUrl;
  }, [existingInvoicePreviewUrl]);
  useEffect(() => () => {
    if (existingInvoicePreviewUrlRef.current) URL.revokeObjectURL(existingInvoicePreviewUrlRef.current);
  }, []);

  // Object URL for whatever PDF (draft preview or the real, already-generated
  // one) is shown in the popup viewer — same doc-modal-overlay pattern used
  // for guest ID document previews (ManageCheckInDrawer.jsx), not an inline
  // iframe embedded in the page.
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const previewUrlRef = useRef(null);
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const setPreview = (blob) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = blob ? URL.createObjectURL(blob) : null;
    setPreviewUrl(url);
    setPreviewModalOpen(Boolean(url));
  };

  // Top-level tab: "generate" (search/preview/generate a bill) is the
  // default, "invoices" is the separated register/list view.
  const [activeTab, setActiveTab] = useState("generate");

  const [allInvoices, setAllInvoices] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Inline preview within the "invoices" tab — clicking Preview on a row
  // swaps the table out for the PDF, in the same spot, rather than a popup.
  const [listPreviewUrl, setListPreviewUrl] = useState(null);
  const [listPreviewInvoiceNumber, setListPreviewInvoiceNumber] = useState(null);
  const [loadingListPreview, setLoadingListPreview] = useState(false);
  const listPreviewUrlRef = useRef(null);
  useEffect(() => {
    listPreviewUrlRef.current = listPreviewUrl;
  }, [listPreviewUrl]);
  useEffect(() => () => {
    if (listPreviewUrlRef.current) URL.revokeObjectURL(listPreviewUrlRef.current);
  }, []);
  // Defaults to the current month, matching the Expenses page's month-picker
  // convention — accounting typically wants "this period" first, with the
  // option to clear it and see everything.
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchAllInvoices = async (month) => {
    setLoadingList(true);
    try {
      const url = month
        ? `${config.BASE_URL}/api/bookings/gst-bills?month=${month}`
        : `${config.BASE_URL}/api/bookings/gst-bills`;
      const res = await fetch(url, { headers: config.getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch generated invoices");
      setAllInvoices(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAllInvoices(invoiceMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceMonth]);

  const handleSearch = async (idToSearch) => {
    const id = (idToSearch ?? bookingIdInput).trim();
    if (!id) {
      alert("Enter a booking ID");
      return;
    }

    setLoading(true);
    setBooking(null);
    setInvoice(null);
    setError("");
    setCompanyName("");
    setCustomerGstin("");
    setCustomerAddress("");
    setPlaceOfSupply("Maharashtra");
    setEditingInvoice(false);
    setShowEmailForm(false);
    setPreview(null);
    if (existingInvoicePreviewUrlRef.current) URL.revokeObjectURL(existingInvoicePreviewUrlRef.current);
    setExistingInvoicePreviewUrl(null);

    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${id}`, { headers: config.getHeaders() });
      if (!res.ok) throw new Error(res.status === 404 ? "Booking not found" : "Failed to fetch booking");
      const bookingData = await res.json();
      setBooking(bookingData);
      setEmailAddress(bookingData.customerEmail || "");

      const invoiceRes = await fetch(`${config.BASE_URL}/api/bookings/${id}/gst-bill`, { headers: config.getHeaders() });
      if (invoiceRes.ok) {
        const invoiceData = await invoiceRes.json();
        setInvoice(invoiceData);

        // Already generated — load the PDF inline below the card right away
        // instead of waiting for a separate "View" click.
        const pdfRes = await fetch(`${config.BASE_URL}/api/bookings/${id}/gst-bill/pdf`, {
          headers: config.getHeaders(),
        });
        if (pdfRes.ok) {
          setExistingInvoicePreviewUrl(URL.createObjectURL(await pdfRes.blob()));
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch booking");
    } finally {
      setLoading(false);
    }
  };

  // Auto-search when arriving via the "GST Invoice" quick-launch link on a booking card.
  useEffect(() => {
    const idFromUrl = searchParams.get("bookingId");
    if (idFromUrl) {
      handleSearch(idFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreview = async () => {
    if (!booking) return;
    setPreviewing(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${booking.id}/gst-bill/preview`, {
        method: "POST",
        headers: config.getHeaders(),
        body: JSON.stringify({
          customerCompanyName: companyName.trim() || null,
          customerGstin: customerGstin.trim() || null,
          customerAddress: customerAddress.trim() || null,
          placeOfSupply: placeOfSupply.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to build preview");
      setPreview(await res.blob());
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to build preview");
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmGenerate = async () => {
    if (!booking) return;
    setGenerating(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${booking.id}/gst-bill`, {
        method: "POST",
        headers: config.getHeaders(),
        body: JSON.stringify({
          customerCompanyName: companyName.trim() || null,
          customerGstin: customerGstin.trim() || null,
          customerAddress: customerAddress.trim() || null,
          placeOfSupply: placeOfSupply.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate GST bill");
      const generated = await res.json();
      setInvoice(generated);

      const pdfRes = await fetch(`${config.BASE_URL}/api/bookings/${booking.id}/gst-bill/pdf`, {
        headers: config.getHeaders(),
      });
      if (pdfRes.ok) {
        setPreview(await pdfRes.blob());
      }
      fetchAllInvoices(invoiceMonth);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to generate GST bill");
    } finally {
      setGenerating(false);
    }
  };

  const startEditInvoice = () => {
    setCompanyName(invoice.customerCompanyName || "");
    setCustomerGstin(invoice.customerGstin || "");
    setCustomerAddress(invoice.customerAddress || "");
    setPlaceOfSupply(invoice.placeOfSupply || "Maharashtra");
    setEditingInvoice(true);
  };

  const cancelEditInvoice = () => {
    setEditingInvoice(false);
  };

  const handleRegenerate = async () => {
    if (!booking) return;
    setRegenerating(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${booking.id}/gst-bill`, {
        method: "PUT",
        headers: config.getHeaders(),
        body: JSON.stringify({
          customerCompanyName: companyName.trim() || null,
          customerGstin: customerGstin.trim() || null,
          customerAddress: customerAddress.trim() || null,
          placeOfSupply: placeOfSupply.trim() || null,
        }),
      });
      if (res.status === 409) {
        throw new Error("This invoice can no longer be regenerated — the monthly accounting cutoff (night of the 1st) has passed.");
      }
      if (!res.ok) throw new Error("Failed to regenerate GST bill");
      const updated = await res.json();
      setInvoice(updated);
      setEditingInvoice(false);

      const pdfRes = await fetch(`${config.BASE_URL}/api/bookings/${booking.id}/gst-bill/pdf`, {
        headers: config.getHeaders(),
      });
      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        if (existingInvoicePreviewUrlRef.current) URL.revokeObjectURL(existingInvoicePreviewUrlRef.current);
        setExistingInvoicePreviewUrl(URL.createObjectURL(blob));
      }
      fetchAllInvoices(invoiceMonth);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to regenerate GST bill");
    } finally {
      setRegenerating(false);
    }
  };

  const handleEmailInvoice = async () => {
    if (!booking || !emailAddress.trim()) return;
    setEmailing(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${booking.id}/gst-bill/email`, {
        method: "POST",
        headers: config.getHeaders(),
        body: JSON.stringify({ email: emailAddress.trim() }),
      });
      if (res.status === 400) throw new Error("No email address to send to — enter one first.");
      if (res.status === 500) throw new Error("Failed to send the email. Please try again.");
      if (!res.ok) throw new Error("Failed to email GST bill");
      alert(`Invoice emailed to ${emailAddress.trim()}`);
      setShowEmailForm(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to email GST bill");
    } finally {
      setEmailing(false);
    }
  };

  const handleDownload = async () => {
    if (!booking) return;
    setDownloading(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${booking.id}/gst-bill/pdf`, {
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to download GST bill");
      const blob = await res.blob();
      downloadBlob(blob, invoiceFileName(invoice?.invoiceNumber));
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to download GST bill");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadFromList = async (bookingId, invoiceNumber) => {
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${bookingId}/gst-bill/pdf`, {
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to download GST bill");
      const blob = await res.blob();
      downloadBlob(blob, invoiceFileName(invoiceNumber));
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to download GST bill");
    }
  };

  const handlePreviewFromList = async (bookingId, invoiceNumber) => {
    setLoadingListPreview(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/bookings/${bookingId}/gst-bill/pdf`, {
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load GST bill");
      const blob = await res.blob();
      if (listPreviewUrlRef.current) URL.revokeObjectURL(listPreviewUrlRef.current);
      setListPreviewUrl(URL.createObjectURL(blob));
      setListPreviewInvoiceNumber(invoiceNumber);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to load GST bill");
    } finally {
      setLoadingListPreview(false);
    }
  };

  const handleBackToTable = () => {
    if (listPreviewUrlRef.current) URL.revokeObjectURL(listPreviewUrlRef.current);
    setListPreviewUrl(null);
    setListPreviewInvoiceNumber(null);
  };

  return (
    <div className="resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <div className="page-header">
        <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary-purple)", textAlign: "left", marginTop: "6px", marginBottom: "20px" }}>GST Invoice</h2>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #eee" }}>
        <button
          type="button"
          onClick={() => setActiveTab("generate")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "generate" ? "3px solid var(--primary-purple)" : "3px solid transparent",
            fontWeight: "bold",
            fontSize: "14px",
            color: activeTab === "generate" ? "var(--primary-purple)" : "#666",
            cursor: "pointer",
          }}
        >
          Generate GST Bill
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "invoices" ? "3px solid var(--primary-purple)" : "3px solid transparent",
            fontWeight: "bold",
            fontSize: "14px",
            color: activeTab === "invoices" ? "var(--primary-purple)" : "#666",
            cursor: "pointer",
          }}
        >
          All Invoices
        </button>
      </div>

      {activeTab === "generate" && (
      <>
      <div className="user-management-section" style={{ border: "1px solid #ccc", padding: "25px", borderRadius: "6px", marginBottom: "30px", background: "#fff", boxSizing: "border-box" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Booking ID</label>
            <input
              type="text"
              value={bookingIdInput}
              onChange={(e) => setBookingIdInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Enter booking ID"
              style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", width: "220px", boxSizing: "border-box" }}
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={loading}
            style={{ height: "38px", padding: "0 20px", background: "var(--primary-purple)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {error && <p style={{ color: "red", marginTop: "15px" }}>{error}</p>}

        {booking && (
          <div style={{ marginTop: "20px", background: "#f9f9f9", padding: "15px 20px", borderRadius: "6px" }}>
            <p style={{ margin: "0 0 15px 0", fontSize: "13px", color: "#555" }}>
              Booking #{booking.id} — {booking.customerName}
            </p>

            {invoice && !editingInvoice ? (
              <div>
                <p style={{ margin: 0 }}><strong>Invoice Number:</strong> {invoice.invoiceNumber}</p>
                <p style={{ margin: "4px 0 0 0" }}><strong>Generated:</strong> {invoice.generatedAt ? new Date(invoice.generatedAt).toLocaleString() : "-"}</p>
                {invoice.customerCompanyName && (
                  <p style={{ margin: "4px 0 0 0" }}><strong>Bill To:</strong> {invoice.customerCompanyName} (GSTIN: {invoice.customerGstin || "-"})</p>
                )}
                {invoice.customerAddress && (
                  <p style={{ margin: "4px 0 0 0" }}><strong>Billing Address:</strong> {invoice.customerAddress}</p>
                )}
                <p style={{ margin: "4px 0 0 0" }}><strong>Place of Supply:</strong> {invoice.placeOfSupply || "-"}</p>
                {invoice.bookingChangedSinceInvoice && (
                  <p style={{ margin: "8px 0 0 0", color: "#856404" }}>Note: booking details have changed since this bill was generated.</p>
                )}
                <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    style={{ padding: "8px 20px", background: "var(--primary-teal)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    {downloading ? "Downloading…" : "Download PDF"}
                  </button>
                  {invoice.regenerationAllowed ? (
                    <button
                      type="button"
                      onClick={startEditInvoice}
                      style={{ padding: "8px 20px", background: "#fff", color: "var(--primary-purple)", border: "1px solid var(--primary-purple)", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                    >
                      Edit / Regenerate
                    </button>
                  ) : (
                    <p style={{ margin: 0, fontSize: "12px", color: "#999" }}>
                      Regeneration window closed — this invoice's data has already been sent for accounting.
                    </p>
                  )}
                  {!showEmailForm && (
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(true)}
                      style={{ padding: "8px 20px", background: "#fff", color: "var(--primary-teal)", border: "1px solid var(--primary-teal)", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                    >
                      Email to Customer
                    </button>
                  )}
                </div>

                {showEmailForm && (
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "12px", flexWrap: "wrap" }}>
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="customer@example.com"
                      style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", width: "260px", boxSizing: "border-box" }}
                    />
                    <button
                      type="button"
                      onClick={handleEmailInvoice}
                      disabled={emailing || !emailAddress.trim()}
                      style={{ padding: "8px 20px", background: "var(--primary-teal)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                    >
                      {emailing ? "Sending…" : "Send"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      disabled={emailing}
                      style={{ padding: "8px 20px", background: "#fff", color: "#555", border: "1px solid #ccc", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {existingInvoicePreviewUrl && (
                  <iframe
                    title="GST bill"
                    src={existingInvoicePreviewUrl}
                    style={{ width: "100%", height: "85vh", border: "1px solid #ddd", borderRadius: "4px", marginTop: "16px" }}
                  />
                )}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "13px", color: "#666", marginBottom: "10px" }}>
                  {editingInvoice
                    ? `Editing invoice ${invoice.invoiceNumber} — the invoice number stays the same; billing details and amounts will be refreshed from the booking. Regenerable until the night of the 1st of next month.`
                    : "Preview the bill first — once generated, the invoice number is locked and cannot be changed."}
                </p>
                <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Bill To Company Name (optional)</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", width: "240px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>GSTIN (optional)</label>
                    <input
                      type="text"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                      style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", width: "200px", boxSizing: "border-box", textTransform: "uppercase" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Place of Supply</label>
                    <input
                      type="text"
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", width: "200px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "260px" }}>
                    <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Billing Address (optional)</label>
                    <textarea
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      rows={2}
                      style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box", fontFamily: "inherit", fontSize: "14px", resize: "vertical" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                  {editingInvoice ? (
                    <>
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        style={{ padding: "8px 24px", background: "var(--primary-teal)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        {regenerating ? "Saving…" : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditInvoice}
                        disabled={regenerating}
                        style={{ padding: "8px 24px", background: "#fff", color: "#555", border: "1px solid #ccc", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handlePreview}
                        disabled={previewing}
                        style={{ padding: "8px 24px", background: "var(--primary-purple)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        {previewing ? "Building Preview…" : "Preview Bill"}
                      </button>
                      {previewUrl && (
                        <button
                          type="button"
                          onClick={handleConfirmGenerate}
                          disabled={generating}
                          style={{ padding: "8px 24px", background: "var(--primary-teal)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                        >
                          {generating ? "Generating…" : "Looks Good — Generate"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {previewModalOpen && previewUrl && (
        <div
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000 }}
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            style={{ background: "#fff", width: "80%", maxWidth: "850px", height: "85vh", borderRadius: "8px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 5px 20px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", background: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#333" }}>
                {invoice ? `GST Bill: ${invoice.invoiceNumber}` : "GST Bill Preview"}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#6c757d" }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, padding: "20px", display: "flex", justifyContent: "center", alignItems: "center", background: "#e9ecef", overflow: "auto" }}>
              <iframe
                title="GST bill preview"
                src={previewUrl}
                style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
              />
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {activeTab === "invoices" && (
      <div className="user-management-section" style={{ border: "1px solid #ccc", padding: "25px", borderRadius: "6px", marginBottom: "30px", background: "#fff", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, color: "#333" }}>All Generated Invoices</h3>
          {!listPreviewUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <label style={{ fontWeight: "600", fontSize: "13px", color: "#555" }}>Month:</label>
            <input
              type="month"
              value={invoiceMonth}
              onChange={(e) => setInvoiceMonth(e.target.value)}
              style={{ padding: "6px 10px", height: "34px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
            />
            {invoiceMonth && (
              <button
                type="button"
                onClick={() => setInvoiceMonth("")}
                style={{ padding: "6px 16px", background: "var(--primary-teal)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
              >
                Show All
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchAllInvoices(invoiceMonth)}
              disabled={loadingList}
              style={{ padding: "6px 16px", background: "var(--primary-purple)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
            >
              {loadingList ? "Refreshing…" : "Refresh"}
            </button>
            {isSuperAdmin() && (
              <button
                type="button"
                onClick={() => downloadCsv(
                  `gst-invoices${invoiceMonth ? `-${invoiceMonth}` : ""}.csv`,
                  allInvoices,
                  [
                    { key: "invoiceNumber", header: "Invoice No" },
                    { key: "generatedAt", header: "Generated On" },
                    { key: "bookingId", header: "Booking ID" },
                    { key: "guestName", header: "Guest" },
                    { key: "property", header: "Property" },
                    { key: "taxableValue", header: "Taxable Value" },
                    { key: "gstPercentage", header: "GST %" },
                    { key: "gstAmount", header: "GST Amount" },
                    { key: "cgstPercentage", header: "CGST %" },
                    { key: "cgstAmount", header: "CGST Amount" },
                    { key: "sgstPercentage", header: "SGST %" },
                    { key: "sgstAmount", header: "SGST Amount" },
                    { key: "totalAmount", header: "Total" },
                    { key: "customerCompanyName", header: "Bill To Company" },
                    { key: "customerGstin", header: "Customer GSTIN" },
                    { key: "customerAddress", header: "Customer Address" },
                    { key: "placeOfSupply", header: "Place of Supply" },
                  ]
                )}
                style={{ padding: "6px 16px", background: "var(--primary-teal)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
              >
                Export CSV
              </button>
            )}
          </div>
          )}
        </div>

        {listPreviewUrl ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h4 style={{ margin: 0, color: "#333" }}>GST Bill: {listPreviewInvoiceNumber}</h4>
              <button
                type="button"
                onClick={handleBackToTable}
                style={{ padding: "6px 16px", background: "var(--primary-purple)", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
              >
                ← Back to Table
              </button>
            </div>
            <iframe
              title="GST bill preview"
              src={listPreviewUrl}
              style={{ width: "100%", height: "85vh", border: "1px solid #ddd", borderRadius: "4px" }}
            />
          </div>
        ) : (
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="resorts-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Booking ID</th>
                <th>Guest</th>
                <th>Property</th>
                <th>Total</th>
                <th>Generated On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allInvoices.length === 0 ? (
                <tr><td colSpan="7">No GST bills generated yet</td></tr>
              ) : (
                allInvoices.map((inv) => (
                  <tr key={inv.invoiceNumber}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.bookingId}</td>
                    <td>{inv.guestName || "-"}</td>
                    <td>{inv.property || "-"}</td>
                    <td>₹{inv.totalAmount}</td>
                    <td>{inv.generatedAt ? new Date(inv.generatedAt).toLocaleDateString("en-IN") : "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="checkin-btn"
                        onClick={() => handlePreviewFromList(inv.bookingId, inv.invoiceNumber)}
                        disabled={loadingListPreview}
                        style={{ marginRight: "8px" }}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="checkin-btn"
                        onClick={() => handleDownloadFromList(inv.bookingId, inv.invoiceNumber)}
                      >
                        Download
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
      )}
    </div>
  );
};

export default GstInvoicePage;
