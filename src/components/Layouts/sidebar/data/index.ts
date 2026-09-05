import * as Icons from "../icons";

export const NAV_DATA = [
  {
    label: "MAIN MENU",
    items: [
      {
        title: "Main Dashboard",
        icon: Icons.LayoutDashboardIcon,
        url: "/",
        items: [],
      },
      {
        title: "Orders",
        icon: Icons.CreateOrderSquareIcon,
        items: [
          {
            title: "Create Orders",
            url: "/create-orders",
          },
          {
            title: "All Orders",
            url: "/all-orders",
          },
          {
            title: "New Orders",
            url: "/new-orders",
          },
          {
            title: "Pending Orders",
            url: "/pending-orders",
          },
          {
            title: "In Progress Orders",
            url: "/in-progress-orders",
          },
          {
            title: "Cancelled Orders",
            url: "/cancelled-orders",
          },
          {
            title: "Completed Orders",
            url: "/completed-orders",
          },
          {
            title: "Delivered Orders",
            url: "/delivered-orders",
          },
          {
            title: "Returned Orders",
            url: "/returned-orders",
          },
          {
            title: "Expired Orders",
            url: "/expired-orders",
          },
          {
            title: "Approved Orders",
            url: "/approved-orders",
          },
          {
            title: "Waiting PayTrigger Approval",
            url: "/paytrigger-pending-orders",
          },
          {
            title: "Picked Orders",
            url: "/picked-orders",
          },
          {
            title: "Rejected Orders",
            url: "/rejected-orders",
          }
        ],
      },
      {
        title: "Customers Profiles",
        icon: Icons.UsersIcon,
        url: "/admin/customers",
        items: [],
      },
      {
        title: "Blacklisted Customers",
        icon: Icons.BanIcon,
        url: "/admin/customers/blacklist",
        items: [],
      },
      {
        title: "Cleared Accounts",
        icon: Icons.CheckCircleIcon,
        url: "/admin/customers/cleared",
        items: [],
      },
      {
        title: "Orders for Approval",
        icon: Icons.ClipboardCheckIcon,
        url: "/orders-for-approval",
        items: [],
      },
      {
        title: "Approved Order List",
        icon: Icons.ArchiveIcon,
        url: "/approved-order-list",
        items: [],
      },
      {
        title: "Recovery Orders",
        icon: Icons.RotateCcwIcon,
        url: "/recovery-orders",
        items: [],
      },
      {
        title: "Delivery Officers",
        icon: Icons.TruckIcon,
        items: [
          {
            title: "Officer List",
            url: "/delivery-officers",
          },
          {
            title: "Area Assignments",
            url: "/admin/delivery-assignments",
          },
        ],
      },
      {
        title: "Verification Officers",
        icon: Icons.ShieldCheckIcon,
        items: [
          {
            title: "Officer List",
            url: "/verification-officers",
          },
          {
            title: "Area Assignments",
            url: "/admin/officer-assignments",
          },
        ],
      },
      {
        title: "Recovery Officers",
        icon: Icons.UserCircleIcon,
        items: [
          {
            title: "Officer List",
            url: "/recovery-officers",
          },
          {
            title: "Area Assignments",
            url: "/admin/recovery-assignments",
          },
        ],
      },
      {
        title: "Notifications",
        icon: Icons.BellIcon,
        items: [
          { title: "View Notifications", url: "/notifications" },
          { title: "Broadcast", url: "/admin/notifications-broadcast" },
        ],
      },
      {
        title: "User Management",
        icon: Icons.UserPlusIcon,
        items: [
          {
            title: "Create Users",
            url: "/user-management/create-users",
          },
          {
            title: "User List",
            url: "/user-management/user-list",
          },
          {
            title: "Deletion Requests",
            url: "/admin/deletion-requests",
          },
          {
            title: "Cash Limits",
            url: "/admin/cash-limits",
          },
        ],
      },
      {
        title: "Address Management",
        icon: Icons.MapPinIcon,
        items: [
          {
            title: "Cities",
            url: "/admin/addresses/cities",
          },
          {
            title: "Zones",
            url: "/admin/addresses/zones",
          },
          {
            title: "Areas",
            url: "/admin/addresses/areas",
          },
          {
            title: "Bulk Upload",
            url: "/admin/addresses/bulk-upload",
          },
        ],
      },
      {
        title: "Complaints",
        icon: Icons.MessageSquareIcon,
        items: [
          {
            title: "Create Complaint",
            url: "/admin/complaints",
          },
          {
            title: "All Complaints",
            url: "/admin/complaints/all",
          },
        ],
      },
      {
        title: "Reports",
        icon: Icons.BarChartIcon,
        items: [
          { title: "Reports Summary", url: "/reports" },
          { title: "Reports Hub", url: "/admin/reports-hub" },
        ],
      },
      {
        title: "PayTrigger",
        icon: Icons.LockIcon,
        url: "/admin/paytrigger",
        items: [],
      },
      {
        title: "Legacy Data Import",
        icon: Icons.ArchiveIcon,
        items: [
          { title: "Import Legacy Data", url: "/admin/legacy-import" },
          { title: "Pending Legacy Profiles", url: "/admin/legacy-import/pending" },
        ],
      },
      {
        title: "Recycle Bin",
        icon: Icons.RotateCcwIcon,
        url: "/admin/recycle-bin",
        items: [],
      },
      {
        title: "Outlets Management",
        icon: Icons.StoreIcon,
        url: "/admin/outlets",
        items: [],
      },
      {
        title: "Inventory & Warehouse",
        icon: Icons.PackageIcon,
        url: "/admin/inventory",
        items: [],
      },
      {
        title: "Rankings & Leaderboards",
        icon: Icons.BarChartIcon,
        items: [
          { title: "Officer Rankings", url: "/admin/rankings" },
        ],
      },
      {
        title: "Alerts Center",
        icon: Icons.AlertTriangleIcon,
        url: "/admin/alerts",
        items: [],
      },
      {
        title: "Security",
        icon: Icons.ActivityIcon,
        items: [
          { title: "Activity Logs", url: "/admin/activity-logs" },
          { title: "Security Settings", url: "/admin/security-settings" },
          { title: "Permissions", url: "/admin/permissions" },
        ],
      },
      {
        title: "Recovery Management",
        icon: Icons.RotateCcwIcon,
        url: "/admin/recovery-management",
        items: [],
      },
      {
        title: "Delivery Management",
        icon: Icons.TruckIcon,
        url: "/admin/delivery-management",
        items: [],
      },
      {
        title: "Installment Aging",
        icon: Icons.ClockIcon,
        url: "/admin/installment-aging",
        items: [],
      },
      {
        title: "EMI Calculator",
        icon: Icons.CalculatorIcon,
        url: "/admin/emi-calculator",
        items: [],
      },
      {
        title: "Sales Targets",
        icon: Icons.DollarSignIcon,
        url: "/admin/sales-targets",
        items: [],
      },
      {
        title: "Field Ops",
        icon: Icons.MapPinIcon,
        url: "/admin/field-ops",
        items: [],
      },
      {
        title: "Command Center",
        icon: Icons.LayoutDashboardIcon,
        url: "/admin/command-center",
        items: [],
      },
      {
        title: "Discount Requests",
        icon: Icons.CreditCardIcon,
        url: "/admin/discount-requests",
        items: [],
      },
      {
        title: "Customer Risk Score",
        icon: Icons.ShieldCheckIcon,
        url: "/admin/customer-risk",
        items: [],
      },
    ],
  },
  {
    label: "CSR PORTAL",
    items: [
      {
        title: "CSR Dashboard",
        icon: Icons.LayoutDashboardIcon,
        url: "/csr/dashboard",
        items: [],
      },
      {
        title: "Orders",
        icon: Icons.CreateOrderSquareIcon,
        items: [
          {
            title: "Create Orders",
            url: "/csr/create-order",
          },
          {
            title: "All Orders",
            url: "/all-orders",
          },
          {
            title: "New Orders",
            url: "/new-orders",
          },
          {
            title: "Pending Orders",
            url: "/pending-orders",
          },
          {
            title: "In Progress Orders",
            url: "/in-progress-orders",
          },
          {
            title: "Cancelled Orders",
            url: "/cancelled-orders",
          },
          {
            title: "Completed Orders",
            url: "/completed-orders",
          },
          {
            title: "Delivered Orders",
            url: "/delivered-orders",
          },
          {
            title: "Returned Orders",
            url: "/returned-orders",
          },
          {
            title: "Expired Orders",
            url: "/expired-orders",
          },
          {
            title: "Approved Orders",
            url: "/approved-orders",
          },
          {
            title: "Waiting PayTrigger Approval",
            url: "/paytrigger-pending-orders",
          },
          {
            title: "Picked Orders",
            url: "/picked-orders",
          },
          {
            title: "Rejected Orders",
            url: "/rejected-orders",
          }
        ],
      },
      {
        title: "Website Orders",
        icon: Icons.GlobeIcon,
        items: [
          {
            title: "Website Feed",
            url: "/csr/website-orders",
          },
          {
            title: "Cancelled Orders",
            url: "/csr/website-orders/cancelled",
          },
          {
            title: "Expired Orders",
            url: "/csr/website-orders/expired",
          },
        ],
      },
      {
        title: "Customers Profiles",
        icon: Icons.UsersIcon,
        url: "/admin/customers",
        items: [],
      },
      {
        title: "Blacklisted Customers",
        icon: Icons.BanIcon,
        url: "/admin/customers/blacklist",
        items: [],
      },
      {
        title: "Cleared Accounts",
        icon: Icons.CheckCircleIcon,
        url: "/admin/customers/cleared",
        items: [],
      },
      {
        title: "Notifications",
        icon: Icons.BellIcon,
        url: "/notifications",
        items: [],
      },
      {
        title: "Complaints",
        icon: Icons.MessageSquareIcon,
        url: "/csr/complaints",
        items: [],
      },
    ],
  },
  {
    label: "OUTLET PORTAL",
    items: [
      {
        title: "Outlet Dashboard",
        icon: Icons.StoreIcon,
        url: "/outlet/dashboard",
        items: [],
      },
      {
        title: "Orders",
        icon: Icons.CreateOrderSquareIcon,
        items: [
          {
            title: "Create Orders",
            url: "/create-orders",
          },
          {
            title: "All Orders",
            url: "/all-orders",
          },
          {
            title: "New Orders",
            url: "/new-orders",
          },
          {
            title: "Pending Orders",
            url: "/pending-orders",
          },
          {
            title: "In Progress Orders",
            url: "/in-progress-orders",
          },
          {
            title: "Cancelled Orders",
            url: "/cancelled-orders",
          },
          {
            title: "Completed Orders",
            url: "/completed-orders",
          },
          {
            title: "Delivered Orders",
            url: "/delivered-orders",
          },
          {
            title: "Returned Orders",
            url: "/returned-orders",
          },
          {
            title: "Expired Orders",
            url: "/expired-orders",
          },
          {
            title: "Approved Orders",
            url: "/approved-orders",
          },
          {
            title: "Waiting PayTrigger Approval",
            url: "/paytrigger-pending-orders",
          },
          {
            title: "Picked Orders",
            url: "/picked-orders",
          },
          {
            title: "Rejected Orders",
            url: "/rejected-orders",
          }
        ],
      },
      {
        title: "Customers Profiles",
        icon: Icons.UsersIcon,
        url: "/admin/customers",
        items: [],
      },
      {
        title: "Approved Order List",
        icon: Icons.ArchiveIcon,
        items: [],
      },
      {
        title: "Outlet Customers",
        icon: Icons.RotateCcwIcon,
        items: [],
      },
      {
        title: "Inventory",
        icon: Icons.PackageIcon,
        items: [
          { title: "Stock List", url: "/outlet/inventory" },
          { title: "Used Stock", url: "/outlet/inventory/used" },
          { title: "Used Stock History", url: "/outlet/inventory/used/history" },
          { title: "Stock Transfers", url: "/outlet/inventory/transfers" },
          { title: "Transfer History", url: "/outlet/inventory/transfers/history" },
        ],
      },
      {
        title: "Vendors",
        icon: Icons.HandshakeIcon,
        items: [
          { title: "Manage Vendors", url: "/outlet/vendors" },
          { title: "Vendor Purchases", url: "/outlet/vendors/purchases" },
          { title: "Vendor Payments", url: "/outlet/vendors/payments" },
        ],
      },
      {
        title: "Team Management",
        icon: Icons.UsersIcon,
        items: [
          { title: "Delivery Agents", url: "/outlet/delivery" },
          { title: "Recovery Officers", url: "/outlet/recovery" },
          { title: "Verification Officers", url: "/outlet/verification" },
          { title: "Officer Targets", url: "/outlet/officer-targets" },
          { title: "Cash Limits", url: "/outlet/cash-limits" },
        ],
      },
      {
        title: "Rankings & Leaderboards",
        icon: Icons.BarChartIcon,
        items: [
          { title: "Outlet Rankings", url: "/outlet/rankings/outlets" },
          { title: "Delivery Rankings", url: "/outlet/rankings/delivery" },
          { title: "Recovery Rankings", url: "/outlet/rankings/recovery" },
          { title: "Verification Rankings", url: "/outlet/rankings/verification" },
        ],
      },
      {
        title: "Expenses",
        icon: Icons.CreditCardIcon,
        url: "/outlet/expenses",
        items: [],
      },
      {
        title: "Cash Register",
        icon: Icons.CalculatorIcon,
        url: "/outlet/cash-register",
        items: [],
      },
      {
        title: "Cash Sale",
        icon: Icons.DollarSignIcon,
        url: "/outlet/cash-sale",
        items: [],
      },
      {
        title: "Cash In Hand",
        icon: Icons.BanknoteIcon,
        items: [
          { title: "Pending Collections", url: "/outlet/cash-in-hand" },
          { title: "Pending Submissions", url: "/outlet/cash-in-hand/pending-submissions" },
          { title: "Collection History", url: "/outlet/cash-in-hand/history" },
        ],
      },
      {
        title: "Cash Deposit",
        icon: Icons.BanknoteIcon,
        url: "/outlet/cash-deposit",
        items: [],
      },
      {
        title: "Returns",
        icon: Icons.UndoIcon,
        url: "/outlet/returns",
        items: [],
      },
      {
        title: "Installments",
        icon: Icons.HashIcon,
        items: [
          { title: "Installment Receiving", url: "/outlet/installments" },
          { title: "Installments View", url: "/outlet/installments/view" },
          { title: "Advanced Analytics", url: "/outlet/analytics/installments" }
        ],
      },
      {
        title: "Blacklisted Customers",
        icon: Icons.BanIcon,
        url: "/admin/customers/blacklist",
        items: [],
      },
      {
        title: "Cleared Accounts",
        icon: Icons.CheckCircleIcon,
        url: "/admin/customers/cleared",
        items: [],
      },
      {
        title: "Notifications",
        icon: Icons.BellIcon,
        url: "/notifications",
        items: [],
      },
      {
        title: "Complaints",
        icon: Icons.MessageSquareIcon,
        url: "/outlet/complaints",
        items: [],
      },
      {
        title: "Area Assignments",
        icon: Icons.MapPinIcon,
        items: [
          { title: "Verification Officer", url: "/outlet/area-assignments/verification" },
          { title: "Delivery Officer", url: "/outlet/area-assignments/delivery" },
          { title: "Recovery Officer", url: "/outlet/area-assignments/recovery" },
        ],
      },
      {
        title: "Outlet Reports",
        icon: Icons.FileTextIcon,
        url: "/outlet/reports",
        items: [],
      },
      {
        title: "Security Logs",
        icon: Icons.LockIcon,
        url: "/outlet/security-logs",
        items: [],
      },
    ],
  },
  {
    label: "HR PORTAL",
    items: [
      {
        title: "HR Dashboard",
        icon: Icons.LayoutDashboardIcon,
        url: "/hr/dashboard",
        items: [],
      },
      {
        title: "Employees",
        icon: Icons.UsersIcon,
        items: [
          { title: "Employee List", url: "/hr/employees" },
          { title: "Add Employee", url: "/hr/employees/create" },
        ],
      },
      {
        title: "Attendance",
        icon: Icons.ClockIcon,
        url: "/hr/attendance",
        items: [],
      },
      {
        title: "Loans",
        icon: Icons.HashIcon,
        url: "/hr/loans",
        items: [],
      },
      {
        title: "Documents",
        icon: Icons.FileTextIcon,
        url: "/hr/documents",
        items: [],
      },
      {
        title: "Payroll",
        icon: Icons.CreditCardIcon,
        url: "/hr/payroll",
        items: [],
      },
      {
        title: "Performance",
        icon: Icons.BarChartIcon,
        url: "/hr/performance",
        items: [],
      },
      {
        title: "Pending Leaves",
        icon: Icons.ClipboardCheckIcon,
        url: "/hr/leaves",
        items: [],
      },
      {
        title: "Announcements",
        icon: Icons.BellIcon,
        url: "/hr/announcements",
        items: [],
      },
    ],
  },
  {
    label: "ACCOUNTS PORTAL",
    items: [
      {
        title: "Accounts Dashboard",
        icon: Icons.LayoutDashboardIcon,
        url: "/accounts/dashboard",
        items: [],
      },
      {
        title: "Cash & Banking",
        icon: Icons.BanknoteIcon,
        items: [
          { title: "Cash In Hand", url: "/accounts/cash-in-hand" },
          { title: "Bank Accounts", url: "/accounts/bank-accounts" },
          { title: "Deposit Requests", url: "/accounts/cash-deposits" },
        ],
      },
      {
        title: "Expenses & Vendors",
        icon: Icons.HandshakeIcon,
        items: [
          { title: "Expenses", url: "/accounts/expenses" },
          { title: "Vendors & Payables", url: "/accounts/vendors" },
        ],
      },
      {
        title: "Receivables & Installments",
        icon: Icons.UsersIcon,
        items: [
          { title: "Customer Receivables", url: "/accounts/receivables" },
          { title: "Installment Receiving", url: "/accounts/installment-receiving" },
          { title: "Installment Aging", url: "/accounts/aging" },
          { title: "Monthly Installments", url: "/accounts/monthly-installments" },
        ],
      },
      {
        title: "Analytics & Reports",
        icon: Icons.BarChartIcon,
        items: [
          { title: "Recovery Analytics", url: "/accounts/recovery-analytics" },
          { title: "Installment Flow Analytics", url: "/accounts/installment-flow" },
          { title: "Stock Summary", url: "/accounts/stock-summary" },
          { title: "Reports & Export", url: "/accounts/reports" },
        ],
      },
      {
        title: "Compliance & Security",
        icon: Icons.ShieldCheckIcon,
        items: [
          { title: "Blacklist / Whitelist", url: "/accounts/blacklist" },
          { title: "Activity Log", url: "/accounts/activity-log" },
        ],
      },
      {
        title: "Devices & Payments",
        icon: Icons.LockIcon,
        items: [
          { title: "PayTrigger", url: "/accounts/paytrigger" },
          { title: "Online Payments", url: "/accounts/online-payments" },
        ],
      },
    ],
  },
];




