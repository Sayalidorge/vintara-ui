import {
  FaTachometerAlt,
  FaHome,
  FaCalendarPlus,
  FaBoxes,
  FaClipboardList,
  FaUmbrellaBeach,
  FaHotel,
  FaUsers,
  FaEnvelope,
  FaCalendarCheck,
  FaDollarSign,
  FaReceipt,
  FaMoneyBillWave,
  FaFileInvoiceDollar,
  FaFileInvoice,
  FaCog,
  FaBook,
  FaHistory,
  FaMoneyCheckAlt,
  FaCoins,
} from "react-icons/fa";

// Single source of truth for the sidebar. Each item is shown only if the
// logged-in user's permissions (from /auth/login) include requiredPermission
// — see PermissionService on the backend for the role -> permission map.
const MENU_CONFIG = [
  { label: "Occupancy", path: "/admin/dashboard", icon: FaTachometerAlt, requiredPermission: "view_occupancy" },
  { label: "Bookings", path: "/admin/bookings", icon: FaBook, requiredPermission: "view_admin_bookings" },
  { label: "Dashboard", path: "/user/dashboard", icon: FaHome, requiredPermission: "view_user_dashboard" },
  { label: "Create Booking", path: "/user/create-booking", icon: FaCalendarPlus, requiredPermission: "create_booking" },
  { label: "Inventory", path: "/user/inventory", icon: FaBoxes, requiredPermission: "view_inventory" },
  {
    label: "Daily Entry",
    path: "/user/daily-entries",
    icon: FaClipboardList,
    requiredPermission: "view_daily_entry",
    activePaths: ["/user/daily-entries", "/user/record-daily-entry"],
  },
  { label: "Attendance & Leave", path: "/user/user-leave", icon: FaUmbrellaBeach, requiredPermission: "view_leave_portal" },
  { label: "My Salary", path: "/user/salary", icon: FaCoins, requiredPermission: "view_salary" },
  { label: "Resorts", path: "/admin/resorts", icon: FaHotel, requiredPermission: "manage_resorts" },
  { label: "Users", path: "/admin/users", icon: FaUsers, requiredPermission: "manage_users" },
  { label: "Enquiries", path: "/admin/enquiries", icon: FaEnvelope, requiredPermission: "view_enquiries" },
  { label: "Team Attendance & Leave", path: "/admin/leaves", icon: FaCalendarCheck, requiredPermission: "manage_leaves" },
  { label: "Salary", path: "/admin/salary", icon: FaMoneyCheckAlt, requiredPermission: "manage_salary" },
  { label: "Revenue", path: "/admin/revenue", icon: FaDollarSign, requiredPermission: "view_revenue" },
  { label: "Expenses", path: "/admin/expenses", icon: FaReceipt, requiredPermission: "view_expenses" },
  {
    label: "Food Collection",
    path: "/admin/food-collection-expenses",
    icon: FaMoneyBillWave,
    requiredPermission: "view_property_collection",
  },
  { label: "Monthly Settlement", path: "/admin/monthly-settlement", icon: FaFileInvoiceDollar, requiredPermission: "view_monthly_settlement" },
  { label: "Audit Log", path: "/admin/audit-log", icon: FaHistory, requiredPermission: "view_audit_log" },
  { label: "GST Invoice", path: "/user/gst-invoice", icon: FaFileInvoice, requiredPermission: "generate_gst_invoice" },
  { label: "Settings", path: "/admin/settings", icon: FaCog, requiredPermission: "manage_company_settings" },
];

export default MENU_CONFIG;
