<p align="center">
  <img src="https://img.shields.io/badge/AI%20Food%20Inventory-Expiry%20Management-emerald?style=for-the-badge&logoColor=white" alt="AI Food Inventory" />
  <img src="https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Gemini-2.5--flash-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" />
</p>

# 🍽️ AI-Powered Food Inventory & Expiry Management System

> An intelligent kitchen management platform that uses **Gemini Vision AI** to scan food labels, predict expiry risks, generate zero-waste recipes, and power a **cross-institution surplus redistribution network** — reducing food waste at scale.

---

## 🎯 Problem Statement

Institutional kitchens (hostels, colleges, hotels) waste **30–40%** of food due to:
- No real-time visibility into expiry dates across hundreds of SKUs
- Manual tracking that is error-prone and ignored under pressure
- Surplus food that expires before nearby institutions who need it even know it exists
- FSSAI compliance gaps that risk health violations

This system solves all four with AI-first automation.

---

## ✨ Key Features

### 📷 Gemini Vision Smart Scan
- Upload a photo of any food label → **Gemini 2.5 Flash** extracts product name, expiry date, FSSAI number, storage instructions, category, and more
- No manual data entry — scan and confirm in seconds

### 📊 Real-Time Dashboard
- Live inventory stats: total items, expiring soon, critical, expired
- Risk-level color coding with animated threat indicators
- One-click navigation to any module

### 🔔 Intelligent Alert System
- Automated daily expiry checks at 7:00 AM IST (APScheduler)
- Three-tier risk classification: `EXPIRING_SOON` → `CRITICAL` → `EXPIRED`
- Email digest via Resend + SMS alerts via Twilio for critical items
- Alert Center with threat summary and FSSAI compliance tips

### 🤖 AI-Powered Analytics
- **Gemini-generated recommendations**: purchase optimization, waste reduction strategies
- **Zero-waste recipes**: AI creates recipes from your about-to-expire items
- Consumption vs. waste rate tracking per product

### 📋 FSSAI Compliance Engine
- Automated compliance report generation (PDF via ReportLab)
- Product-level FSSAI license tracking
- Regulatory audit-ready documentation

### 🔄 Surplus Intelligence Network
- **Cross-institution surplus matching**: detects surplus items and finds nearby institutions that need them
- Two-sided flow: incoming requests (recipient) + outgoing dispatches (donor)
- Real-time logistics simulation with transit tracking
- **Google Places Discovery**: finds real nearby colleges, hostels, hotels to grow the network
- Invite-to-join system for discovered places

### 🔐 Department-Based Access Control
- Each department (Snacks, Drinks, Dairy, Produce, Bakery, Spices) gets unique credentials
- Scoped view: department staff sees **only** Scan + their own logs
- Items auto-tagged with department code on scan
- Admin view retains full access to all features

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                │
│  Dashboard │ Scan │ Alerts │ Analytics │ Surplus │ Dept  │
└──────────────────────────┬───────────────────────────────┘
                           │ REST API
┌──────────────────────────▼───────────────────────────────┐
│                  Backend (FastAPI + Python)               │
│                                                          │
│  Routers: inventory │ scan │ alerts │ analytics │        │
│           compliance │ surplus │ auth                     │
│                                                          │
│  Services: gemini_service │ email_service │               │
│            surplus_service │ places_service │              │
│            compliance_service                             │
│                                                          │
│  Scheduler: APScheduler (daily 7 AM IST cron)            │
└────────┬──────────┬──────────┬───────────────────────────┘
         │          │          │
    ┌────▼───┐ ┌────▼───┐ ┌───▼────────┐
    │Supabase│ │ Gemini │ │ Google     │
    │  (DB)  │ │ 2.5    │ │ Places API │
    └────────┘ │ Flash  │ └────────────┘
               └────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Framer Motion |
| **Backend** | FastAPI, Python 3.10+, Pydantic v2 |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **AI/ML** | Google Gemini 2.5 Flash (Vision + Text) |
| **Scheduler** | APScheduler (background cron jobs) |
| **Email** | Resend API |
| **SMS** | Twilio (optional) |
| **Maps** | Google Places API (New) |
| **PDF** | ReportLab |
| **Deployment** | Docker, Google Cloud Run |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Supabase project (free tier works)
- Google Gemini API key

### 1. Clone & Setup Backend

```bash
git clone https://github.com/your-repo/ai-food-inventory.git
cd ai-food-inventory

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key

# Optional
RESEND_API_KEY=re_your_key
GOOGLE_MAPS_API_KEY=your-maps-key
TWILIO_ACCOUNT_SID=your-sid
```

### 3. Initialize Database

Run the SQL migrations in order in **Supabase Dashboard → SQL Editor**:

```
supabase/schema.sql                  # Core tables
supabase/002_surplus_network.sql     # Surplus matching
supabase/003_discovered_places.sql   # Google Places cache
supabase/004_departments.sql         # Department auth
```

### 4. Start Backend

