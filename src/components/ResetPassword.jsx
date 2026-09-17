import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import config from "../config";
import ToastContainer, { useToast } from "./common/Toast";

const ResetPassword = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const token = new URLSearchParams(location.search).get("token");

  const handleSubmit = async (e) => {
    e.preventDefault();

try {
  const res = await fetch(
    `${config.BASE_URL}/auth/reset-password?token=${encodeURIComponent(token)}&newPassword=${encodeURIComponent(password)}`,
    {
      method: "POST",
    }
  );

  if (!res.ok) {
    const message = await res.text().catch(() => null);
    throw new Error(message || "Invalid or expired token");
  }

  showToast("Password reset successful. Please login.", "success");
  // Delayed slightly so the toast is actually visible before the page
  // unmounts, rather than navigating away the instant it appears.
  setTimeout(() => navigate("/"), 1200);
} catch (err) {
  showToast(err.message || "Invalid or expired token", "danger");
}
  };

  return (
    <div className="login-container">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="login-box">
        <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary-teal)", textAlign: "center", marginTop: 0, marginBottom: "24px" }}>Reset Password</h2>

        <form onSubmit={handleSubmit}>
          <label>New Password</label>
          <input
            type="password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">Reset Password</button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
