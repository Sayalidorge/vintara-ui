// src/components/AdminReviewsDashboard.jsx
import React, { useEffect, useState } from "react";
import config from "../config";
import "../css/theme.css";
import "../css/components.css";
import "./AdminReviewsDashboard.css";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatDateDMY, toLocalDateStr } from "../utils/date";
import { getUserRole } from "../utils/auth";
import { menuPortalTarget, menuPosition, themedSelectStyles } from "../utils/reactSelectTheme";
import ToastContainer, { useToast } from "./common/Toast";
import { useConfirm } from "./common/useConfirm";
import {
  getReviews,
  approveReply,
  discardDraft,
  regenerateDraft,
  getTemplates,
  saveTemplate,
  deactivateTemplate,
  getAverageRatings,
} from "../services/ReviewService";

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
  { value: "NO_REPLY", label: "No reply yet" },
  { value: "AUTO_SENT", label: "Auto-sent" },
  { value: "PENDING_APPROVAL", label: "Pending approval" },
  { value: "SENT", label: "Sent" },
  { value: "DISCARDED", label: "Discarded" },
  { value: "FAILED", label: "Failed" },
];

const StatusBadge = ({ status }) => {
  const cls = {
    NO_REPLY: "neutral",
    AUTO_SENT: "success",
    PENDING_APPROVAL: "warn",
    SENT: "blue",
    DISCARDED: "neutral",
    FAILED: "danger",
  }[status] || "neutral";
  const label = STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
  return <span className={`review-badge review-badge--${cls}`}>{label}</span>;
};

const Stars = ({ n }) => (
  <span className={`review-stars ${n <= 3 ? "review-stars--low" : "review-stars--high"}`}>
    {"★".repeat(n)}
    <span className="review-stars-empty">{"★".repeat(5 - n)}</span>
  </span>
);

