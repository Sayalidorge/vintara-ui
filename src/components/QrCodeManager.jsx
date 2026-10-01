// src/components/QrCodeManager.jsx
import React, { useEffect, useRef, useState } from "react";
import Select from "react-select";
import { QRCodeCanvas } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import config from "../config";
import LinksPageContent from "./LinksPageContent";
import { formatDateDMY } from "../utils/date";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";
import "../css/theme.css";
import "../css/components.css";
import "./ManageResorts.css";
import "./QrCodeManager.css";

const TYPE_LABELS = {
  GOOGLE_MAPS: "Google Maps",
  INSTAGRAM: "Instagram",
  REVIEW_URL: "Review Page",
  LINKS_BUNDLE: "Links Page",
};

const TYPE_ORDER = ["GOOGLE_MAPS", "INSTAGRAM", "REVIEW_URL", "LINKS_BUNDLE"];

const TYPE_PLACEHOLDERS = {
  GOOGLE_MAPS: "https://maps.app.goo.gl/...",
  INSTAGRAM: "https://instagram.com/...",
  REVIEW_URL: "https://g.page/r/.../review",
};

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
].map((label, i) => ({ value: i + 1, label }));

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => ({
  value: y,
  label: String(y),
}));

const CHART_COLOR = "#008080";

