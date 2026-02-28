# 🚢 WholeSail

**Wholesale Smarter. Close Faster.**

A lead intelligence and workflow platform built for real estate wholesalers. WholeSail ingests data from public and proprietary sources, scores motivation signals, and provides a CRM-like workflow to contact, track, and hand off deals.

---

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v18+) — Download from [nodejs.org](https://nodejs.org)
2. **Supabase account** — Sign up at [supabase.com](https://supabase.com)
3. **Vercel account** — Sign up at [vercel.com](https://vercel.com)
4. **GitHub account** — For version control

### Step-by-Step Setup

#### 1. Clone and install

```bash
# Navigate to where you want the project
cd ~/Desktop   # or wherever you prefer

# Clone your repo (replace with your actual repo URL)
git clone https://github.com/YOUR-USERNAME/wholesail.git
cd wholesail

# Install dependencies
npm install
```

#### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose **US East** region, set a database password (save it!)
3. Once created, go to **Project Settings → Database**
4. Copy the **Connection string (URI)** — it looks like:
   ```
   postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```
5. Replace `[PASSWORD]` with your actual database password

#### 3. Configure environment

```bash
# Copy the example env file
cp .env.example .env
```

Open `.env` in VS Code and fill in your Supabase values:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_ANON_KEY"
```

#### 4. Set up the database

```bash
# Push the schema to Supabase
npx prisma db push

# Seed initial data (regions, scoring weights)
npx prisma db seed

# (Optional) Open Prisma Studio to view your data
npx prisma studio
```

#### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see WholeSail!

#### 6. Deploy to Vercel

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Initial WholeSail scaffold"
   git push
   ```
2. Go to [vercel.com](https://vercel.com), click **Add New → Project**
3. Import your GitHub repo
4. Add your environment variables (same as `.env`)
5. Click **Deploy**

Done! You'll get a live URL like `https://wholesail-xxx.vercel.app`

---

## 📁 Project Structure

```
wholesail/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Dashboard page
│   ├── leads/              # Leads list + detail pages
│   │   └── [id]/           # Individual lead page
│   ├── handoff/            # Hand-off center
│   ├── settings/           # Settings & configuration
│   ├── layout.tsx          # Root layout (sidebar, topbar)
│   ├── globals.css         # Global styles & theme
│   └── page.tsx            # Root redirect → /dashboard
├── components/
│   ├── layout/             # Sidebar, TopBar, MobileNav
│   └── shared/             # ThemeProvider
├── lib/
│   └── mockData.ts         # Mock data (replaced by DB later)
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.mjs            # Seed script
├── public/                 # Static assets (logo goes here)
└── styles/                 # Additional styles if needed
```

---

## 🎨 Theme

WholeSail uses a custom color scheme derived from the brand logo:

| Color | Hex | Usage |
|-------|-----|-------|
| Deep Teal | `#0A7E8C` | Primary buttons, active states |
| Ocean Blue | `#1B98A8` | Hover states, links |
| Bright Cyan | `#2EC4D4` | Accents, highlights |
| Dark BG | `#0B1120` | Dark mode background |
| Dark Surface | `#131D35` | Dark mode cards |

Light/Dark mode toggle is built in. Theme persists via localStorage.

---

## 🛠️ VS Code Recommended Extensions

- **Prisma** — Schema highlighting
- **Tailwind CSS IntelliSense** — Class autocomplete
- **ESLint** — Error detection
- **Prettier** — Code formatting

---

## 📋 Development Roadmap

### Phase 1 ✅ — Foundation (current)
- [x] Project scaffold with Next.js
- [x] Database schema (Prisma + Supabase)
- [x] Light/Dark mode theming
- [x] Responsive layout with collapsible sidebar
- [x] Dashboard with stats and priority leads
- [x] Leads list with sorting/filtering
- [x] Lead detail with score breakdown
- [x] Hand-off center
- [x] Settings with configurable scoring weights
- [x] Mock data for all views

### Phase 2 — Database Integration
- [ ] Connect mock data to real Supabase queries
- [ ] CRUD API routes for leads, contacts, notes
- [ ] Real-time scoring engine
- [ ] Manual signal input forms

### Phase 3 — Data Sources
- [ ] First 3-4 data source connectors (Lehigh Valley)
- [ ] Automated scraping scheduler
- [ ] Source health monitoring

### Phase 4 — Outreach
- [ ] Twilio SMS integration
- [ ] Click-to-call dialer
- [ ] Message templates
- [ ] Drip campaigns

### Phase 5 — Analytics & Scaling
- [ ] Zip code heatmap
- [ ] Conversion funnel analytics
- [ ] Second region support
- [ ] Hand-off email generation

---

## 📝 Notes

- The prototype currently uses **mock data** in `lib/mockData.ts`. All data shown is realistic but not real.
- When ready to connect to Supabase, we'll replace mock data imports with Prisma queries.
- The data source connector architecture is designed to be modular — each source is a separate module that outputs normalized lead records.
