// src/components/CompanySettings.jsx
import React, { useState, useEffect } from "react";
import config from "../config";

const CompanySettings = () => {
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
      alert("Failed to load company GST settings");
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
      alert("Company GST settings saved");
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to save company GST settings");
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
      alert(err.message || "Failed to upload stamp/signature image");
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
      alert(err.message || "Failed to upload logo");
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
      alert(err.message || "Failed to upload payment QR code");
    } finally {
      setUploadingPaymentQr(false);
      e.target.value = "";
    }
  };

  if (loading) return <p style={{ padding: "20px" }}>Loading settings...</p>;

  return (
    <div className="resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <div className="page-header">
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--primary-purple)", textAlign: "left", marginTop: "6px", marginBottom: "20px" }}>Settings</h2>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #eee" }}>
        <button
          type="button"
          onClick={() => setActiveTab("company-gst")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "company-gst" ? "3px solid var(--primary-purple)" : "3px solid transparent",
            fontWeight: "bold",
            fontSize: "14px",
            color: activeTab === "company-gst" ? "var(--primary-purple)" : "#666",
            cursor: "pointer",
          }}
        >
          Company &amp; GST
        </button>
        {/* Future settings tabs (booking policy, notifications, branding,
            etc.) go here as additional buttons + a matching activeTab check
            below — no other restructuring needed. */}
      </div>

      {activeTab === "company-gst" && (
      <div className="user-management-section" style={{ border: "1px solid #ccc", padding: "25px", borderRadius: "6px", marginBottom: "30px", background: "#fff", boxSizing: "border-box", maxWidth: "600px" }}>
        <h3 style={{ marginTop: 0, marginBottom: "20px", color: "#333" }}>Company GST Registration</h3>
        <p style={{ fontSize: "13px", color: "#666", marginTop: "-10px", marginBottom: "20px" }}>
          Printed as the seller on every GST invoice, regardless of which resort the booking is for.
        </p>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Legal Name</label>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Vintara Hospitality Pvt. Ltd."
              style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>GSTIN</label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="15-character GSTIN"
              style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Registered Address</label>
            <textarea
              value={registeredAddress}
              onChange={(e) => setRegisteredAddress(e.target.value)}
              rows={3}
              style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box", fontFamily: "inherit", fontSize: "14px" }}
            />
          </div>

          <div style={{ paddingTop: "8px", borderTop: "1px solid #eee" }}>
            <h4 style={{ margin: "0 0 4px 0", color: "#333", fontSize: "14px" }}>Bank &amp; Payment Details</h4>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 12px 0" }}>
              Printed to the left of the stamp on every invoice.
            </p>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "200px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Account Holder Name</label>
              <input
                type="text"
                value={bankAccountHolderName}
                onChange={(e) => setBankAccountHolderName(e.target.value)}
                style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "200px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "200px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Account Number</label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "160px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>IFSC Code</label>
              <input
                type="text"
                value={bankIfscCode}
                onChange={(e) => setBankIfscCode(e.target.value)}
                style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "160px" }}>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#555" }}>Branch Name</label>
              <input
                type="text"
                value={bankBranchName}
                onChange={(e) => setBankBranchName(e.target.value)}
                style={{ padding: "8px 12px", height: "38px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{ alignSelf: "flex-start", padding: "8px 24px", height: "40px", cursor: "pointer", backgroundColor: "var(--primary-purple)", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>

        <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
          <label style={{ fontWeight: "600", fontSize: "14px", color: "#555", display: "block", marginBottom: "6px" }}>
            Company Logo
          </label>
          <p style={{ fontSize: "13px", color: "#666", marginTop: 0, marginBottom: "12px" }}>
            Shown in the header of every generated GST invoice.
          </p>

          {logoImageUrl && (
            <img
              src={`${config.BASE_URL}${logoImageUrl}`}
              alt="Logo preview"
              style={{ maxHeight: "70px", maxWidth: "220px", display: "block", marginBottom: "12px", border: "1px solid #eee", borderRadius: "4px", padding: "6px" }}
            />
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            onChange={handleLogoFileSelected}
            disabled={uploadingLogo}
          />
          {uploadingLogo && <span style={{ marginLeft: "10px", fontSize: "13px", color: "#666" }}>Uploading…</span>}
        </div>

        <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
          <label style={{ fontWeight: "600", fontSize: "14px", color: "#555", display: "block", marginBottom: "6px" }}>
            Stamp / Signature
          </label>
          <p style={{ fontSize: "13px", color: "#666", marginTop: 0, marginBottom: "12px" }}>
            Embedded into the "Authorized Signatory" section of every generated GST invoice.
          </p>

          {stampSignatureImageUrl && (
            <img
              src={`${config.BASE_URL}${stampSignatureImageUrl}`}
              alt="Stamp / signature preview"
              style={{ maxHeight: "80px", maxWidth: "200px", display: "block", marginBottom: "12px", border: "1px solid #eee", borderRadius: "4px", padding: "6px" }}
            />
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            onChange={handleStampFileSelected}
            disabled={uploadingStamp}
          />
          {uploadingStamp && <span style={{ marginLeft: "10px", fontSize: "13px", color: "#666" }}>Uploading…</span>}
        </div>

        <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
          <label style={{ fontWeight: "600", fontSize: "14px", color: "#555", display: "block", marginBottom: "6px" }}>
            Payment QR Code
          </label>
          <p style={{ fontSize: "13px", color: "#666", marginTop: 0, marginBottom: "12px" }}>
            Shown next to the stamp, under "Scan to Pay", on every generated GST invoice (e.g. export a UPI QR from your banking app).
          </p>

          {paymentQrImageUrl && (
            <img
              src={`${config.BASE_URL}${paymentQrImageUrl}`}
              alt="Payment QR code preview"
              style={{ maxHeight: "120px", maxWidth: "120px", display: "block", marginBottom: "12px", border: "1px solid #eee", borderRadius: "4px", padding: "6px" }}
            />
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            onChange={handlePaymentQrFileSelected}
            disabled={uploadingPaymentQr}
          />
          {uploadingPaymentQr && <span style={{ marginLeft: "10px", fontSize: "13px", color: "#666" }}>Uploading…</span>}
        </div>
      </div>
      )}
    </div>
  );
};

export default CompanySettings;
