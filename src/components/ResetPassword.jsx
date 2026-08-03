import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import config from "../config";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const token = new URLSearchParams(location.search).get("token");

  const handleSubmit = async (e) => {
    e.preventDefault();

try {
  await fetch(
    `${config.BASE_URL}/auth/reset-password?token=${encodeURIComponent(token)}&newPassword=${encodeURIComponent(password)}`,
    {
      method: "POST",
    }
  );

  alert("Password reset successful. Please login.");
  navigate("/");
} catch (err) {
  alert("Invalid or expired token");
}
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Reset Password</h2>

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
