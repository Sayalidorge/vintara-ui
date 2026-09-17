// src/components/GstInvoicePage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import config from "../config";
import "../css/theme.css";
import "../css/components.css";
import "./GstInvoicePage.css";
import { downloadBlob, downloadCsv } from "../utils/csv";
import { isSuperAdmin } from "../utils/auth";
import ToastContainer, { useToast } from "./common/Toast";

const invoiceFileName = (invoiceNumber) =>
  `${(invoiceNumber || "gst-bill").replace(/\//g, "-")}.pdf`;

const GstInvoicePage = () => {
  const { toasts, showToast, dismissToast } = useToast();
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
      showToast("Enter a booking ID", "warning");
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
      showToast(err.message || "Failed to build preview", "danger");
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
      showToast(err.message || "Failed to generate GST bill", "danger");
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
      showToast(err.message || "Failed to regenerate GST bill", "danger");
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
      showToast(`Invoice emailed to ${emailAddress.trim()}`, "success");
      setShowEmailForm(false);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to email GST bill", "danger");
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
      showToast(err.message || "Failed to download GST bill", "danger");
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
      showToast(err.message || "Failed to download GST bill", "danger");
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
      showToast(err.message || "Failed to load GST bill", "danger");
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
    <div className="gst-invoice-page resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="vt-page-header">
        <h2>GST Invoice</h2>
      </div>

      <div className="gst-tabs">
        <button
          type="button"
          onClick={() => setActiveTab("generate")}
          className={`gst-tab-btn ${activeTab === "generate" ? "gst-tab-btn--active" : ""}`}
        >
          Generate GST Bill
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`gst-tab-btn ${activeTab === "invoices" ? "gst-tab-btn--active" : ""}`}
        >
          All Invoices
        </button>
      </div>

      {activeTab === "generate" && (
      <>
      <div className="gst-card">
        <div className="gst-search-row">
          <div className="gst-field">
            <label>Booking ID</label>
            <input
              type="text"
              value={bookingIdInput}
              onChange={(e) => setBookingIdInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Enter booking ID"
              style={{ width: "220px" }}
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={loading}
            className="vt-btn vt-btn-primary"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {error && <p className="gst-error-text">{error}</p>}

        {booking && (
          <div className="gst-booking-summary">
            <p className="gst-booking-summary-label">
              Booking #{booking.id} — {booking.customerName}
            </p>

            {invoice && !editingInvoice ? (
              <div className="gst-invoice-details">
                <p><strong>Invoice Number:</strong> {invoice.invoiceNumber}</p>
                <p><strong>Generated:</strong> {invoice.generatedAt ? new Date(invoice.generatedAt).toLocaleString() : "-"}</p>
                {invoice.customerCompanyName && (
                  <p><strong>Bill To:</strong> {invoice.customerCompanyName} (GSTIN: {invoice.customerGstin || "-"})</p>
                )}
                {invoice.customerAddress && (
                  <p><strong>Billing Address:</strong> {invoice.customerAddress}</p>
                )}
                <p><strong>Place of Supply:</strong> {invoice.placeOfSupply || "-"}</p>
                {invoice.bookingChangedSinceInvoice && (
                  <p className="gst-warning-text">Note: booking details have changed since this bill was generated.</p>
                )}
                <div className="gst-action-row">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="vt-btn vt-btn-primary"
                  >
                    {downloading ? "Downloading…" : "Download PDF"}
                  </button>
                  {invoice.regenerationAllowed ? (
                    <button
                      type="button"
                      onClick={startEditInvoice}
                      className="vt-btn vt-btn-primary"
                    >
                      Edit / Regenerate
                    </button>
                  ) : (
                    <p className="gst-muted-text">
                      Regeneration window closed — this invoice's data has already been sent for accounting.
                    </p>
                  )}
                  {!showEmailForm && (
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(true)}
                      className="vt-btn vt-btn-secondary"
                    >
                      Email to Customer
                    </button>
                  )}
                </div>

                {showEmailForm && (
                  <div className="gst-email-row">
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="customer@example.com"
                    />
                    <button
                      type="button"
                      onClick={handleEmailInvoice}
                      disabled={emailing || !emailAddress.trim()}
                      className="vt-btn vt-btn-primary"
                    >
                      {emailing ? "Sending…" : "Send"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      disabled={emailing}
                      className="vt-btn vt-btn-purple"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {existingInvoicePreviewUrl && (
                  <iframe
                    title="GST bill"
                    src={existingInvoicePreviewUrl}
                    className="gst-preview-iframe"
                  />
                )}
              </div>
            ) : (
              <div>
                <p className="gst-muted-text" style={{ marginBottom: "10px" }}>
                  {editingInvoice
                    ? `Editing invoice ${invoice.invoiceNumber} — the invoice number stays the same; billing details and amounts will be refreshed from the booking. Regenerable until the night of the 1st of next month.`
                    : "Preview the bill first — once generated, the invoice number is locked and cannot be changed."}
                </p>
                <div className="gst-form-grid">
                  <div className="gst-field">
                    <label>Bill To Company Name (optional)</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="gst-field">
                    <label>GSTIN (optional)</label>
                    <input
                      type="text"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>
                  <div className="gst-field">
                    <label>Place of Supply</label>
                    <input
                      type="text"
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                    />
                  </div>
                  <div className="gst-field gst-field--wide">
                    <label>Billing Address (optional)</label>
                    <textarea
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="gst-action-row">
                  {editingInvoice ? (
                    <>
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        className="vt-btn vt-btn-primary"
                      >
                        {regenerating ? "Saving…" : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditInvoice}
                        disabled={regenerating}
                        className="vt-btn vt-btn-purple"
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
                        className="vt-btn vt-btn-purple"
                      >
                        {previewing ? "Building Preview…" : "Preview Bill"}
                      </button>
                      {previewUrl && (
                        <button
                          type="button"
                          onClick={handleConfirmGenerate}
                          disabled={generating}
                          className="vt-btn vt-btn-primary"
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
          className="gst-modal-overlay"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="gst-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gst-modal-header">
              <h3>
                {invoice ? `GST Bill: ${invoice.invoiceNumber}` : "GST Bill Preview"}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="gst-modal-close"
              >
                ✕
              </button>
            </div>
            <div className="gst-modal-body">
              <iframe
                title="GST bill preview"
                src={previewUrl}
              />
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {activeTab === "invoices" && (
      <div className="gst-card">
        <div className="gst-invoices-toolbar">
          <h3 style={{ margin: 0 }}>All Generated Invoices</h3>
          {!listPreviewUrl && (
          <div className="gst-invoices-filters">
            <label>Month:</label>
            <input
              type="month"
              className="gst-month-input"
              value={invoiceMonth}
              onChange={(e) => setInvoiceMonth(e.target.value)}
            />
            {invoiceMonth && (
              <button
                type="button"
                onClick={() => setInvoiceMonth("")}
                className="vt-btn vt-btn-purple"
              >
                Show All
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchAllInvoices(invoiceMonth)}
              disabled={loadingList}
              className="vt-btn vt-btn-secondary"
            >
              {loadingList ? "Refreshing…" : "Refresh"}
            </button>
            {isSuperAdmin() && (
              <button
                type="button"
                className="export-csv-btn"
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
              >
                Export CSV
              </button>
            )}
          </div>
          )}
        </div>

        {listPreviewUrl ? (
          <div>
            <div className="gst-list-header">
              <h4>GST Bill: {listPreviewInvoiceNumber}</h4>
              <button
                type="button"
                onClick={handleBackToTable}
                className="vt-btn vt-btn-purple"
              >
                ← Back to Table
              </button>
            </div>
            <iframe
              title="GST bill preview"
              src={listPreviewUrl}
              className="gst-preview-iframe"
              style={{ marginTop: 0 }}
            />
          </div>
        ) : (
        <div className="table-wrapper">
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
                <tr><td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>No GST bills generated yet</td></tr>
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
                      <div className="row-actions">
                        <button
                          type="button"
                          className="vt-btn vt-btn-primary"
                          onClick={() => handlePreviewFromList(inv.bookingId, inv.invoiceNumber)}
                          disabled={loadingListPreview}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="vt-btn vt-btn-secondary"
                          onClick={() => handleDownloadFromList(inv.bookingId, inv.invoiceNumber)}
                        >
                          Download
                        </button>
                      </div>
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
