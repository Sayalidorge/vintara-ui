import React, { useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import {
  FaTachometerAlt,
  FaCalendarPlus,
  FaBoxes,
  FaClipboardList,
  FaUserCircle,
  FaUmbrellaBeach,
  FaBars,
  FaWallet
} from "react-icons/fa";
import "./UserLayout.css";

const UserLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user"));
  
  // Track whether the full sidebar menu is visible
  const [isMenuVisible, setIsMenuVisible] = useState(true);

  const isActive = (paths) => {
    if (!Array.isArray(paths)) paths = [paths];
    return paths.some(
      (path) => location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  return (
    <div className={`admin-layout ${isMenuVisible ? "menu-visible" : "menu-hidden"}`}>
      
      {/* SIDEBAR (Completely hides and shows) */}
      <aside className="sidebar">
        <div className="sidebar-logo-section">
          <FaUserCircle size={40} />
          <h2 className="sidebar-logo">VINTARA</h2>
          <span className="username">
            {user?.role} <br />
            {user?.userId}
          </span>
        </div>
        
        <ul className="sidebar-menu">
          <li
            onClick={() => navigate("/user/dashboard")}
            className={isActive("/user/dashboard") ? "active" : ""}
          >
            <FaTachometerAlt /> Dashboard
          </li>
          <li
            onClick={() => navigate("/user/create-booking")}
            className={isActive("/user/create-booking") ? "active" : ""}
          >
            <FaCalendarPlus /> Create Booking
          </li>
          <li
            onClick={() => navigate("/user/inventory")}
            className={isActive("/user/inventory") ? "active" : ""}
          >
            <FaBoxes /> Inventory
          </li>
          <li
            onClick={() => navigate("/user/daily-entries")}
            className={isActive(["/user/daily-entries", "/user/record-daily-entry"]) ? "active" : ""}
          >
            <FaClipboardList /> Daily Entry
          </li>
          <li
            onClick={() => navigate("/user/user-leave")}
            className={isActive("/user/user-leave") ? "active" : ""}
          >
            <FaUmbrellaBeach /> Leave Portal
          </li>
          <li
          onClick={() => navigate("/user/daily-finance")}
          className={isActive("/user/daily-finance") ? "active" : ""}
        >
          <FaWallet /> Food Collection
        </li>
        </ul>
      </aside>
      

      {/* MAIN CONTENT AREA */}
      <div className="main-content">
        <header className="dashboard-header-bar">
          <div className="header-left">
            {/* The structural toggle button sits safely here in the top header */}
            <button 
              type="button" 
              className="menu-toggle-hamburger"
              onClick={() => setIsMenuVisible(!isMenuVisible)}
            >
              <FaBars />
            </button>
            <span style={{ fontWeight: "700", marginLeft: "15px" }}>VINTARA STAYS </span>
            <span style={{ color: "var(--primary-teal)" }}>USER PANEL</span>
          </div>
          
          <div className="actions">
            <button className="btn" onClick={() => navigate("/change-password")}>
              Change Password
            </button>
            <button
              className="btn"
              onClick={() => {
                localStorage.clear();
                navigate("/");
              }}
            >
              Logout
            </button>
          </div>
        </header>
        
        <main className="content-viewport">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default UserLayout;