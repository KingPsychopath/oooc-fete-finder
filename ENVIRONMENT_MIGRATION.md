# Environment Variables Migration Guide

## Overview

This app now uses a **centralized environment configuration** system located in `lib/config/env.ts`. This provides:

- ✅ **Single source of truth** for all environment variables
- ✅ **Type safety** with TypeScript
- ✅ **Validation** and error checking
- ✅ **Consistent defaults** across the entire app
- ✅ **Better maintainability** and debugging

## Migration Steps

### 1. Replace Direct `process.env` Access

**❌ Before:**
```typescript
const apiKey = process.env.GOOGLE_SHEETS_API_KEY || "";
const cacheTimeout = parseInt(process.env.CACHE_DURATION_MS || "3600000", 10);
```

**✅ After:**
```typescript
import { EnvironmentManager } from "@/lib/config/env";

const apiKey = EnvironmentManager.get("GOOGLE_SHEETS_API_KEY");
const cacheTimeout = EnvironmentManager.get("CACHE_DURATION_MS");
```

### 2. Use Convenience Functions

**For frequent usage:**
```typescript
import { env, isDev, isProd } from "@/lib/config/env";

const siteUrl = env("NEXT_PUBLIC_SITE_URL");
if (isDev()) {
  console.log("Development mode");
}
```

### 3. Use Grouped Configuration Methods

**For related settings:**
```typescript
import { EnvironmentManager } from "@/lib/config/env";

// Get all cache settings at once
const cacheConfig = EnvironmentManager.getCacheConfig();

// Get all Google Sheets status
const googleStatus = EnvironmentManager.getGoogleSheetsStatus();

// Get all admin settings
const adminConfig = EnvironmentManager.getAdminConfig();
```

## Files to Update

### High Priority (Core functionality)

1. **Cache Management:**
   - ✅ `lib/cache-management/cache-config.ts` - DONE
   - ⏳ `lib/cache-management/cache-state.ts`
   - ⏳ `lib/cache-management/cache-memory.ts`

2. **Data Management:**
   - ✅ `lib/data-management/config.ts` - DONE
   - ⏳ `lib/data-management/data-management.ts`
   - ⏳ `lib/data-management/google-sheets.ts`
   - ⏳ `lib/data-management/csv-fetcher.ts`

3. **Admin System:**
   - ✅ `lib/admin/admin-validation.ts` - DONE
   - ⏳ `lib/admin/admin-session.ts`

### Medium Priority (API endpoints)

4. **Google Integrations:**
   - ⏳ `lib/google/gcp-api.ts`
   - ⏳ `lib/google/apps-script.ts`
   - ⏳ `lib/google/apps-script-actions.ts`

5. **API Routes:**
   - ⏳ `app/api/og/route.tsx`

### Low Priority (Components)

6. **Components:**
   - ⏳ `next.config.ts`
   - ⏳ `app/layout.tsx`
   - ⏳ `app/admin/layout.tsx`
   - ⏳ `app/admin/page.tsx`
   - ⏳ `components/Header.tsx`
   - ⏳ `components/ErrorBoundary.tsx`
   - ⏳ `context/auth-context.tsx`

## Example Migrations

### Cache Memory Configuration

**❌ Before:**
```typescript
const MEMORY_CONFIG = {
  MAX_MEMORY_USAGE: parseInt(process.env.CACHE_MAX_MEMORY_BYTES || "52428800"),
  MEMORY_CHECK_INTERVAL: parseInt(process.env.CACHE_MEMORY_CHECK_INTERVAL_MS || "300000"),
  CLEANUP_THRESHOLD: parseFloat(process.env.CACHE_CLEANUP_THRESHOLD || "0.8"),
  EMERGENCY_THRESHOLD: parseFloat(process.env.CACHE_EMERGENCY_THRESHOLD || "0.95"),
};
```

**✅ After:**
```typescript
import { EnvironmentManager } from "@/lib/config/env";

const MEMORY_CONFIG = {
  MAX_MEMORY_USAGE: EnvironmentManager.get("CACHE_MAX_MEMORY_BYTES"),
  MEMORY_CHECK_INTERVAL: EnvironmentManager.get("CACHE_MEMORY_CHECK_INTERVAL_MS"),
  CLEANUP_THRESHOLD: EnvironmentManager.get("CACHE_CLEANUP_THRESHOLD"),
  EMERGENCY_THRESHOLD: EnvironmentManager.get("CACHE_EMERGENCY_THRESHOLD"),
};
```

### Google Sheets Configuration

**❌ Before:**
```typescript
const hasServiceAccount = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE
);
```

**✅ After:**
```typescript
import { EnvironmentManager } from "@/lib/config/env";

const googleStatus = EnvironmentManager.getGoogleSheetsStatus();
const hasServiceAccount = googleStatus.hasServiceAccount;
```

### Next.js Config

**❌ Before:**
```typescript
const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: true,
};
```

**✅ After:**
```typescript
import { EnvironmentManager } from "./lib/config/env";

const siteConfig = EnvironmentManager.getSiteConfig();

const nextConfig: NextConfig = {
  basePath: siteConfig.basePath,
  assetPrefix: siteConfig.basePath,
  trailingSlash: true,
};
```

## Benefits After Migration

### 🔍 **Better Debugging**
```typescript
// Development-only configuration logging
EnvironmentManager.logConfigStatus();
```

### ✅ **Automatic Validation**
```typescript
const validation = EnvironmentManager.validateConfig();
if (!validation.isValid) {
  console.error("Configuration errors:", validation.errors);
}
```

### 🎯 **Type Safety**
```typescript
// TypeScript will catch typos and invalid keys
const timeout = EnvironmentManager.get("CACHE_DURATION_MS"); // ✅ Valid
const invalid = EnvironmentManager.get("INVALID_KEY"); // ❌ TypeScript error
```

### 🔧 **Consistent Defaults**
No more scattered default values across files - all defaults are centralized and consistent.

## Testing the Migration

1. **Run the app in development:**
   ```bash
   npm run dev
   ```

2. **Check console for configuration status:**
   ```
   🔧 Environment Configuration Status:
      NODE_ENV: development
      Site URL: http://localhost:3000
   📊 Google Sheets Integration:
      Remote URL: ✅
      API Key: ❌
      Service Account: ✅
      Apps Script: ✅
   ✅ Configuration validation passed
   ```

3. **Test environment variable changes:**
   - Modify values in `.env.local`
   - Restart the server
   - Verify changes are reflected

## Next Steps

1. **Migrate high-priority files first** (cache and data management)
2. **Test thoroughly** after each migration
3. **Remove old configuration objects** once migrated
4. **Add environment validation** to critical paths
5. **Consider adding runtime environment switching** for advanced use cases

This centralized approach will make your app much more maintainable and reduce configuration-related bugs! 