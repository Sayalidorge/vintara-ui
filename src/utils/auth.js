// Reads the logged-in user's role straight from localStorage - matches the
// pattern already used ad-hoc across components (e.g. ManageUsers.jsx).
export const isSuperAdmin = () => {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  return currentUser?.role === "SUPER_ADMIN";
};
