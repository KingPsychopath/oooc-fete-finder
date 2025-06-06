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

## Real-time CSV Updates

This application supports real-time updates from Google Sheets CSV data. The system automatically fetches updated event data from a Google Sheets document.

### Configuration

Create a `.env.local` file in your project root with the following environment variables:

```bash
# Google Sheets CSV URL for real-time data updates (for public sheets)
# Example: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv
REMOTE_CSV_URL=

# Alternative: Google Sheets API (for private sheets)
# Get API key from Google Cloud Console: https://console.cloud.google.com/
GOOGLE_SHEETS_API_KEY=
GOOGLE_SHEET_ID=
GOOGLE_SHEET_RANGE=A:Z

# Cache duration in milliseconds (default: 3600000 = 1 hour)
CACHE_DURATION_MS=3600000

# Remote refresh check interval in milliseconds (default: 300000 = 5 minutes)
REMOTE_REFRESH_INTERVAL_MS=300000

# Date when local CSV was last updated (for fallback messaging)
# Format: YYYY-MM-DD
LOCAL_CSV_LAST_UPDATED=2025-01-18

# Admin panel access key (default: your-secret-key-123)
ADMIN_KEY=your-secret-key-123

# Optional: Google Sheets integration for email collection
GOOGLE_SHEETS_URL=
```

**.env.example file contents:**
```bash
# Option 1: Public Google Sheets (simplest - make sheet public)
REMOTE_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv

# Option 2: Private Google Sheets via API Key (requires API key)
# GOOGLE_SHEETS_API_KEY=your-api-key
# GOOGLE_SHEET_ID=your-sheet-id
# GOOGLE_SHEET_RANGE=A:Z

# Option 3: Private Google Sheets via Service Account (most secure - requires JSON file)
# GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"..."}
# GOOGLE_SHEET_ID=your-sheet-id
# GOOGLE_SHEET_RANGE=A:Z

# Cache settings
CACHE_DURATION_MS=3600000
REMOTE_REFRESH_INTERVAL_MS=300000
LOCAL_CSV_LAST_UPDATED=2025-01-18

# Admin access
ADMIN_KEY=your-secret-key-123

# Optional integrations
GOOGLE_SHEETS_URL=your-google-apps-script-url
```

### How it works

1. **Data Source**: When `USE_CSV_DATA` is `true` in `data/events.ts` and `REMOTE_CSV_URL` is configured, the app fetches data from Google Sheets
2. **Fallback**: If Google Sheets is unavailable, it falls back to the local CSV file
3. **Caching**: Data is cached for 1 hour (configurable) to improve performance
4. **Auto-refresh**: Remote data is checked every 5 minutes (configurable)
5. **Admin Control**: Use `/admin` to monitor cache status and force refresh
6. **Error Handling**: User-friendly messages when using fallback data with last-updated dates

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
- **`data/events.ts`** - Configuration flags (`USE_CSV_DATA`) and helper functions
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