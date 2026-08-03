import React, { useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import {  
  FaHotel,
  FaUsers,
  FaChartBar,
  FaDollarSign,
  FaCog,
  FaTachometerAlt,
  FaUserCircle,
  FaEnvelope,
  FaReceipt,
  FaBars,
  FaWallet
} from "react-icons/fa";
import "./UserLayout.css";

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user"));
  const loggedInUsername = user?.username || "Admin";

  // Track visibility state for the layout drawer
  const [isMenuVisible, setIsMenuVisible] = useState(true);

  // Helper to check if path is active
  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className={`admin-layout ${isMenuVisible ? "menu-visible" : "menu-hidden"}`}>
      
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo-section">
          <FaUserCircle size={40} style={{ marginBottom: "5px" }} />
          <h2 className="sidebar-logo">VINTARA</h2>
          <span className="username">Welcome, {loggedInUsername}</span>
        </div>

        <ul className="sidebar-menu">
          <li
            onClick={() => navigate("/admin/dashboard")}
            className={isActive("/admin/dashboard") ? "active" : ""}
          >
            <FaTachometerAlt /> Dashboard
          </li>
          <li
            onClick={() => navigate("/admin/resorts")}
            className={isActive("/admin/resorts") ? "active" : ""}
          >
            <FaHotel /> Resorts
          </li>
          <li
            onClick={() => navigate("/admin/users")}
            className={isActive("/admin/users") ? "active" : ""}
          >
            <FaUsers /> Users
          </li>
          <li 
            onClick={() => navigate("/admin/enquiries")} 
            className={isActive("/admin/enquiries") ? "active" : ""}
          >
            <FaEnvelope /> Enquiries
          </li>
          <li
            onClick={() => navigate("/admin/leaves")}
            className={isActive("/admin/leaves") ? "active" : ""}
          >
            <FaUsers /> Leaves
          </li>
          <li className={isActive("/admin/reports") ? "active" : ""}>
            <FaChartBar /> Reports
          </li>
          <li
            onClick={() => navigate("/admin/revenue")}
            className={isActive("/admin/revenue") ? "active" : ""}
          >
            <FaDollarSign /> Revenue
          </li>
          <li
            onClick={() => navigate("/admin/expenses")}
            className={isActive("/admin/expenses") ? "active" : ""}
          >
            <FaReceipt /> Expenses
          </li>
          <li
            onClick={() => navigate("/admin/food-collection-expenses")}
            className={isActive("/admin/food-collection-expenses") ? "active" : ""}
          >
            <FaWallet />Property Collection
           </li>
        
          <li
            onClick={() => navigate("/admin/monthly-settlement")}
            className={isActive("/admin/monthly-settlement") ? "active" : ""}
          >
            <FaReceipt />Monthly Settlement
           </li>
          
          <li className={isActive("/admin/settings") ? "active" : ""}>
            <FaCog /> Settings
          </li>
        </ul>
      </aside>

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

export default AdminLayout;