import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./components/Login";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import ChangePassword from "./components/ChangePassword";
import AdminDashboard from "./components/AdminDashboard";
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
import AdminLayout from "./components/AdminLayout";
import AdminLeaveDashboard from "./components/AdminLeaveDashboard";
import EmployeeLeavePortal from "./components/EmployeeLeavePortal";
import UserLayout from "./components/UserLayout";
import ResortDailyFinance from "./components/ResortDailyFinance";
import MonthlySettlement from "./components/MonthlySettlement";
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
        <AdminLayout />
      </ProtectedRoute>
    }
  >
    <Route path="dashboard" element={<AdminDashboard />} />
    <Route path="resorts" element={<ManageResorts />} />
    <Route path="users" element={<ManageUsers />} />
    <Route path="expenses" element={<AdminExpensesDashboard />} />
    <Route path="record-expense" element={<RecordExpenseForm />} />
    <Route path="enquiries" element={<ViewBookingEnquiry />} />
    <Route path="revenue" element={<RevenueDashboard />} />
    <Route path="leaves" element={<AdminLeaveDashboard />} />
    <Route path="food-collection-expenses" element={<ResortDailyFinance />}/>
    <Route path="monthly-settlement" element={<MonthlySettlement />}
/>
  </Route>

  {/* User routes */}
{/* User routes */}
<Route
  path="/user"
  element={
    <ProtectedRoute>
      <UserLayout />
    </ProtectedRoute>
  }
>
  <Route path="dashboard" element={<UserDashboard />} />
  <Route path="create-booking/:id?" element={<CreateBookingForm />} />
  <Route path="record-daily-entry" element={<RecordDailyEntryForm />} />
  <Route path="inventory" element={<UserInventory />} />
  <Route path="daily-entries" element={<DailyEntryDashboard />} />
  <Route path="user-leave" element={<EmployeeLeavePortal />} />
  <Route path="daily-finance" element={<ResortDailyFinance />}
/>
</Route>
  {/* Catch-all */}
  <Route path="*" element={<Login />} />
</Routes>
    </BrowserRouter>
  );
}

export default App;