// Dual-handle 1-5 star range filter. Two overlapping native <input type="range">
// elements sharing one track (the standard no-dependency way to build a range
// slider) rather than pulling in a slider library - this app already prefers
// plain HTML controls (no table/slider/toast lib in use anywhere else either).
const StarRangeSlider = ({ min, max, onChange }) => {
  const pct = (v) => ((v - 1) / 4) * 100;

  const handleMin = (e) => {
    const v = Math.min(Number(e.target.value), max);
    onChange(v, max);
  };
  const handleMax = (e) => {
    const v = Math.max(Number(e.target.value), min);
    onChange(min, v);
  };

  return (
    <div className="star-range">
      <div className="star-range-track">
        <div
          className="star-range-fill"
          style={{ left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%` }}
        />
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={min}
        onChange={handleMin}
        className="star-range-input"
        aria-label="Minimum star rating"
      />
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={max}
        onChange={handleMax}
        className="star-range-input"
        aria-label="Maximum star rating"
      />
    </div>
  );
};

const AdminReviewsDashboard = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const role = getUserRole();
  // This page is reachable by every role via "view_reviews" (see
  // PermissionService.java), but only SUPER_ADMIN/SUPER_USER can actually
  // reply/manage - ADMIN and everyone else gets a read-only view. Matches
  // the same role split enforced server-side on every write endpoint in
  // ReviewManagementController.
  const canManage = role === "SUPER_ADMIN" || role === "SUPER_USER";
  // Stricter than canManage - a resort-by-resort rating breakdown is
  // business-sensitive in a way an individual review list isn't, so this
  // stays SUPER_ADMIN-only, matching the backend endpoint's own gating.
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState("REVIEWS");

  // --- Average rating summary (SUPER_ADMIN only) ---
  const [ratingSummary, setRatingSummary] = useState(null);
  const [ratingSummaryLoading, setRatingSummaryLoading] = useState(false);

  // --- Reviews tab state ---
  const [resorts, setResorts] = useState([]);
  const [selectedResort, setSelectedResort] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [ratingMin, setRatingMin] = useState(1);
  const [ratingMax, setRatingMax] = useState(5);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [busyIds, setBusyIds] = useState(new Set());

  // --- Templates tab state ---
  const [templates, setTemplates] = useState([]);
  const [newTemplateText, setNewTemplateText] = useState("");
  const [newTemplateAudience, setNewTemplateAudience] = useState("WITH_COMMENT");
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const res = await fetch(`${config.BASE_URL}/api/resorts/resort-names-drop-down`, { headers: config.getHeaders() });
        const data = await res.json();
        setResorts(data.map((r) => ({ value: r.id, label: r.name })));
      } catch (err) {
        console.error("Failed to fetch resorts", err);
      }
    };
    fetchResorts();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [selectedResort, statusFilter, ratingMin, ratingMax, fromDate, toDate]);

  const fetchReviews = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReviews(
        {
          resortId: selectedResort?.value,
          status: statusFilter?.value,
          ratingMin,
          ratingMax,
          fromDate: fromDate ? toLocalDateStr(fromDate) : undefined,
          toDate: toDate ? toLocalDateStr(toDate) : undefined,
        },
        page,
        PAGE_SIZE
      );
      setReviews(data?.content || []);
      setTotalPages(data?.totalPages ?? 0);
      setTotalElements(data?.totalElements ?? 0);
    } catch (err) {
      console.error(err);
      showToast(err.message, "danger");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResort, statusFilter, ratingMin, ratingMax, fromDate, toDate, page]);

  // Deliberately NOT scoped to the page's own resort/status/date filters -
  // this is meant to read like an inbox badge ("N things need a reply,
  // total"), not "pending within whatever you're currently browsing".
  const fetchPendingCount = React.useCallback(async () => {
    try {
      const data = await getReviews({ status: "PENDING_APPROVAL" }, 0, 1);
      setPendingCount(data?.totalElements ?? 0);
    } catch (err) {
      console.error("Failed to fetch pending reply count", err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "REVIEWS") {
      fetchReviews();
      fetchPendingCount();
    }
  }, [activeTab, fetchReviews, fetchPendingCount]);

  useEffect(() => {
    if (activeTab !== "REVIEWS" || !isSuperAdmin) return;
    const fetchRatingSummary = async () => {
      setRatingSummaryLoading(true);
      try {
        setRatingSummary(await getAverageRatings());
      } catch (err) {
        console.error("Failed to fetch rating summary", err);
      } finally {
        setRatingSummaryLoading(false);
      }
    };
    fetchRatingSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isSuperAdmin]);

  const resetFilters = () => {
    setSelectedResort(null);
    setStatusFilter(null);
    setRatingMin(1);
    setRatingMax(5);
    setFromDate(null);
    setToDate(null);
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      setTemplates(await getTemplates());
    } catch (err) {
      console.error(err);
      showToast(err.message, "danger");
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "TEMPLATES" && canManage) fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const withBusy = async (id, fn) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openDraft = (review) => {
    setExpandedId(review.id);
    // aiDraftText for a Gemini draft, replyText for anything already
    // rendered/sent (a dry-run template render, or an already-sent reply
    // being corrected) - blank otherwise, for a fully manual reply. This is
    // the one always-available fallback: if Gemini/templates aren't working,
    // staff can still type and send a reply by hand.
    setDraftText(review.aiDraftText || review.replyText || "");
  };

  const closeDraft = () => {
    setExpandedId(null);
    setDraftText("");
  };

  const handleSend = async (review) => {
    if (!draftText.trim()) {
      return showToast("Reply can't be empty", "warning");
    }
    const ok = await confirm({
      title: "Send this reply?",
      message: "This will post publicly to Google as your business's reply. This can't be undone.",
      confirmLabel: "Send",
    });
    if (!ok) return;
    await withBusy(review.id, async () => {
      try {
        const updated = await approveReply(review.id, draftText.trim());
        setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)));
        showToast("Reply sent", "success");
        closeDraft();
        fetchPendingCount();
      } catch (err) {
        console.error(err);
        showToast(err.message, "danger");
      }
    });
  };

  const handleDiscard = async (review) => {
    const ok = await confirm({
      title: "Discard this reply?",
      message: "This reply will be discarded without sending.",
      confirmLabel: "Discard",
      danger: true,
    });
    if (!ok) return;
    await withBusy(review.id, async () => {
      try {
        const updated = await discardDraft(review.id, "");
        setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)));
        showToast("Draft discarded", "success");
        closeDraft();
        fetchPendingCount();
      } catch (err) {
        console.error(err);
        showToast(err.message, "danger");
      }
    });
  };

  const handleRegenerate = async (review) => {
    await withBusy(review.id, async () => {
      try {
        const updated = await regenerateDraft(review.id);
        setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)));
        setDraftText(updated.aiDraftText || "");
        showToast("New draft generated", "success");
      } catch (err) {
        console.error(err);
        showToast(err.message, "danger");
      }
    });
  };

  const handleAddTemplate = async () => {
    if (!newTemplateText.trim()) return;
    try {
      await saveTemplate({ text: newTemplateText.trim(), audience: newTemplateAudience, active: true });
      setNewTemplateText("");
      fetchTemplates();
      showToast("Template added", "success");
    } catch (err) {
      showToast(err.message, "danger");
    }
  };

  const handleToggleTemplate = async (template) => {
    try {
      if (template.active) {
        await deactivateTemplate(template.id);
      } else {
        await saveTemplate({ ...template, active: true });
      }
      fetchTemplates();
    } catch (err) {
      showToast(err.message, "danger");
    }
  };

  return (
    <div className="admin-reviews-dashboard" style={{ padding: "0px 20px 20px 20px", boxSizing: "border-box" }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {ConfirmDialogElement}

      <div className="vt-page-header">
        <h2>Reviews</h2>
      </div>

      <div className="review-tabs">
        <button
          type="button"
          className={`review-tab ${activeTab === "REVIEWS" ? "review-tab--active" : ""}`}
          onClick={() => setActiveTab("REVIEWS")}
        >
          Reviews
        </button>
        {canManage && (
          <button
            type="button"
            className={`review-tab ${activeTab === "TEMPLATES" ? "review-tab--active" : ""}`}
            onClick={() => setActiveTab("TEMPLATES")}
          >
            Response Templates
          </button>
        )}
      </div>

      {activeTab === "REVIEWS" && (
        <>
          {isSuperAdmin && ratingSummary && !ratingSummaryLoading && (
            <div className="rating-summary">
              <div className="rating-summary__overall">
                <span className="rating-summary__value">
                  {ratingSummary.overallAverage != null ? ratingSummary.overallAverage.toFixed(2) : "-"}★
                </span>
                <span className="rating-summary__label">
                  Overall average ({ratingSummary.totalReviews} reviews)
                </span>
              </div>
              <div className="rating-summary__per-resort">
                {ratingSummary.perResort.map((r) => (
                  <div key={r.resortId} className="rating-summary__resort">
                    <span className="rating-summary__resort-name">{r.resortName}</span>
                    <span className="rating-summary__resort-value">
                      {r.averageRating.toFixed(2)}★ ({r.reviewCount})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dashboard-filters">
            <div className="filter-item">
              <label>Resort</label>
              <Select
                className="react-select-container"
                classNamePrefix="react-select"
                options={resorts}
                value={selectedResort}
                onChange={setSelectedResort}
                placeholder="All Resorts"
                isClearable
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
            </div>

            <div className="filter-item">
              <label>Status</label>
              <Select
                className="react-select-container"
                classNamePrefix="react-select"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All statuses"
                isClearable
                menuPortalTarget={menuPortalTarget}
                menuPosition={menuPosition}
                styles={themedSelectStyles()}
              />
            </div>

            <div className="filter-item filter-item--rating">
              <label>Rating: {ratingMin === ratingMax ? `${ratingMin}★` : `${ratingMin}★ – ${ratingMax}★`}</label>
              <StarRangeSlider
                min={ratingMin}
                max={ratingMax}
                onChange={(newMin, newMax) => {
                  setRatingMin(newMin);
                  setRatingMax(newMax);
                }}
              />
            </div>

            <div className="filter-item">
              <label>From Date</label>
              <DatePicker
                selected={fromDate}
                onChange={setFromDate}
                dateFormat="dd/MM/yyyy"
                placeholderText="Any"
                className="date-picker"
                portalId="reviews-datepicker-portal"
                isClearable
              />
            </div>

            <div className="filter-item">
              <label>To Date</label>
              <DatePicker
                selected={toDate}
                onChange={setToDate}
                dateFormat="dd/MM/yyyy"
                placeholderText="Any"
                className="date-picker"
                portalId="reviews-datepicker-portal"
                isClearable
              />
            </div>

            <div className="filter-item">
              <label style={{ visibility: "hidden" }}>Reset</label>
              <button type="button" className="reset-filters-btn" onClick={resetFilters}>
                Reset
              </button>
            </div>

          </div>

          <div className="review-stat-row">
            <div className="review-stat-box">
              <div className="review-stat-label">GBP Review Count</div>
              <div className="review-stat-value">{totalElements}</div>
            </div>
            <div className="review-stat-box review-stat-box--pending">
              <div className="review-stat-label">Pending Reply</div>
              <div className="review-stat-value">{pendingCount}</div>
            </div>
          </div>

          <h3 className="review-list-heading">Reviews List</h3>

          {loading ? (
            <p>Loading...</p>
          ) : reviews.length === 0 ? (
            <p>No reviews found</p>
          ) : (
            <div className="review-card-list">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className={`review-card ${r.starRating <= 3 ? "review-card--low" : ""} ${r.deletedAt ? "review-card--deleted" : ""}`}
                >
                  <div className="review-card-head">
                    <span className="review-card-name">{r.reviewerName || "Anonymous"}</span>
                    <div className="review-card-badges">
                      {r.editedAt && <span className="review-badge review-badge--blue">Edited</span>}
                      {r.deletedAt && <span className="review-badge review-badge--neutral">Deleted from Google</span>}
                      <StatusBadge status={r.replyStatus} />
                    </div>
                  </div>

                  <div className="review-card-meta">
                    <div className="review-card-resort">{r.resort?.name || "-"}</div>
                    {r.resort?.location && <div className="review-card-address">{r.resort.location}</div>}
                  </div>

                  <div className="review-card-line">
                    <span className="review-card-label">Posted On :</span>{" "}
                    {r.googleCreateTime ? formatDateDMY(r.googleCreateTime) : "-"}
                  </div>
                  <div className="review-card-line">
                    <span className="review-card-label">Rated :</span> <Stars n={r.starRating} />
                  </div>

                  {r.editedAt && (
                    <div className="review-card-edited-note">
                      Edited on {formatDateDMY(r.editedAt)}
                      {r.previousStarRating != null && ` - was rated ${r.previousStarRating}★`}
                      {r.previousReplyText && ` - our previous reply: "${r.previousReplyText}"`}
                    </div>
                  )}

                  <div className="review-card-comment">
                    <span className="review-card-label">Review comment:</span>
                    <p>{r.comment || <em>(no comment)</em>}</p>
                  </div>

                  {/* 4-5 star reviews are picked up and sent automatically by
                      the sync/auto-post pipeline - no manual draft step for
                      those. The manual fallback is for 1-3 star only, where
                      Gemini drafting can fail and staff need another way in. */}
                  {canManage && r.starRating <= 3 && (
                    <div className="review-card-actions">
                      <button
                        type="button"
                        className="vt-btn vt-btn-primary"
                        onClick={() => (expandedId === r.id ? closeDraft() : openDraft(r))}
                      >
                        {expandedId === r.id ? "Close" : "Reply"}
                      </button>
                    </div>
                  )}

                  {(r.replyStatus === "AUTO_SENT" || r.replyStatus === "SENT") && r.replyText && (
                    <div className="review-card-reply">
                      <span className="review-card-label">Our reply:</span>
                      <p>{r.replyText}</p>
                    </div>
                  )}

                  {expandedId === r.id && (
                    <div className="review-draft-panel">
                      <label>Reply - edit before sending:</label>
                      <textarea
                        rows={4}
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        placeholder="Type a reply..."
                      />
                      <div className="review-draft-actions">
                        <button
                          type="button"
                          className="vt-btn vt-btn-primary"
                          disabled={busyIds.has(r.id)}
                          onClick={() => handleSend(r)}
                        >
                          Send
                        </button>
                        {r.starRating <= 3 && (
                          <button
                            type="button"
                            className="vt-btn vt-btn-purple"
                            disabled={busyIds.has(r.id)}
                            onClick={() => handleRegenerate(r)}
                          >
                            Regenerate (AI)
                          </button>
                        )}
                        {r.replyStatus !== "SENT" && r.replyStatus !== "AUTO_SENT" && (
                          <button
                            type="button"
                            className="vt-btn vt-btn-danger"
                            disabled={busyIds.has(r.id)}
                            onClick={() => handleDiscard(r)}
                          >
                            Discard
                          </button>
                        )}
                        <button type="button" className="vt-btn vt-btn-secondary" onClick={closeDraft}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="expenses-pagination">
              <button
                type="button"
                className="vt-btn vt-btn-secondary"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </button>
              <span className="expenses-pagination-info">Page {page + 1} of {totalPages}</span>
              <button
                type="button"
                className="vt-btn vt-btn-secondary"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === "TEMPLATES" && canManage && (
        <div className="review-templates">
          <div className="expense-form-card">
            <h3 className="expense-form-card__title">New 4-5 star reply template</h3>
            <p className="review-template-help">
              Placeholders: <code>{"{{reviewerName}}"}</code> and <code>{"{{resortName}}"}</code>
            </p>
            <div className="review-template-audience-toggle">
              <label>
                <input
                  type="radio"
                  name="newTemplateAudience"
                  checked={newTemplateAudience === "WITH_COMMENT"}
                  onChange={() => setNewTemplateAudience("WITH_COMMENT")}
                />
                {" "}For reviews with a written comment
              </label>
              <label>
                <input
                  type="radio"
                  name="newTemplateAudience"
                  checked={newTemplateAudience === "WITHOUT_COMMENT"}
                  onChange={() => setNewTemplateAudience("WITHOUT_COMMENT")}
                />
                {" "}For star-only reviews (no comment)
              </label>
            </div>
            <textarea
              rows={3}
              value={newTemplateText}
              onChange={(e) => setNewTemplateText(e.target.value)}
              placeholder="Thank you so much, {{reviewerName}}, for staying with us at {{resortName}}!..."
            />
            <div className="expense-form-actions">
              <button type="button" className="vt-btn vt-btn-primary" onClick={handleAddTemplate}>
                Add Template
              </button>
            </div>
          </div>

          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table className="resorts-table">
              <thead>
                <tr>
                  <th>Text</th>
                  <th>Audience</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templatesLoading ? (
                  <tr><td colSpan={4}>Loading...</td></tr>
                ) : templates.length === 0 ? (
                  <tr><td colSpan={4}>No templates yet</td></tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id}>
                      <td>{t.text}</td>
                      <td>{t.audience === "WITHOUT_COMMENT" ? "Star-only" : "With comment"}</td>
                      <td>{t.active ? "Yes" : "No"}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className={`vt-btn ${t.active ? "vt-btn-danger" : "vt-btn-primary"}`}
                          onClick={() => handleToggleTemplate(t)}
                        >
                          {t.active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReviewsDashboard;
