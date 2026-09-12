import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import config from "../config";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

 try {
  const res = await fetch(`${config.BASE_URL}/auth/forgot-password?email=${encodeURIComponent(email)}`, {
    method: "POST",
  });

  // 404 (email not registered) gets the SAME message as success -
  // deliberately, so this can't be used to probe which emails are
  // registered. Only a genuine server-side failure (e.g. mail send error)
  // gets a distinct message, since retrying silently wouldn't help there.
  if (res.ok || res.status === 404) {
    alert("If the email exists, reset link has been sent.");
    navigate("/");
    return;
  }

  const message = await res.text().catch(() => null);
  alert(message || "Something went wrong. Please try again later.");
} catch (err) {
  alert("Something went wrong. Please try again later.");
}
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "var(--primary-purple)", textAlign: "center", letterSpacing: "0.3px", marginTop: 0, marginBottom: "18px" }}>Forgot Password</h2>

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button type="submit">Send Reset Link</button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