const QrCodeManager = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [activeTab, setActiveTab] = useState("manage"); // "manage" | "links" | "tracking"
  const [showLinksPreview, setShowLinksPreview] = useState(false);
  const [allResorts, setAllResorts] = useState([]);
  const [selectedResort, setSelectedResort] = useState(null);
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [urlDrafts, setUrlDrafts] = useState({}); // { [type]: string }
  const [colorDrafts, setColorDrafts] = useState({}); // { [type]: { fgColor, bgColor } }
  const [linksDraft, setLinksDraft] = useState([]); // [{label, url}] - LINKS_BUNDLE only
  const [savingType, setSavingType] = useState(null);
  const [uploadingLogoType, setUploadingLogoType] = useState(null);
  const canvasRefs = useRef({}); // { [type]: HTMLCanvasElement }

  const [trackingMonth, setTrackingMonth] = useState(new Date().getMonth() + 1);
  const [trackingYear, setTrackingYear] = useState(CURRENT_YEAR);
  const [trackingRows, setTrackingRows] = useState([]);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const [analyticsType, setAnalyticsType] = useState("GOOGLE_MAPS");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/resorts/active`, {
          headers: config.getHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch resorts");
        const data = await res.json();
        const options = data.map((r) => ({ value: r.id, label: r.name }));
        setAllResorts(options);
        if (options.length > 0) setSelectedResort(options[0]);
      } catch (err) {
        console.error(err);
        showToast("Error fetching resorts", "danger");
      }
    };
    fetchResorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchQrCodes = async () => {
    if (!selectedResort) return;
    try {
      setLoading(true);
      const res = await fetch(`${config.BASE_URL}/api/qr-codes?resortId=${selectedResort.value}`, {
        headers: config.getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch QR codes");
      const data = await res.json();
      setQrCodes(data);

      const urls = {};
      const colors = {};
      data.forEach((qr) => {
        urls[qr.type] = qr.targetUrl || "";
        colors[qr.type] = { fgColor: qr.fgColor || "#000000", bgColor: qr.bgColor || "#FFFFFF" };
        if (qr.type === "LINKS_BUNDLE") {
          setLinksDraft(qr.linksItems && qr.linksItems.length > 0 ? qr.linksItems : [{ label: "", url: "" }]);
        }
      });
      setUrlDrafts(urls);
      setColorDrafts(colors);
    } catch (err) {
      console.error(err);
      showToast("Error fetching QR codes", "danger");
      setQrCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQrCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResort]);

  const fetchTracking = async () => {
    if (!selectedResort) return;
    try {
      setTrackingLoading(true);
      const res = await fetch(
        `${config.BASE_URL}/api/qr-codes/tracking?resortId=${selectedResort.value}&year=${trackingYear}&month=${trackingMonth}`,
        { headers: config.getHeaders() }
      );
      if (!res.ok) throw new Error("Failed to fetch tracking report");
      const data = await res.json();
      setTrackingRows(data);
    } catch (err) {
      console.error(err);
      showToast("Error fetching tracking report", "danger");
      setTrackingRows([]);
    } finally {
      setTrackingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "tracking") fetchTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResort, activeTab, trackingYear, trackingMonth]);

  const fetchAnalytics = async () => {
    const qr = qrCodes.find((q) => q.type === analyticsType);
    if (!qr || !qr.id) {
      setAnalyticsData(null);
      return;
    }
    try {
      setAnalyticsLoading(true);
      const res = await fetch(
        `${config.BASE_URL}/api/qr-codes/${qr.id}/analytics?year=${trackingYear}&month=${trackingMonth}`,
        { headers: config.getHeaders() }
      );
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error(err);
      showToast("Error fetching analytics", "danger");
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "tracking") fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, analyticsType, trackingYear, trackingMonth, qrCodes]);

  const handleSave = async (type) => {
    const targetUrl = (urlDrafts[type] || "").trim();
    if (!targetUrl) {
      showToast("Enter a URL first.", "warning");
      return;
    }
    if (savingType) return;
    setSavingType(type);
    try {
      const colors = colorDrafts[type] || {};
      const res = await fetch(
        `${config.BASE_URL}/api/qr-codes/${type}?resortId=${selectedResort.value}`,
        {
          method: "PUT",
          headers: config.getHeaders(),
          body: JSON.stringify({ targetUrl, fgColor: colors.fgColor, bgColor: colors.bgColor }),
        }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody || "Failed to save QR code");
      }
      showToast("QR code saved.", "success");
      await fetchQrCodes();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to save QR code.", "danger");
    } finally {
      setSavingType(null);
    }
  };

  const handleSaveLinks = async () => {
    const cleaned = linksDraft
      .map((row) => ({ label: (row.label || "").trim(), url: (row.url || "").trim() }))
      .filter((row) => row.label && row.url);
    if (cleaned.length === 0) {
      showToast("Add at least one link (label + URL).", "warning");
      return;
    }
    if (savingType) return;
    setSavingType("LINKS_BUNDLE");
    try {
      const res = await fetch(`${config.BASE_URL}/api/qr-codes/links?resortId=${selectedResort.value}`, {
        method: "PUT",
        headers: config.getHeaders(),
        body: JSON.stringify(cleaned),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody || "Failed to save links page");
      }
      showToast("Links page saved.", "success");
      await fetchQrCodes();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to save links page.", "danger");
    } finally {
      setSavingType(null);
    }
  };

  // Shared by all 3 image-upload buttons (QR logo, links-page logo,
  // links-page background) - same FormData/strip-Content-Type pattern as
  // CompanySettings.jsx's uploadImage.
  const handleImageUpload = async (type, file, endpoint, uploadKey, successLabel) => {
    if (!file || !selectedResort) return;
    setUploadingLogoType(uploadKey);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const headers = { ...config.getHeaders() };
      delete headers["Content-Type"];

      const res = await fetch(
        `${config.BASE_URL}/api/qr-codes/${type}/${endpoint}?resortId=${selectedResort.value}`,
        { method: "POST", headers, body: formData }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody || `Failed to upload ${successLabel.toLowerCase()}`);
      }
      showToast(`${successLabel} uploaded.`, "success");
      await fetchQrCodes();
    } catch (err) {
      console.error(err);
      showToast(err.message || `Failed to upload ${successLabel.toLowerCase()}.`, "danger");
    } finally {
      setUploadingLogoType(null);
    }
  };

  const handleDownload = (type) => {
    const canvas = canvasRefs.current[type];
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    const resortLabel = (selectedResort?.label || "resort").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    link.download = `qr-${resortLabel}-${type.toLowerCase()}.png`;
    link.click();
  };

  const chartData = (map) =>
    Object.entries(map || {}).map(([name, value]) => ({ name, value }));

  const analyticsTypeOptions = TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABELS[t] }));

  return (
    <div className="resorts-page-container" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <h2 className="qr-page-title">QR Codes</h2>

      <div className="vt-tabs">
        <button
          type="button"
          className={`vt-tab ${activeTab === "manage" ? "active" : ""}`}
          onClick={() => setActiveTab("manage")}
        >
          Manage
        </button>
        <button
          type="button"
          className={`vt-tab ${activeTab === "links" ? "active" : ""}`}
          onClick={() => setActiveTab("links")}
        >
          Links Page
        </button>
        <button
          type="button"
          className={`vt-tab ${activeTab === "tracking" ? "active" : ""}`}
          onClick={() => setActiveTab("tracking")}
        >
          Tracking
        </button>
      </div>

      <div className="resort-form-card qr-resort-select-card">
        <label>Resort</label>
        <Select
          options={allResorts}
          value={selectedResort}
          onChange={setSelectedResort}
          isSearchable
          classNamePrefix="react-select"
          className="react-select-container"
          menuPortalTarget={menuPortalTarget}
          menuPosition={menuPosition}
          styles={themedSelectStyles()}
        />
      </div>

      {activeTab === "manage" &&
        (loading ? (
          <p>Loading QR codes...</p>
        ) : (
          <div className="qr-code-grid">
            {qrCodes
              .filter((qr) => qr.type !== "LINKS_BUNDLE")
              .map((qr) => {
                const scanUrl = qr.code ? `${config.BASE_URL}/api/qr/r/${qr.code}` : null;
                const colors = colorDrafts[qr.type] || { fgColor: "#000000", bgColor: "#FFFFFF" };

                return (
                  <div key={qr.type} className="resort-form-card qr-code-card">
                    <h3>{TYPE_LABELS[qr.type] || qr.type}</h3>

                    <div className="form-field">
                      <label>Target URL</label>
                      <input
                        type="text"
                        value={urlDrafts[qr.type] || ""}
                        onChange={(e) =>
                          setUrlDrafts((prev) => ({ ...prev, [qr.type]: e.target.value }))
                        }
                        placeholder={TYPE_PLACEHOLDERS[qr.type] || "https://..."}
                      />
                    </div>

                    <div className="qr-color-row">
                      <label className="qr-color-field">
                        Color
                        <input
                          type="color"
                          value={colors.fgColor}
                          onChange={(e) =>
                            setColorDrafts((prev) => ({
                              ...prev,
                              [qr.type]: { ...colors, fgColor: e.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="qr-color-field">
                        Background
                        <input
                          type="color"
                          value={colors.bgColor}
                          onChange={(e) =>
                            setColorDrafts((prev) => ({
                              ...prev,
                              [qr.type]: { ...colors, bgColor: e.target.value },
                            }))
                          }
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      className="vt-btn vt-btn-primary"
                      onClick={() => handleSave(qr.type)}
                      disabled={savingType === qr.type}
                    >
                      {savingType === qr.type ? "Saving..." : qr.code ? "Update" : "Save"}
                    </button>

                    {scanUrl && (
                      <div className="qr-code-output">
                        <QRCodeCanvas
                          value={scanUrl}
                          size={140}
                          level="H"
                          fgColor={colors.fgColor}
                          bgColor={colors.bgColor}
                          imageSettings={
                            qr.logoImageUrl
                              ? {
                                  src: `${config.BASE_URL}${qr.logoImageUrl}`,
                                  height: 32,
                                  width: 32,
                                  excavate: true,
                                  crossOrigin: "anonymous",
                                }
                              : undefined
                          }
                          ref={(el) => (canvasRefs.current[qr.type] = el)}
                        />
                        <p className="qr-code-stats">
                          Scans: <strong>{qr.scanCount}</strong>
                          {" · "}
                          Last scanned: {qr.lastScannedAt ? formatDateDMY(qr.lastScannedAt) : "Never"}
                        </p>

                        <div className="qr-code-actions-row">
                          <button
                            type="button"
                            className="vt-btn vt-btn-secondary"
                            onClick={() => handleDownload(qr.type)}
                          >
                            Download PNG
                          </button>
                          <label className="qr-logo-upload-btn">
                            {uploadingLogoType === `${qr.type}:logo` ? "Uploading..." : "QR Logo"}
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              disabled={!!uploadingLogoType}
                              onChange={(e) =>
                                handleImageUpload(qr.type, e.target.files?.[0], "logo", `${qr.type}:logo`, "QR logo")
                              }
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}

      {activeTab === "links" &&
        (loading ? (
          <p>Loading...</p>
        ) : (
          (() => {
            const qr = qrCodes.find((q) => q.type === "LINKS_BUNDLE");
            if (!qr) return null;
            const scanUrl = qr.code ? `${config.BASE_URL}/api/qr/r/${qr.code}` : null;
            const colors = colorDrafts.LINKS_BUNDLE || { fgColor: "#000000", bgColor: "#FFFFFF" };
            const previewItems = linksDraft
              .map((row) => ({ label: (row.label || "").trim(), url: (row.url || "").trim() }))
              .filter((row) => row.label && row.url);

            return (
              <div className="resort-form-card qr-links-page-card">
                <h3>Links Page</h3>

                <div className="qr-links-editor">
                  {linksDraft.map((row, idx) => (
                    <div key={idx} className="qr-links-editor-row">
                      <input
                        type="text"
                        placeholder="Label (e.g. Menu)"
                        value={row.label}
                        onChange={(e) =>
                          setLinksDraft((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r))
                          )
                        }
                      />
                      <input
                        type="text"
                        placeholder="https://..."
                        value={row.url}
                        onChange={(e) =>
                          setLinksDraft((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, url: e.target.value } : r))
                          )
                        }
                      />
                      <button
                        type="button"
                        className="qr-links-editor-remove"
                        onClick={() => setLinksDraft((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove link"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="vt-btn vt-btn-secondary"
                    onClick={() => setLinksDraft((prev) => [...prev, { label: "", url: "" }])}
                  >
                    + Add Link
                  </button>
                </div>

                <div className="qr-color-row">
                  <label className="qr-color-field">
                    Color
                    <input
                      type="color"
                      value={colors.fgColor}
                      onChange={(e) =>
                        setColorDrafts((prev) => ({
                          ...prev,
                          LINKS_BUNDLE: { ...colors, fgColor: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="qr-color-field">
                    Background
                    <input
                      type="color"
                      value={colors.bgColor}
                      onChange={(e) =>
                        setColorDrafts((prev) => ({
                          ...prev,
                          LINKS_BUNDLE: { ...colors, bgColor: e.target.value },
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="qr-code-actions-row">
                  <button
                    type="button"
                    className="vt-btn vt-btn-primary"
                    onClick={handleSaveLinks}
                    disabled={savingType === "LINKS_BUNDLE"}
                  >
                    {savingType === "LINKS_BUNDLE" ? "Saving..." : qr.code ? "Update" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="vt-btn vt-btn-purple"
                    onClick={() => setShowLinksPreview(true)}
                  >
                    Preview
                  </button>
                </div>

                {scanUrl && (
                  <div className="qr-code-output">
                    <QRCodeCanvas
                      value={scanUrl}
                      size={140}
                      level="H"
                      fgColor={colors.fgColor}
                      bgColor={colors.bgColor}
                      imageSettings={
                        qr.logoImageUrl
                          ? {
                              src: `${config.BASE_URL}${qr.logoImageUrl}`,
                              height: 32,
                              width: 32,
                              excavate: true,
                              crossOrigin: "anonymous",
                            }
                          : undefined
                      }
                      ref={(el) => (canvasRefs.current.LINKS_BUNDLE = el)}
                    />
                    <p className="qr-code-stats">
                      Scans: <strong>{qr.scanCount}</strong>
                      {" · "}
                      Last scanned: {qr.lastScannedAt ? formatDateDMY(qr.lastScannedAt) : "Never"}
                    </p>

                    <div className="qr-code-actions-row">
                      <button
                        type="button"
                        className="vt-btn vt-btn-secondary"
                        onClick={() => handleDownload("LINKS_BUNDLE")}
                      >
                        Download PNG
                      </button>
                      <label className="qr-logo-upload-btn">
                        {uploadingLogoType === "LINKS_BUNDLE:logo" ? "Uploading..." : "QR Logo"}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={!!uploadingLogoType}
                          onChange={(e) =>
                            handleImageUpload("LINKS_BUNDLE", e.target.files?.[0], "logo", "LINKS_BUNDLE:logo", "QR logo")
                          }
                        />
                      </label>
                    </div>

                    <div className="qr-code-actions-row">
                      <label className="qr-logo-upload-btn">
                        {uploadingLogoType === "LINKS_BUNDLE:page-logo" ? "Uploading..." : "Page Logo"}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={!!uploadingLogoType}
                          onChange={(e) =>
                            handleImageUpload(
                              "LINKS_BUNDLE", e.target.files?.[0], "page-logo", "LINKS_BUNDLE:page-logo", "Page logo"
                            )
                          }
                        />
                      </label>
                      <label className="qr-logo-upload-btn">
                        {uploadingLogoType === "LINKS_BUNDLE:page-background" ? "Uploading..." : "Page Background"}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={!!uploadingLogoType}
                          onChange={(e) =>
                            handleImageUpload(
                              "LINKS_BUNDLE", e.target.files?.[0], "page-background",
                              "LINKS_BUNDLE:page-background", "Background image"
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}

                {showLinksPreview && (
                  <div className="modal-overlay" onClick={() => setShowLinksPreview(false)}>
                    <div className="qr-preview-modal" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="qr-preview-close"
                        onClick={() => setShowLinksPreview(false)}
                        aria-label="Close preview"
                      >
                        ×
                      </button>
                      <LinksPageContent
                        resortName={selectedResort?.label}
                        logoUrl={qr.pageLogoImageUrl ? `${config.BASE_URL}${qr.pageLogoImageUrl}` : null}
                        backgroundUrl={
                          qr.pageBackgroundImageUrl ? `${config.BASE_URL}${qr.pageBackgroundImageUrl}` : null
                        }
                        items={previewItems}
                        wrapperStyle={{ minHeight: 480, height: 480, borderRadius: 16 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ))}

      {activeTab === "tracking" && (
        <>
          <div className="resort-form-card qr-tracking-card">
            <div className="qr-tracking-filters">
              <Select
                options={MONTH_OPTIONS}
                value={MONTH_OPTIONS.find((o) => o.value === trackingMonth)}
                onChange={(opt) => setTrackingMonth(opt.value)}
                isSearchable={false}
                classNamePrefix="react-select"
                className="react-select-container qr-month-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
              <Select
                options={YEAR_OPTIONS}
                value={YEAR_OPTIONS.find((o) => o.value === trackingYear)}
                onChange={(opt) => setTrackingYear(opt.value)}
                isSearchable={false}
                classNamePrefix="react-select"
                className="react-select-container qr-year-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
            </div>

            {trackingLoading ? (
              <p>Loading tracking report...</p>
            ) : (
              <div className="qr-tracking-table-wrapper">
                <table className="qr-tracking-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {TYPE_ORDER.map((type) => (
                        <th key={type}>{TYPE_LABELS[type]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trackingRows.map((row) => (
                      <tr key={row.date}>
                        <td>{formatDateDMY(row.date)}</td>
                        {TYPE_ORDER.map((type) => (
                          <td key={type}>{row.counts?.[type] || 0}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="resort-form-card qr-analytics-card">
            <div className="qr-analytics-header">
              <h3>Scan Analytics</h3>
              <Select
                options={analyticsTypeOptions}
                value={analyticsTypeOptions.find((o) => o.value === analyticsType)}
                onChange={(opt) => setAnalyticsType(opt.value)}
                isSearchable={false}
                classNamePrefix="react-select"
                className="react-select-container qr-analytics-type-select"
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
            </div>

            {analyticsLoading ? (
              <p>Loading analytics...</p>
            ) : !analyticsData || Object.keys(analyticsData.byDevice || {}).length === 0 ? (
              <p className="qr-analytics-empty">No scans this month for {TYPE_LABELS[analyticsType]}.</p>
            ) : (
              <div className="qr-analytics-charts">
                {[
                  { title: "By Device", data: chartData(analyticsData.byDevice) },
                  { title: "By Browser", data: chartData(analyticsData.byBrowser) },
                  { title: "By Location", data: chartData(analyticsData.byLocation) },
                ].map(({ title, data }) => (
                  <div key={title} className="qr-analytics-chart">
                    <h4>{title}</h4>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--qr-chart-grid)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "var(--qr-chart-axis)" }}
                          axisLine={{ stroke: "var(--qr-chart-axis-line)" }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "var(--qr-chart-axis)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip />
                        <Bar dataKey="value" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default QrCodeManager;
