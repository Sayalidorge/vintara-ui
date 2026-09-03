import React, { useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { FaUserCircle, FaBars } from "react-icons/fa";
import MENU_CONFIG from "../constants/menuConfig";
import "./UserLayout.css";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const permissions = user?.permissions || [];
  const loggedInUsername = user?.name || user?.userId || "User";

  // Track visibility state for the layout drawer
  // Starts open on desktop, closed on mobile so it doesn't cover the page on load
  const [isMenuVisible, setIsMenuVisible] = useState(() => window.innerWidth > 768);

  const isActive = (item) => {
    const paths = item.activePaths || [item.path];
    return paths.some(
      (path) => location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  const visibleMenuItems = MENU_CONFIG.filter((item) => permissions.includes(item.requiredPermission));

  return (
    <div className={`admin-layout ${isMenuVisible ? "menu-visible" : "menu-hidden"}`}>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo-section">
          <FaUserCircle size={40} style={{ marginBottom: "5px" }} />
          <h2 className="sidebar-logo">VINTARA</h2>
          <span className="username">
            {user?.role} <br />
            {loggedInUsername}
          </span>
        </div>

        <ul className="sidebar-menu">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.path}
                onClick={() => navigate(item.path)}
                className={isActive(item) ? "active" : ""}
                title={item.label}
              >
                <Icon /> <span className="link-text">{item.label}</span>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Tapping outside the drawer closes it on mobile */}
      <div className="sidebar-backdrop" onClick={() => setIsMenuVisible(false)} />

      {/* MAIN CONTENT */}
      <div className="main-content">
        <header className="dashboard-header-bar" role="banner">
          <div className="header-left">
            {/* Structural Hamburger Button to slide sidebar in/out */}
            <button
              type="button"
              className="menu-toggle-hamburger"
              onClick={() => setIsMenuVisible(!isMenuVisible)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "8px", display: "flex", alignItems: "center" }}
            >
              <FaBars size={20} />
            </button>
            <div style={{ marginLeft: "15px" }}>
              <span style={{ fontWeight: "700" }}>VINTARA STAYS </span>
              <span style={{ color: "var(--primary-teal)" }}>DASHBOARD</span>
            </div>
          </div>

          <div className="actions">
            <span style={{ marginRight: "16px" }}>
              Logged in as: <strong>{loggedInUsername}</strong>
            </span>
            <button className="btn" onClick={() => navigate("/change-password")}>
              Change Password
            </button>
            <button className="btn" onClick={() => { localStorage.clear(); navigate("/"); }}>
              Logout
            </button>
          </div>
        </header>

        {/* Render child layout components cleanly */}
        <main className="content-viewport">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
