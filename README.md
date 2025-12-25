# GLBXTNT ERP System

A lightweight, serverless ERP solution designed for internal business operations. Built with **Vanilla JavaScript** and **Supabase**, featuring Role-Based Access Control (RBAC).

## 🚀 Tech Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deployment:** Static Hosting (GitHub Pages / Vercel / Netlify)

## ✨ Key Modules

### 👥 HR & Workforce
- **Attendance:** Daily Clock In/Out tracking.
- **Leave Management:** Request, approve, and track leave balances.
- **Performance:** Quarterly self-appraisals and manager reviews.
- **Status:** Live workforce availability dashboard.

### 💰 Finance
- **Salary:** Payroll processing, bonuses, and salary slips.
- **Expenses:** Employee reimbursement claims with receipt uploads.
- **Ledger:** Centralized finance transaction history (Credit/Debit).

### 🛠️ Operations & Collaboration
- **Team Chat:** Real-time internal messaging with media support.
- **Help Desk:** Internal ticketing system for IT/HR support.
- **Documents:** Secure vault for company policies and files.
- **Notices:** Admin announcement board.

### 🛡️ Admin & Security
- **RBAC:** Roles for Admin, Manager, Finance, and Employee.
- **Audit Logs:** Track sensitive system actions.
- **Security:** Row Level Security (RLS) ensures data privacy.

## 📂 Project Structure
```text
├── css/styles.css        # Global Responsive Stylesheet
├── js/                   # Logic Files
│   ├── supabase.js       # Database Config
│   └── [page].js         # Page-specific logic
├── index.html            # Login Page
├── main.html             # Dashboard
└── [modules].html        # Module pages (attendance, salary, chat, etc.)


⚙️ Setup Instructions
Clone the Repository
git clone <your-repo-url>

Configure Supabase

Create a project at supabase.com.

Go to the SQL Editor and run the provided schema.sql (Tables, Policies, Triggers).

Enable Storage and create buckets: receipts, company_docs, chat_media.

Connect the App

Open js/supabase.js.

Update SUPABASE_URL and SUPABASE_ANON_KEY from your project settings.

Run Locally

Open index.html using a local server (e.g., VS Code Live Server).

Note: File uploads and Auth require a secure context (localhost or HTTPS).

🔐 Default Roles
Admin: Full access to Audit, Finance, and Settings.

Manager: Access to Approvals and Performance Reviews.

Finance: Access to Salary and Ledger.

Employee: Restricted to personal history and requests.