This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 🏗️ System Architecture & Data Flow

This application uses a sophisticated caching system to provide fresh event data from Google Sheets while maintaining excellent performance.

### 📊 Complete Data Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Google Sheets  │───▶│  Cache Manager   │───▶│   User Visits   │
│   (Data Source) │    │ (Smart Caching)  │    │   Website       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ Every 5-30min         │ Cache Duration        │ Live Updates
         │ (configurable)        │ 30min - 2hrs          │ Every 60sec
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Calls     │    │   Memory Cache   │    │  Progress Bars  │
│   Rate Limited  │    │   + Fallbacks    │    │  & Countdowns   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### ⚙️ Smart Cache Strategy

**Two-Layer System:**
1. **Remote Check Interval** (5-30 min): How often to check if refresh is needed
2. **Cache Duration** (30min-2hrs): How long to serve cached data before forcing refresh

**Why This Works:**
- Frequent monitoring without excessive API calls
- Fresh data when needed, cached performance when possible
- Admin override for immediate updates

### 🎯 Recommended Settings by Traffic

| Traffic Level | Visitors/Day | Cache Duration | Check Interval | API Calls/Day |
|---------------|--------------|----------------|----------------|---------------|
| **Low**       | < 1,000      | 30 minutes     | 5 minutes      | ~288          |
| **Medium**    | 1K - 10K     | 1 hour         | 10 minutes     | ~144          |
| **High**      | 10K+         | 2 hours        | 30 minutes     | ~48           |

### 🔧 Configuration

Create a `.env.local` file with these environment variables:

```bash
# === GOOGLE SHEETS INTEGRATION (choose one method) ===

# Method 1: Public Sheet (simplest - make sheet publicly viewable)
REMOTE_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv

# Method 2: Private Sheet with API Key (requires Google Cloud setup)
# GOOGLE_SHEETS_API_KEY=your-api-key-from-google-cloud
# GOOGLE_SHEET_ID=your-sheet-id-from-url
# GOOGLE_SHEET_RANGE=A:Z

# Method 3: Private Sheet with Service Account (most secure)
# GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
# GOOGLE_SHEET_ID=your-sheet-id-from-url
# GOOGLE_SHEET_RANGE=A:Z

# === CACHE PERFORMANCE SETTINGS ===
# How long to cache data before forcing refresh
CACHE_DURATION_MS=3600000          # 1 hour (recommended for medium traffic)

# How often to check if refresh is needed
REMOTE_REFRESH_INTERVAL_MS=600000   # 10 minutes (recommended for medium traffic)

# === FALLBACK & ADMIN ===
# Date when local CSV was last updated (for fallback messaging)
LOCAL_CSV_LAST_UPDATED=2025-01-18

# Admin panel access (change this!)
ADMIN_KEY=your-secret-admin-key-123

# === OPTIONAL INTEGRATIONS ===
# Google Apps Script URL for email collection
GOOGLE_SHEETS_URL=your-google-apps-script-deployment-url
```

### 📈 How The System Works

#### 1. **Data Source (Google Sheets)**
- Your event data lives in a Google Sheets document
- Contains columns: name, date, location, genre, featured, etc.
- Can be public (anyone with link) or private (API access)

#### 2. **Cache Manager (Server-Side)**
```
Every [Check Interval]:
├── Is cache expired? (older than Cache Duration)
│   ├── YES → Fetch fresh data from Google Sheets
│   └── NO → Keep serving cached data
├── Admin forced refresh?
│   └── YES → Fetch fresh data immediately
└── Google Sheets unavailable?
    └── Serve local CSV fallback with timestamp
```

#### 3. **User Experience (Client-Side)**
- **Page Load**: Gets data from cache (fast)
- **Live Updates**: Progress bars update every 60 seconds
- **Featured Events**: Real-time countdown timers
- **Fresh Data**: New events appear within your check interval

#### 4. **Admin Control (`/admin`)**
- Monitor cache status and data freshness
- Force immediate refresh (bypasses cache)
- View Google Sheets statistics
- Handle date format warnings
- Configure dynamic sheet sources

### 🔄 Real-World Example

**Timeline with 1-hour cache, 10-minute checks:**

```
09:00 - User visits → Fresh data fetched, cached
09:10 - Check: "Cache 10min old" → Serve cached data
09:20 - Check: "Cache 20min old" → Serve cached data
09:30 - Check: "Cache 30min old" → Serve cached data
...
10:10 - Check: "Cache 70min old, expired!" → Fetch fresh data
10:20 - Check: "Cache 10min old" → Serve cached data
```

**Admin override:**
```
09:15 - Admin clicks refresh → Immediate fresh fetch
09:25 - Check: "Cache 10min old" → Serve cached data
```

### 🛡️ Fallback Strategy

1. **Primary**: Google Sheets API/CSV export
2. **Secondary**: Local CSV file (when remote fails)
3. **Graceful**: Show last-updated timestamp to users
4. **Recovery**: Automatic retry on next check interval

### 🎨 User Interface Features

- **Live Countdown**: Featured events show real-time progress
- **Auto-Refresh**: Progress bars update every minute
- **Status Indicators**: Active → Expires Soon → Expired
- **Smart Warnings**: Future date corrections with user guidance
- **Hydration Safe**: Server/client rendering consistency

## System Architecture & Data Flow

