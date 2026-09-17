// src/components/CompanySettings.jsx
import React, { useState, useEffect } from "react";
import config from "../config";
import "../css/theme.css";
import "../css/components.css";
import "./CompanySettings.css";
import ToastContainer, { useToast } from "./common/Toast";

const CompanySettings = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [legalName, setLegalName] = useState("");
  const [gstin, setGstin] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountHolderName, setBankAccountHolderName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [bankBranchName, setBankBranchName] = useState("");
  const [stampSignatureImageUrl, setStampSignatureImageUrl] = useState(null);
  const [logoImageUrl, setLogoImageUrl] = useState(null);
  const [paymentQrImageUrl, setPaymentQrImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPaymentQr, setUploadingPaymentQr] = useState(false);

  // Tabbed so future settings sections (booking policy, notifications,
  // branding, etc.) can be added as new tabs without restructuring this
  // page again — same tab-bar pattern as GstInvoicePage.jsx.
  const [activeTab, setActiveTab] = useState("company-gst");

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${config.BASE_URL}/api/settings/company-gst`, {
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch company GST settings");
      const data = await res.json();
      setLegalName(data.legalName || "");
      setGstin(data.gstin || "");
      setRegisteredAddress(data.registeredAddress || "");
      setBankName(data.bankName || "");
      setBankAccountHolderName(data.bankAccountHolderName || "");
      setBankAccountNumber(data.bankAccountNumber || "");
      setBankIfscCode(data.bankIfscCode || "");
      setBankBranchName(data.bankBranchName || "");
      setStampSignatureImageUrl(data.stampSignatureImageUrl || null);
      setLogoImageUrl(data.logoImageUrl || null);
      setPaymentQrImageUrl(data.paymentQrImageUrl || null);
    } catch (err) {
      console.error(err);
      showToast("Failed to load company GST settings", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${config.BASE_URL}/api/settings/company-gst`, {
        method: "PUT",
        headers: config.getHeaders(),
        body: JSON.stringify({
          legalName,
          gstin,
          registeredAddress,
          bankName,
          bankAccountHolderName,
          bankAccountNumber,
          bankIfscCode,
          bankBranchName,
        }),
      });
      if (!res.ok) throw new Error("Failed to save company GST settings");
      showToast("Company GST settings saved", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to save company GST settings", "danger");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file, endpoint) => {
    const formData = new FormData();
    formData.append("file", file);

    // Content-Type must come from the browser (multipart boundary), not
    // config.getHeaders()'s application/json default — same fix used for
    // the guest-document upload in ManageCheckInDrawer.jsx.
    const headers = { ...config.getHeaders() };
    delete headers["Content-Type"];

    const res = await fetch(`${config.BASE_URL}/api/settings/company-gst/${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload image");
    return res.json();
  };

  const handleStampFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingStamp(true);
    try {
      const data = await uploadImage(file, "stamp-signature");
      setStampSignatureImageUrl(data.stampSignatureImageUrl || null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to upload stamp/signature image", "danger");
    } finally {
      setUploadingStamp(false);
      e.target.value = "";
    }
  };

  const handleLogoFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const data = await uploadImage(file, "logo");
      setLogoImageUrl(data.logoImageUrl || null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to upload logo", "danger");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handlePaymentQrFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPaymentQr(true);
    try {
      const data = await uploadImage(file, "payment-qr");
      setPaymentQrImageUrl(data.paymentQrImageUrl || null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to upload payment QR code", "danger");
    } finally {
      setUploadingPaymentQr(false);
      e.target.value = "";
    }
  };

  if (loading) return <p style={{ padding: "20px" }}>Loading settings...</p>;

  return (
    <div className="company-settings-page resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="vt-page-header">
        <h2>Settings</h2>
      </div>

      <div className="cs-tabs">
        <button
          type="button"
          onClick={() => setActiveTab("company-gst")}
          className={`cs-tab-btn ${activeTab === "company-gst" ? "cs-tab-btn--active" : ""}`}
        >
          Company &amp; GST
        </button>
        {/* Future settings tabs (booking policy, notifications, branding,
            etc.) go here as additional buttons + a matching activeTab check
            below — no other restructuring needed. */}
      </div>

      {activeTab === "company-gst" && (
      <div className="cs-card">
        <h3>Company GST Registration</h3>
        <p>
          Printed as the seller on every GST invoice, regardless of which resort the booking is for.
        </p>

        <form onSubmit={handleSave} className="cs-form">
          <div className="cs-field">
            <label>Legal Name</label>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Vintara Hospitality Pvt. Ltd."
            />
          </div>

          <div className="cs-field">
            <label>GSTIN</label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="15-character GSTIN"
            />
          </div>

          <div className="cs-field">
            <label>Registered Address</label>
            <textarea
              value={registeredAddress}
              onChange={(e) => setRegisteredAddress(e.target.value)}
              rows={5}
            />
          </div>

          <div className="cs-section-divider">
            <h4>Bank &amp; Payment Details</h4>
            <p>Printed to the left of the stamp on every invoice.</p>
          </div>

          <div className="cs-field-row">
            <div className="cs-field">
              <label>Account Holder Name</label>
              <input
                type="text"
                value={bankAccountHolderName}
                onChange={(e) => setBankAccountHolderName(e.target.value)}
              />
            </div>
            <div className="cs-field">
              <label>Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
          </div>

          <div className="cs-field-row">
            <div className="cs-field">
              <label>Account Number</label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
              />
            </div>
            <div className="cs-field">
              <label>IFSC Code</label>
              <input
                type="text"
                value={bankIfscCode}
                onChange={(e) => setBankIfscCode(e.target.value)}
              />
            </div>
            <div className="cs-field">
              <label>Branch Name</label>
              <input
                type="text"
                value={bankBranchName}
                onChange={(e) => setBankBranchName(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="vt-btn vt-btn-primary"
            style={{ alignSelf: "flex-start" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>

        <div className="cs-upload-section">
          <label>Company Logo</label>
          <p>Shown in the header of every generated GST invoice.</p>

          {logoImageUrl && (
            <img
              src={`${config.BASE_URL}${logoImageUrl}`}
              alt="Logo preview"
              className="cs-upload-preview"
              style={{ maxHeight: "70px", maxWidth: "220px" }}
            />
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            onChange={handleLogoFileSelected}
            disabled={uploadingLogo}
          />
          {uploadingLogo && <span className="cs-uploading-text">Uploading…</span>}
        </div>

        <div className="cs-upload-section">
          <label>Stamp / Signature</label>
          <p>Embedded into the "Authorized Signatory" section of every generated GST invoice.</p>

          {stampSignatureImageUrl && (
            <img
              src={`${config.BASE_URL}${stampSignatureImageUrl}`}
              alt="Stamp / signature preview"
              className="cs-upload-preview"
              style={{ maxHeight: "80px", maxWidth: "200px" }}
            />
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            onChange={handleStampFileSelected}
            disabled={uploadingStamp}
          />
          {uploadingStamp && <span className="cs-uploading-text">Uploading…</span>}
        </div>

        <div className="cs-upload-section">
          <label>Payment QR Code</label>
          <p>Shown next to the stamp, under "Scan to Pay", on every generated GST invoice (e.g. export a UPI QR from your banking app).</p>

          {paymentQrImageUrl && (
            <img
              src={`${config.BASE_URL}${paymentQrImageUrl}`}
              alt="Payment QR code preview"
              className="cs-upload-preview"
              style={{ maxHeight: "120px", maxWidth: "120px" }}
            />
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            onChange={handlePaymentQrFileSelected}
            disabled={uploadingPaymentQr}
          />
          {uploadingPaymentQr && <span className="cs-uploading-text">Uploading…</span>}
        </div>
      </div>
      )}
    </div>
  );
};

export default CompanySettings;