```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Start Frontend

```bash
cd Frontend
npm install
npm run dev
```

Open **http://localhost:5173** — you're live! 🎉

---

## 📁 Project Structure

```
ai-food-inventory/
├── app/
│   ├── main.py                 # FastAPI app + CORS + scheduler
│   ├── config.py               # Pydantic settings from .env
│   ├── database.py             # Supabase client singleton
│   ├── scheduler.py            # APScheduler daily expiry check
│   ├── models/
│   │   └── schemas.py          # Pydantic request/response models
│   ├── routers/
│   │   ├── scan.py             # POST /api/scan (Gemini Vision)
│   │   ├── inventory.py        # CRUD + stats + consume/waste
│   │   ├── alerts.py           # Alert listing + resolve
│   │   ├── analytics.py        # Patterns + AI recommendations + recipes
│   │   ├── compliance.py       # FSSAI report generation
│   │   ├── surplus.py          # Surplus matching + nearby places
│   │   └── auth.py             # Department login
│   └── services/
│       ├── gemini_service.py   # Gemini 2.5 Flash API wrapper
│       ├── email_service.py    # Resend email digest
│       ├── surplus_service.py  # Cross-institution matching engine
│       ├── places_service.py   # Google Places API + caching
│       └── compliance_service.py # PDF report generation
├── Frontend/
│   └── src/
│       ├── App.tsx             # Root app with department routing
│       ├── api.ts              # API client with mock fallbacks
│       ├── types.ts            # TypeScript interfaces
│       └── components/
│           ├── Header.tsx
│           ├── DashboardView.tsx
│           ├── ScanView.tsx
│           ├── AlertsView.tsx
│           ├── AnalyticsView.tsx
│           ├── ComplianceView.tsx
│           ├── SurplusView.tsx
│           ├── DepartmentLoginPage.tsx
│           └── DepartmentScopedView.tsx
├── supabase/
│   ├── schema.sql
│   ├── 002_surplus_network.sql
│   ├── 003_discovered_places.sql
│   └── 004_departments.sql
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## 🔌 API Endpoints

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/inventory` | List items (filter by status, category, risk, department) |
| `GET` | `/api/inventory/stats` | Dashboard stat cards |
| `GET` | `/api/inventory/{id}` | Get single item |
| `POST` | `/api/inventory` | Create item (after scan) |
| `PUT` | `/api/inventory/{id}` | Update item |
| `DELETE` | `/api/inventory/{id}` | Delete item |
| `POST` | `/api/inventory/{id}/consume` | Mark as consumed |
| `POST` | `/api/inventory/{id}/waste` | Mark as wasted |

### Scan
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scan` | Upload image → Gemini Vision extraction |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/alerts` | List all alerts |
| `GET` | `/api/alerts/summary` | Threat count summary |
| `POST` | `/api/alerts/resolve/{id}` | Resolve an alert |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics` | Consumption/waste patterns |
| `GET` | `/api/analytics/recommendations` | Gemini AI recommendations |
| `GET` | `/api/analytics/recipes` | Zero-waste recipe generation |

### Compliance
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/compliance/report` | Generate FSSAI PDF report |

### Surplus Network
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/surplus/detect` | Detect surplus items |
| `POST` | `/api/surplus/match/{id}` | Trigger matching for institution |
| `GET` | `/api/surplus/matches` | List all matches |
| `PATCH` | `/api/surplus/matches/{id}/respond` | Accept/decline match |
| `GET` | `/api/surplus/nearby-places` | Discover nearby institutions (Google Places) |
| `POST` | `/api/surplus/nearby-places/{id}/invite` | Invite a discovered place |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/departments` | List departments |
| `POST` | `/api/auth/department-login` | Department staff login |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/api/scheduler/run` | Manual expiry check trigger |

---

## 🔑 Department Credentials (Demo)

| Department | Code | Password |
|-----------|------|----------|
| 🍿 Snacks | `SNACKS` | `snacks123` |
| 🥤 Drinks | `DRINKS` | `drinks123` |
| 🥛 Dairy | `DAIRY` | `dairy123` |
| 🥬 Produce | `PRODUCE` | `produce123` |
| 🍞 Bakery | `BAKERY` | `bakery123` |
| 🧂 Spices | `SPICES` | `spices123` |

---

## 🐳 Docker Deployment

```bash
docker build -t ai-food-inventory .
docker run -p 8000:8000 --env-file .env ai-food-inventory
```

---

## 🏆 What Makes This Unique

- **AI-First** — Gemini Vision eliminates manual data entry entirely
- **Cross-Institution Surplus Network** — Institution-to-institution food redistribution matching
- **Google Places Growth Loop** — Actively discovers nearby institutions to expand the network
- **Department Scoping** — Role-based access per kitchen section (Snacks, Dairy, etc.)
- **FSSAI Compliance** — Automated regulatory report generation
- **Zero-Waste Recipes** — AI creates recipes from expiring items instead of discarding them

---

## 📄 License

Apache-2.0
