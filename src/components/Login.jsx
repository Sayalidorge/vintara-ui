// src/components/Login.jsx
import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./Login.css";
import "../css/theme.css";
import logo from "../assets/logo.jpg";
import { useNavigate } from "react-router-dom";
import config from "../config";


const Login = () => {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!userId || !password) {
    alert("Please enter User ID and password");
    return;
  }

  try {
    const res = await fetch(`${config.BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password }),
    });

    if (!res.ok) {
      throw new Error("Invalid credentials");
    }

    const data = await res.json();
    console.log("Login response:", data);

    // Store token and user separately
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data));
 console.log("Token stored:", localStorage.getItem("token")); // Check if token is saved
    // Redirect based on role
if (data.role === "ADMIN" || data.role === "SUPER_ADMIN") {
  window.location.href = "/admin/dashboard";
} else if (data.role === "PROPERTY_MANAGER" || data.role === "RECEPTION") {
  window.location.href = "/user/inventory";
} else {
  window.location.href = "/user/dashboard";
}
  } catch (err) {
    alert(err.message);
  }
};


  return (
    <div className="login-container">
      <div className="login-box">
        <img src={logo} alt="Vintara Resorts Logo" className="login-logo" />

        <form onSubmit={handleSubmit}>
          <label>User ID</label>
          <input
            type="text"
            placeholder="Enter your User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />

          <label>Password</label>
          <div className="password-input-wrap">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
<div className="forgot-password">
  <a href="/forgot-password" className="forgot-password-link">
    Forgot Password?
  </a>
</div>
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
