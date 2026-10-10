# ALFA CRM Enterprise 🚀
### Full-Featured, Fully Functional CRM (Inspired by Zoho CRM)

**ALFA CRM** is a complete, production-grade Customer Relationship Management system built to mirror the core enterprise capabilities and workflows of **Zoho CRM**.

---

## 🌟 Key Functional Modules (Zoho CRM Equivalence)

### 1. 🎯 Leads Management & Predictive AI Scoring
- **Omni-channel Lead Capture**: Tracks first/last name, company, email, phone, annual revenue, industry, lead source, and rating.
- **Predictive AI Lead Scoring (Zoho Zia-like)**:
  - Automatically calculates lead engagement score (`0 - 100`) with visual heat badges: **🔥 Hot (80+)**, **⚡ Warm (50-79)**, and **❄️ Cold (<50)**.
- **Dual Visual Modes**: Switch dynamically between **Table View** and **Status Kanban Board** (`New` → `Attempted to Contact` → `Contacted` → `In Progress` → `Qualified`).
- **Simulated Sales Email Center (Zoho SalesInbox)**:
  - Compose and send personalized sales emails directly from the lead profile using pre-configured enterprise templates (*Executive Introduction*, *Proposal Delivery*, *Contract Follow-up*).
  - Automatically tracks delivery and open status in the communication log.
- **Zoho 1-Click Conversion Wizard**: 
  - Converts any qualified lead into an **Account** (Organization), **Contact** (Person), and optional **Deal** (Pipeline opportunity with closing date & forecast amount).

### 2. 💼 Deals & Pipeline Velocity (Interactive Kanban)
- **Interactive Drag-and-Drop Kanban Board**:
  - 7 Standard Pipeline Stages: `Qualification (10%)` → `Needs Analysis (20%)` → `Value Proposition (40%)` → `Proposal / Price Quote (60%)` → `Negotiation / Review (80%)` → `Closed Won (100%)` → `Closed Lost (0%)`.
  - Dragging a card across stages automatically calculates probability, re-computes weighted pipeline revenues, updates database records, and logs history notes.
- **Priority Badges & Stage Velocity Warnings**:
  - Color-coded priority tiers (`High`, `Medium`, `Low`).
  - Real-time days-in-stage counter with aging warnings (flags deals in stage > 5 days).
- **Quick Deal Segmentation**: Filter in 1-click for *Enterprise Deals (> $50k)*, *High Probability (≥ 60%)*, or *Closing Next 30 Days*.
- **Zoho Chevron Progress Indicator**: Visually highlights deal journey from qualification to won.

### 3. 📈 Executive BI & Sales Conversion Funnel (NEW)
- **Interactive Visual Sales Funnel**:
  - Proportional drop-off funnel bars tracking conversion from *Website Inquiries* (100%) down to *Closed Won Contracts* (29%), with deal volumes, dollar amounts, and stage-by-stage drop-off rates.
- **6-Month Revenue & Pipeline Trajectory Area Chart**:
  - Multi-series gradient area charts comparing Closed Won Revenue against Total Pipeline Created and quarterly Quota goals.
- **Rep Quota Attainment Tracker**:
  - Individual quota progress meters for each sales rep ($150k target, $122k achieved = 81%), remaining gap, and pacing status (*Achieved* / *On Track* / *Needs Focus*).
- **Zia AI Sales Pulse Insights**:
  - Human-readable narrative intelligence highlighting quota coverage health (240%), hot conversion-ready leads, and urgent closing deals.

### 3. 🏢 Accounts & 👥 Contacts (360° Customer View)
- **Account 360 View**: Full institutional profile with linked parent companies, child contacts, open deals, active quotes, activity history, and notes.
- **Contacts Directory**: Direct stakeholder phone/email, linked account, job title, and linked sales opportunities.

### 4. 📅 Activities, Tasks, Calls & Calendar
- **Activity Types**: 
  - **Tasks**: Checkbox completion, priorities (`High`, `Normal`, `Low`), due dates.
  - **Call Logs**: Log inbound/outbound calls, call duration, and results (`Interested`, `Left Message`, `Busy`, `Follow-up Requested`).
  - **Meetings**: Schedule team and client syncs with location/Zoom links.
- **Interactive Monthly Calendar View**: Visual day-by-day calendar with clickable task markers and instant completion.

### 5. 📦 Products & 📑 Quotes / Invoices
- **Product Catalog & Price Books**: Product codes (SKUs), unit prices, categories, and inventory stock.
- **Dynamic Multi-Line Item Quote Builder**:
  - Add products from catalog with live line item calculation (`Qty` × `Unit Price` − `Discount %`).
  - Global quote discount % and tax rate % auto-calculations.
- **Zoho-Style Printable Quote / PDF Preview**:
  - Formal client quote template with logo, header, billing address, itemized breakdown, terms & conditions, and authorized signature lines.
  - 1-Click **"Print / Save as PDF"** via native browser print engine.

### 6. 📊 Executive Dashboard & Analytics
- **KPI Summary Cards**: Pipeline Value, Closed Won Revenue, Sales Win Rate %, Active Leads count, Pending Tasks due today.
- **Visual Charts (Recharts)**:
  - **Pipeline Funnel ($ by Stage)**: Stage-by-stage deal volume and value.
  - **Lead Sources Donut Chart**: Breakdown of inbound channels.
  - **Sales Rep Leaderboard**: Real-time rankings of closed revenue and active pipeline by account manager.
  - **Recent Activity Timeline**: Chronological log of recent tasks and customer touchpoints.

### 7. ⚡ Workflow Automation Rules Engine
- Pre-configured automated rules:
  - **Instant Welcome Task**: Auto-creates discovery call task upon new lead entry.
  - **Closed Won Celebration**: Automatically updates quote status upon deal win.
  - **High-Value Deal Alert**: Alerts management on deals > $50,000.
  - **Stale Lead Re-engagement**: Detects inactive leads.
- Toggle rules active/inactive with real-time database persistence.

### 8. 🔍 Global Omnibar Search (Zoho-Style)
- Unified search bar across all leads, accounts, contacts, deals, and activities.
- Instant live dropdown suggestions with 1-click deep linking into record drawers.

### 9. ⚙️ Custom Fields & CSV Tools
- **Custom Field Builder**: Add custom text, number, dropdown, or date fields to any module (Leads, Deals, Contacts, Accounts).
- **1-Click CSV Export**: Download current records for any module as `.csv`.
- **Bulk CSV Lead Importer**: Paste CSV text to import dozens of leads in batch.
- **1-Click Demo Reset**: Re-seed the system with realistic corporate demo accounts, deals, and activities anytime.

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Node.js, Express, embedded native `node:sqlite` (zero external C++ binary compilation required; robust SQLite WAL mode).
- **Frontend**: React 19, Vite 8, Tailwind CSS v4, Lucide Icons, Recharts.
- **Database**: Local SQLite database stored in `server/crm.db`.

---

## 🚀 Running the CRM

The CRM server is already configured and running at:
👉 **`http://localhost:5001`**

To run or restart manually at any time:

```bash
# From the root folder:
npm start
```

This starts the unified server at **`http://localhost:5001`**, serving both the full REST API and the built responsive React SPA!

For local development with Vite hot reloading:
```bash
# Terminal 1: Backend API
npm run server

# Terminal 2: Vite Dev Frontend (port 3000)
npm run client
```
