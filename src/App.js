import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./components/Login";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import ChangePassword from "./components/ChangePassword";
import AdminDashboard from "./components/AdminDashboard";
import AdminBookingsDashboard from "./components/AdminBookingsDashboard";
import ManageResorts from "./components/ManageResorts";
import ManageUsers from "./components/ManageUsers";
import AdminExpensesDashboard from "./components/AdminExpensesDashboard";
import RecordExpenseForm from "./components/RecordExpenseForm";
import ViewBookingEnquiry from "./components/ViewBookingEnquiry";
import UserDashboard from "./components/UserDashboard";
import CreateBookingForm from "./components/CreateBookingForm";
import RecordDailyEntryForm from "./components/RecordDailyEntryForm";
import UserInventory from "./components/UserInventory";
import DailyEntryDashboard from "./components/DailyEntryDashboard";
import RevenueDashboard from "./components/RevenueDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import TeamAttendanceLeave from "./components/TeamAttendanceLeave";
import MyAttendanceLeave from "./components/MyAttendanceLeave";
import ResortDailyFinance from "./components/ResortDailyFinance";
import MonthlySettlement from "./components/MonthlySettlement";
import AuditLog from "./components/AuditLog";
import GstInvoicePage from "./components/GstInvoicePage";
import CompanySettings from "./components/CompanySettings";
import MySalary from "./components/MySalary";
import AdminSalaryManagement from "./components/AdminSalaryManagement";
import GuestCheckInPage from "./components/guest-checkin/GuestCheckInPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
  {/* Public routes */}
  <Route path="/" element={<Login />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />
  <Route
    path="/checkin/:token"
    element={<GuestCheckInPage />}
/>

  {/* Change password */}
  <Route
    path="/change-password"
    element={
      <ProtectedRoute>
        <ChangePassword />
      </ProtectedRoute>
    }
  />

  {/* Admin routes */}
  <Route
    path="/admin"
    element={
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    }
  >
    <Route path="dashboard" element={<ProtectedRoute requiredPermission="view_occupancy"><AdminDashboard /></ProtectedRoute>} />
    <Route path="bookings" element={<ProtectedRoute requiredPermission="view_admin_bookings"><AdminBookingsDashboard /></ProtectedRoute>} />
    <Route path="resorts" element={<ProtectedRoute requiredPermission="manage_resorts"><ManageResorts /></ProtectedRoute>} />
    <Route path="users" element={<ProtectedRoute requiredPermission="manage_users"><ManageUsers /></ProtectedRoute>} />
    <Route path="expenses" element={<ProtectedRoute requiredPermission="view_expenses"><AdminExpensesDashboard /></ProtectedRoute>} />
    <Route path="record-expense" element={<ProtectedRoute requiredPermission="view_expenses"><RecordExpenseForm /></ProtectedRoute>} />
    <Route path="enquiries" element={<ProtectedRoute requiredPermission="view_enquiries"><ViewBookingEnquiry /></ProtectedRoute>} />
    <Route path="revenue" element={<ProtectedRoute requiredPermission="view_revenue"><RevenueDashboard /></ProtectedRoute>} />
    <Route path="leaves" element={<ProtectedRoute requiredPermission="manage_leaves"><TeamAttendanceLeave /></ProtectedRoute>} />
    <Route path="food-collection-expenses" element={<ProtectedRoute requiredPermission="view_property_collection"><ResortDailyFinance /></ProtectedRoute>} />
    <Route path="monthly-settlement" element={<ProtectedRoute requiredPermission="view_monthly_settlement"><MonthlySettlement /></ProtectedRoute>} />
    <Route path="audit-log" element={<ProtectedRoute requiredPermission="view_audit_log"><AuditLog /></ProtectedRoute>} />
    <Route path="settings" element={<ProtectedRoute requiredPermission="manage_company_settings"><CompanySettings /></ProtectedRoute>} />
    <Route path="salary" element={<ProtectedRoute requiredPermission="manage_salary"><AdminSalaryManagement /></ProtectedRoute>} />
  </Route>

  {/* User routes */}
<Route
  path="/user"
  element={
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  }
>
  <Route path="dashboard" element={<ProtectedRoute requiredPermission="view_user_dashboard"><UserDashboard /></ProtectedRoute>} />
  <Route path="create-booking/:id?" element={<ProtectedRoute requiredPermission="create_booking"><CreateBookingForm /></ProtectedRoute>} />
  <Route path="record-daily-entry" element={<ProtectedRoute requiredPermission="view_daily_entry"><RecordDailyEntryForm /></ProtectedRoute>} />
  <Route path="inventory" element={<ProtectedRoute requiredPermission="view_inventory"><UserInventory /></ProtectedRoute>} />
  <Route path="daily-entries" element={<ProtectedRoute requiredPermission="view_daily_entry"><DailyEntryDashboard /></ProtectedRoute>} />
  <Route path="user-leave" element={<ProtectedRoute requiredPermission="view_leave_portal"><MyAttendanceLeave /></ProtectedRoute>} />
  <Route path="gst-invoice" element={<ProtectedRoute requiredPermission="generate_gst_invoice"><GstInvoicePage /></ProtectedRoute>} />
  <Route path="salary" element={<ProtectedRoute requiredPermission="view_salary"><MySalary /></ProtectedRoute>} />
</Route>
  {/* Catch-all */}
  <Route path="*" element={<Login />} />
</Routes>
    </BrowserRouter>
  );
}

export default App;