### 🏗️ Application Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Visit    │───▶│   Check Cache    │───▶│  Return Cached  │
│      "/"        │    │  (< 1 hour old?) │    │   (if fresh)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │ No/Expired
                              ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Try Remote     │───▶│  Service Account │───▶│   Update Cache  │
│ (every 5 min)   │    │    API Key       │    │ lastDataSource  │
└─────────────────┘    │   Direct CSV     │    │   = 'remote'    │
                       └──────────────────┘    └─────────────────┘
                              │ All Fail
                              ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Local Fallback │───▶│  Read CSV File   │───▶│   Update Cache  │
│   (backup)      │    │ oooc-list-*.csv  │    │ lastDataSource  │
└─────────────────┘    └──────────────────┘    │   = 'local'     │
                                               └─────────────────┘
```

### 📊 Data Source States

#### **📡 "Remote" - Live Google Sheets Data**
- **When**: Successfully fetched from Google Sheets
- **Triggers**: 
  - First app load (if no cache)
  - Every 5 minutes auto-refresh
  - Force refresh from admin panel
- **Best State**: Most up-to-date data

#### **📁 "Local" - Backup CSV File**
- **When**: Remote Google Sheets fetch fails
- **File**: `data/oooc-list-tracker4.csv`
- **Triggers**:
  - Google Sheets API errors (401, 403, etc.)
  - Network connectivity issues
  - Invalid credentials
- **Fallback State**: Uses backup data

#### **💾 "Cached" - Startup State**
- **When**: 
  - Server restart/cold start (initial state)
  - Very first admin panel access before data loads
- **Rare State**: Quickly changes to 'remote' or 'local' once data loads

### 🔄 Data Loading Flow

1. **Initial Page Load** (`app/page.tsx`)
   ```typescript
   export default async function Home() {
       const { data: events } = await getEvents(); // Server-side fetch
       return <EventsClient initialEvents={events} />;
   }
   ```

2. **Smart Caching Logic** (`app/actions.ts`)
   ```
   getEvents() → Check Cache → Try Remote → Fallback to Local
   ```

3. **Multiple Authentication Methods**
   ```
   fetchRemoteCSV() tries in order:
   ├── Direct CSV (public sheets)
   ├── Service Account (most secure)
   └── API Key (simpler setup)
   ```

### ⚙️ Key Configuration

```typescript
// Timing Configuration (environment variables)
CACHE_DURATION = 1 hour           // How long cache is "fresh"
REMOTE_REFRESH_INTERVAL = 5 minutes  // How often to check Google Sheets

// In-Memory Cache Variables (server-side)
let cachedEvents: Event[] | null = null;
let lastFetchTime = 0;
let lastRemoteFetchTime = 0;
let lastDataSource: 'remote' | 'local' | 'cached';
```

### 🕐 Auto-refresh Triggers

1. **User visits main page** + cache expired (> 1 hour)
2. **Admin panel auto-refresh** (every 30 seconds)
3. **Background refresh** when remote check interval passes (5 minutes)
4. **Manual force refresh** from admin panel

### 📁 File Structure & Responsibilities

#### **Data Layer**
- **`app/actions.ts`** - All data fetching, caching, and server actions
- **`data/events.ts`** - Configuration flags (`DATA_SOURCE`) and helper functions
- **`data/oooc-list-tracker4.csv`** - Local backup data

#### **UI Layer**
- **`app/page.tsx`** - Server-side initial data fetch
- **`app/events-client.tsx`** - Client-side event display and filtering
- **`app/admin/`** - Admin panel for monitoring and management

#### **Admin Monitoring**
- **`app/admin/page.tsx`** - Main admin interface
- **`app/admin/components/CacheManagementCard.tsx`** - Cache status display
- **`app/admin/types.ts`** - TypeScript definitions for admin data

### 💡 Monitoring Tips

- **"Remote" = Best** - Live, up-to-date data from Google Sheets
- **"Local" = Check connectivity** - Google Sheets may be unreachable
- **"Cached" = Server restart** - Rare, usually means fresh server instance
- **Watch timestamps** - "Last Successful Remote Connection" shows data freshness
- **Cache Age** - Shows how old your current data is

The system is designed for **resilience** - it always tries to get the freshest data from Google Sheets, but gracefully falls back to local CSV if there are issues, ensuring your app always has event data to display.

### Admin Panel

Access the admin panel at `/admin` to:
- Monitor cache status and data source
- View real-time connection status and error messages
- See when remote data was last successfully fetched
- Force refresh the events data
- Manage collected email addresses

Default admin key: `your-secret-key-123` (set `ADMIN_KEY` env var to change)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Google Sheets Authentication

The app supports three methods to fetch data from private Google Sheets:

1. **Direct CSV Export** (for public sheets)
2. **API Key Method** (simple but requires sheet sharing)
3. **Service Account Method** (most secure, recommended)

#### Service Account Setup (Recommended)

**For Vercel Deployment:**
```bash
# Use JSON string in environment variable (required for serverless)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_SHEET_RANGE=A:Z
```

**For Local Development:**
```bash
# Option 1: JSON string (works everywhere)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}

# Option 2: File path (local development only)
GOOGLE_SERVICE_ACCOUNT_FILE=service-account.json
```

**⚠️ Important:** File paths (`GOOGLE_SERVICE_ACCOUNT_FILE`) only work in local development. For Vercel deployment, you **must** use the JSON string method (`GOOGLE_SERVICE_ACCOUNT_KEY`).