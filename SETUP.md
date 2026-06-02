# FloorVerse — Setup Guide

## Prerequisites

- Node.js v18+ (`node -v`)
- MySQL 8.0+ running locally
- npm v9+

---

## Step 1 — MySQL Database Setup

Open MySQL Workbench or your terminal and run:

```bash
mysql -u root -p < server/migrations/001_initial_schema.sql
```

This creates the `floorverse` database with all tables and a default Super Admin user.

**Default Super Admin credentials:**
- Email:    `admin@floorverse.io`
- Password: `Admin@123`

---

## Step 2 — Configure Backend Environment

The server `.env` file is pre-created at `server/.env`.  
Edit it with your MySQL password:

```
DB_PASSWORD=your_mysql_root_password
```

All other defaults work for local development.

---

## Step 3 — Install Dependencies

From the project root (`floorverse/`):

```bash
# Install root (concurrently)
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

Or run everything at once from root:
```bash
npm run install:all
```

---

## Step 4 — Start Development Servers

From the project root:

```bash
npm run dev
```

This starts:
- **Backend API** → `http://localhost:5000`
- **React Frontend** → `http://localhost:5173`

---

## Step 5 — Open the App

| URL | Description |
|-----|-------------|
| `http://localhost:5173` | Landing Page |
| `http://localhost:5173/login` | Login |
| `http://localhost:5173/register` | Register new developer |
| `http://localhost:5173/dashboard` | Developer Dashboard (protected) |
| `http://localhost:5173/marketplace` | Public 3D Property Marketplace |
| `http://localhost:5000/api/health` | API Health Check |

---

## How to Use FloorVerse

### As a Developer / Tenant Admin:

1. **Register** at `/register` with your company name
2. **Create a Building** at `/buildings` (e.g. "Rajan Heights, Mumbai")
3. **Create a Floor Plan** at `/floor-plans` → linked to your building
4. **Open the Editor** → opens the 2D canvas
5. **Draw rooms**: Click room types in the left panel → click on canvas to place
6. **Resize & position** rooms by dragging handles
7. **Add room details**: name, type, area, notes in the right panel
8. **Save** (Ctrl+S equivalent) → **Preview 3D** → **Publish**
9. **Share the 3D link** with buyers

### As a Buyer / Consumer:

1. Browse `/marketplace`
2. Filter by city, unit type, budget
3. Click any 3D-enabled listing
4. Experience the interactive 3D walkthrough
5. Submit an inquiry → developer is notified

---

## Project Structure

```
floorverse/
├── client/                     # React Frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── Landing/        # Public landing page
│       │   ├── Auth/           # Login & Register
│       │   ├── Dashboard/      # KPI overview
│       │   ├── Buildings/      # Building management
│       │   ├── FloorPlan/      # 2D editor + list
│       │   ├── Viewer/         # Three.js 3D viewer
│       │   ├── Marketplace/    # Public property browse
│       │   └── Leads/          # Inquiry management
│       ├── components/         # Reusable UI components
│       ├── store/              # Zustand state (auth)
│       ├── services/           # Axios API client
│       └── router/             # Protected route
│
├── server/                     # Node.js Backend (Express)
│   └── src/
│       ├── controllers/        # Route handlers
│       ├── routes/             # Express routers
│       ├── middleware/         # Auth, error handling
│       └── config/             # DB connection
│   └── migrations/
│       └── 001_initial_schema.sql
│
├── .env.example
├── package.json                # Root scripts (concurrently)
└── SETUP.md
```

---

## API Endpoints Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register developer |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/logout` | Logout |
| GET  | `/api/auth/me` | Current user |

### Buildings (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/buildings` | List buildings |
| POST   | `/api/buildings` | Create building |
| PUT    | `/api/buildings/:id` | Update building |
| DELETE | `/api/buildings/:id` | Delete building |

### Floor Plans (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/floor-plans` | List floor plans |
| POST   | `/api/floor-plans` | Create floor plan |
| PUT    | `/api/floor-plans/:id` | Update floor plan |
| POST   | `/api/floor-plans/:id/publish` | Publish/unpublish |
| POST   | `/api/floor-plans/:id/rooms` | Save rooms |
| DELETE | `/api/floor-plans/:id` | Delete floor plan |

### Marketplace (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/marketplace/listings` | Browse listings |
| GET    | `/api/marketplace/listings/:id` | Listing detail |
| POST   | `/api/marketplace/listings/:id/inquire` | Submit inquiry |

### Leads (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/marketplace/leads` | List leads |
| PATCH  | `/api/marketplace/leads/:id` | Update lead status |

### Dashboard (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/dashboard/stats` | KPI statistics |

---

## Troubleshooting

**MySQL connection error:**
- Ensure MySQL is running (`brew services start mysql` / `net start mysql`)
- Check `DB_PASSWORD` in `server/.env`
- Verify database exists: `mysql -u root -p -e "SHOW DATABASES;"`

**Port already in use:**
- Backend: change `PORT` in `server/.env`
- Frontend: change `server.port` in `client/vite.config.js`

**npm install fails:**
- Ensure Node.js 18+: `node -v`
- Try `npm install --legacy-peer-deps` if peer dependency conflicts

---

## Phase 2 Roadmap (Next Steps)

- [ ] AWS S3 integration for GLTF scene storage
- [ ] Automated 2D → 3D conversion worker (BullMQ)
- [ ] Razorpay subscription billing
- [ ] DXF/CAD file import
- [ ] Email notifications on new leads (AWS SES)
- [ ] WhatsApp lead notifications
- [ ] 3D engagement heatmaps
- [ ] Furniture 3D model library (GLTF/GLB)
