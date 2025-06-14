# 🎯 Co-located Google Integrations

This directory provides **properly separated and co-located modules** for your two Google integration approaches:

## 📖 GCP Service Account API
- **Purpose**: Reading event data from Google Sheets
- **File**: `lib/data-management/google-sheets.ts`
- **Authentication**: Service account with private key
- **API**: `sheets.googleapis.com/v4`
- **Scope**: `spreadsheets.readonly`

## ✍️ Google Apps Script
- **Purpose**: Writing user data & admin functions
- **File**: `scripts/enhanced-google-apps-script.js`
- **Authentication**: Public webhook endpoint
- **API**: `script.google.com/macros/s/.../exec`

## 🚀 Quick Start

### Reading Event Data (GCP API)
```typescript
import { GoogleCloudAPI } from "@/lib/google/gcp-api";

// Fetch event data using service account
const csvData = await GoogleCloudAPI.fetchEventData(sheetId, "A:Z");
```

### Writing User Data (Apps Script)
```typescript
import { GoogleAppsScript } from "@/lib/google/apps-script";

// Submit user authentication data
const result = await GoogleAppsScript.submitUserData({
  firstName: "John",
  lastName: "Doe", 
  email: "john@example.com",
  consent: true,
  source: "fete-finder-auth",
  timestamp: new Date().toISOString()
});
```

### Admin Functions (Apps Script)
```typescript
import { GoogleAppsScript } from "@/lib/google/apps-script";

// Get statistics
const stats = await GoogleAppsScript.getAdminStats("admin-key");

// Get recent entries
const recent = await GoogleAppsScript.getRecentEntries("admin-key", 5);

// Cleanup duplicates
const cleanup = await GoogleAppsScript.cleanupDuplicates("admin-key");
```

## 🔧 Configuration Check
```typescript
import { validateGoogleIntegrations } from "@/lib/google/integration-status";

const status = validateGoogleIntegrations();
console.log(status);
// {
//   gcp: { configured: true, purpose: "Reading event data", status: "✅ Ready" },
//   appsScript: { configured: true, purpose: "Writing user data & admin functions", status: "✅ Ready" },
//   overall: "✅ Fully configured"
// }
```

## 🎯 When to Use Which Approach

| Use Case | Approach | Reason |
|----------|----------|---------|
| Reading event data | GCP API | Better performance, caching control |
| Writing user data | Apps Script | Simple deployment, no auth complexity |
| Admin statistics | Apps Script | Sheet-specific logic, easy maintenance |
| Batch operations | GCP API | Better for large datasets |
| Webhooks | Apps Script | Easier deployment and management |

## 📁 File Structure

```
lib/google/
├── gcp-api.ts                   # 📖 GCP Service Account API utilities
├── apps-script.ts               # ✍️ Google Apps Script utilities  
├── apps-script-actions.ts       # ✍️ Google Apps Script server actions (co-located)
├── integration-status.ts        # 🔧 Status validation and guides
└── README.md                    # 📚 This documentation

lib/data-management/
└── google-sheets.ts             # 📖 GCP Service Account implementation

scripts/
└── enhanced-google-apps-script.js  # ✍️ Apps Script webhook implementation

app/
└── actions.ts                   # 🏠 Non-Google server actions only
```

## 🔄 Migration Completed

**✅ Moved from global actions.ts:**
- `authenticateUser()` → `submitUserDataToScript()` in `apps-script-actions.ts`
- `getGoogleSheetsStats()` → `getScriptStats()` in `apps-script-actions.ts`
- `getRecentSheetEntries()` → `getRecentScriptEntries()` in `apps-script-actions.ts`
- `cleanupSheetDuplicates()` → `cleanupScriptDuplicates()` in `apps-script-actions.ts`

**✅ Updated components:**
- `EmailGateModal.tsx` → Uses `GoogleAppsScript.submitUserData()`
- `GoogleSheetsStatsCard.tsx` → Uses `GoogleAppsScript.getAdminStats()`
- `RecentEntriesCard.tsx` → Uses `GoogleAppsScript.getRecentEntries()`
- `SheetActionsCard.tsx` → Uses `GoogleAppsScript.cleanupDuplicates()`

## 🔍 Integration Status Component

Use the `GoogleIntegrationStatus` component in your admin panel to visually see the current configuration:

```typescript
import { GoogleIntegrationStatus } from "@/app/admin/components/GoogleIntegrationStatus";

// Shows visual status of both integrations
<GoogleIntegrationStatus />
```

## ⚙️ Environment Variables

### GCP Service Account API
```bash
# Method 1: JSON string (recommended for production)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Method 2: File path (local development only)  
GOOGLE_SERVICE_ACCOUNT_FILE=service-account.json

# Sheet configuration
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_SHEET_RANGE=A:Z
```

### Google Apps Script
```bash
# Webhook URL from your deployed Apps Script
GOOGLE_SHEETS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

## 🎯 Benefits of This Co-located Structure

1. **🔍 Clear Separation**: Easy to see which approach is used where
2. **📦 No Barrel Files**: Direct imports from properly named modules
3. **🏠 Co-located Actions**: Server actions live with their related modules
4. **🛡️ Type Safe**: TypeScript interfaces for all functions
5. **📚 Self-Documenting**: Built-in integration guide and status checks
6. **🔧 Easy Configuration**: Simple environment variable validation
7. **🚀 Better DX**: Clear, descriptive module names and co-located functionality
8. **🧹 Clean Global Actions**: Only non-Google actions remain in app/actions.ts 