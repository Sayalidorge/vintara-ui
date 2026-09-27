// Reads the logged-in user's role straight from localStorage - matches the
// pattern already used ad-hoc across components (e.g. ManageUsers.jsx).
export const getUserRole = () => {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  return currentUser?.role;
};

export const isSuperAdmin = () => getUserRole() === "SUPER_ADMIN";

// Same localStorage read Layout.jsx/ProtectedRoute.jsx already do inline to
// gate the sidebar/routes - pulled out here so a component nested INSIDE an
// already-permitted route (e.g. a tab within a page) can gate a sub-section
// on a different, narrower permission the same way.
export const hasPermission = (perm) => {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  return (currentUser?.permissions || []).includes(perm);
};
