SCC Audit System
A full-stack Inventory Audit Management System designed to streamline the reconciliation process between physical stock counts and system records (ODIN). The application facilitates role-based workflows for Admins, Staff (Auditors), and Clients to track SKU discrepancies in real-time.

🚀 Key Features
1. Admin Dashboard
Live Monitoring: View real-time inventory submissions and their status (Auto-Approved, Pending, Rejected).

Audit Trail: Download comprehensive CSV reports with an "Attempt" history tracking (1, 2, Final) for every SKU.

Bulk Management: Upload Staff, Clients, and Reference Inventory (ODIN) data via CSV templates.

User Management: Edit user details, reset PINs, and manage location mappings.

2. Staff (Auditor) Portal
Location-Based Access: Staff must select their active warehouse location upon login.

Smart SKU Lookup: Fetches Reference Inventory data (Name, Min Qty, Locations).

Duplicate Warning: Alerts the staff if an SKU has already been submitted by another user, showing the previous timestamp and status.

Detailed Entry: Input counts for Picking, Bulk, Near Expiry, JIT, and Damaged stock.

Real-time Calculation: Automatically calculates discrepancies (Excess/Shortfall) against system data.

3. Client Portal
Discrepancy Review: Clients only see items with "Excess" or "Shortfall" status.

Approval Workflow: Ability to Approve (accept variance) or Reject (request recount) with mandatory comments.

Dashboard: High-level view of pending actions and audit history.

4. Mobile Optimized (PWA)
Built as a Progressive Web App (PWA).

Can be installed on Android/iOS home screens without an App Store download.

Optimized for mobile view for on-floor staff entry.

🛠 Tech Stack
Frontend: Next.js (React), Tailwind CSS, Axios, Papaparse (CSV logic).

Backend: Node.js, Express.js.

Database: MongoDB (Mongoose ODM).

Authentication: JWT (JSON Web Tokens) with Role-Based Access Control (RBAC).

⚙️ Installation & Setup
Prerequisites
Node.js (v14+)

MongoDB Instance (Local or Atlas)

1. Backend Setup
Navigate to the backend folder:

Bash

cd backend
npm install
Create a .env file in the backend directory:

Code snippet

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
Start the server:

Bash

npm start
2. Frontend Setup
Navigate to the frontend folder:

Bash

cd frontend
npm install
Create a .env.local file in the frontend directory:

Code snippet

NEXT_PUBLIC_API_URL=http://localhost:5000
Start the application:

Bash

npm run dev
The app should now be running on http://localhost:3000.

🔄 Audit Workflow
Setup: Admin uploads the "Reference Inventory" (ODIN data) and creates Staff/Client accounts via CSV.

Counting: Staff logs in, scans/searches an SKU ID.

If Match: The system calculates Total Physical == ODIN Max. Entry is Auto-Approved.

If Mismatch: The system flags Excess or Shortfall. Staff must select a mapped Client to "Raise Objection."

Review: The assigned Client sees the discrepancy in their dashboard.

Approve: The count is accepted. Status becomes client-approved.

Reject: The entry is sent back with comments. Status becomes client-rejected.

Reporting: Admin downloads the "Audit Report CSV" to see the final status and the history of attempts for every SKU.

📂 CSV Templates
The Admin panel accepts the following CSV formats:

Inventory: SKU ID, Name of the SKU ID, Picking Location, Bulk Location, Quantity as on the date of Sampling

Staff/Client: Staff ID, Login PIN, Name, Location1, Location2, ... Location6

🤝 Contributing
Fork the repository.

Create your feature branch (git checkout -b feature/AmazingFeature).

Commit your changes (git commit -m 'Add some AmazingFeature').

Push to the branch (git push origin feature/AmazingFeature).

Open a Pull Request.
