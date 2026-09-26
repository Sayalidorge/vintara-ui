import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import config from "../config";
import "../css/theme.css";
import "./ChangePassword.css";
import ToastContainer, { useToast } from "./common/Toast";

const ChangePassword = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validatePassword = (password) => {
    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    return strongPassword.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePassword(newPassword)) {
      showToast(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
        "warning"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "warning");
      return;
    }

    try {
      const res = await fetch(`${config.BASE_URL}/users/change-password`, {
        method: "PUT",
        headers: config.getHeaders(),
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) throw new Error();

      showToast("Password changed successfully. Please login again.", "success");

      // 🔥 Force logout after password change - delayed slightly so the
      // toast above is actually visible before the page unmounts, rather
      // than navigating away the instant it appears.
      setTimeout(() => {
        localStorage.clear();
        navigate("/");
      }, 1200);

    } catch (err) {
      showToast("Error changing password. Please check current password.", "danger");
    }
  };

  return (
    <div className="change-password-container">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="form-wrapper">

        <button className="back-btn" onClick={() => navigate(-1)}>
          &larr; Back
        </button>

        <h2 className="page-title">Change Password</h2>

        <form onSubmit={handleSubmit} className="change-password-form">

          {/* Current Password */}
          <div className="form-group">
            <label>Current Password</label>
            <div className="password-field">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <span onClick={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? "Hide" : "Show"}
              </span>
            </div>
          </div>

          {/* New Password */}
          <div className="form-group">
            <label>New Password</label>
            <div className="password-field">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <span onClick={() => setShowNew(!showNew)}>
                {showNew ? "Hide" : "Show"}
              </span>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label>Confirm New Password</label>
            <div className="password-field">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <span onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? "Hide" : "Show"}
              </span>
            </div>
          </div>

          <button type="submit" className="submit-btn">
            Update Password
          </button>

        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
