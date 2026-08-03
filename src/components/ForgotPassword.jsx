import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import config from "../config";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

 try {
  await fetch(`${config.BASE_URL}/auth/forgot-password?email=${encodeURIComponent(email)}`, {
    method: "POST",
  });

  alert("If the email exists, reset link has been sent.");
  navigate("/");
} catch (err) {
  alert("Something went wrong");
}
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Forgot Password</h2>

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
