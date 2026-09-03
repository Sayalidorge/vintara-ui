import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, requiredPermission }) => {
  const userRaw = localStorage.getItem("user");

  if (!userRaw) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission) {
    const user = JSON.parse(userRaw);
    const permissions = user?.permissions || [];
    if (!permissions.includes(requiredPermission)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
