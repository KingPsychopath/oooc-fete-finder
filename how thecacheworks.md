Great question! The cache logic has **two different timers** that work independently. Let me break this down step by step:

## 🕐 **Two Independent Timers**
Read file: lib/cache-manager.ts
Perfect! Now I can clearly explain the two-timer system. Let me create a diagram and walk through the logic:
Ran tool
## 🕐 **Two Independent Timers Explained**

The confusion comes from **two separate timers** that work independently:

### **Timer 1: Cache Freshness** ⏰
- **Duration**: 1 hour
- **Purpose**: Decides if cached data is "fresh enough" to serve
- **Question**: "Should I serve cached data or fetch new data?"

### **Timer 2: Remote Check Frequency** 📡
- **Duration**: 5 minutes  
- **Purpose**: Decides if we should check Google Sheets for updates
- **Question**: "Should I try Google Sheets or use local CSV?"

## 🔄 **Complete Flow Breakdown**

### **Scenario 1: Cache is Fresh (< 1 hour old)**
```typescript
// User visits page at 2:30 PM
// Last cache update: 2:00 PM (30 minutes ago)
// Result: Serve cached data immediately, no fetching at all

if (now - cacheState.lastFetchTime < CACHE_DURATION) {
    console.log("🔄 Using cached events data (30 minutes old)");
    return cachedData; // ← Exit here, no further logic runs
}
```
**No remote checks, no local CSV, just instant cached data.**

---

### **Scenario 2: Cache is Stale (> 1 hour old)**
```typescript
// User visits page at 3:30 PM  
// Last cache update: 2:00 PM (1.5 hours ago)
// Cache is stale, need to fetch fresh data
```

**Now we check the second timer:**

#### **Sub-scenario 2A: Remote check is due (> 5 minutes since last remote attempt)**
```typescript
// Last remote check: 3:20 PM (10 minutes ago) 
// OR never checked before
// OR force refresh

const shouldTryRemote = 
    forceRefresh ||
    now - cacheState.lastRemoteFetchTime > REMOTE_REFRESH_INTERVAL ||
    !cacheState.events;

if (shouldTryRemote) {
    console.log("🌐 Attempting multi-strategy data fetching...");
    // Try Google Sheets → Service Account → Local CSV fallback
}
```

#### **Sub-scenario 2B: Remote check NOT due (< 5 minutes since last remote attempt)**
```typescript
// Last remote check: 3:28 PM (2 minutes ago)
// Don't spam Google Sheets API

else {
    console.log("📁 Using local CSV (remote not due for refresh)");
    csvContent = await fetchLocalCSV(); // ← This is the "use local CSV" part!
}
```

## 🎯 **The "Use Local CSV" Explanation**

**This happens when:**
- ✅ Cache is stale (> 1 hour) - need fresh data
- ❌ Remote check is NOT due (< 5 minutes since last attempt)

**The logic is:**
> "I need fresh data, but I just checked Google Sheets 2 minutes ago and don't want to spam their API. Let me use the local CSV file instead of hitting Google Sheets again."

**Why this makes sense:**
- **API Rate Limiting**: Prevents hitting Google Sheets too frequently
- **Performance**: Local file read is much faster than network call
- **Reliability**: If Google Sheets is temporarily down, still serves data

## 🔀 **Choices After Remote Check**

When a remote check IS due, here are the choices:

### **Choice 1: fetchCSVWithFallbacks() Success Path**
```typescript
try {
    csvContent = await fetchCSVWithFallbacks();
    // This tries 3 strategies in order:
    // 1. Public CSV URL
    // 2. Service Account Authentication  
    // 3. Local CSV fallback
    
    if (csvContent.includes("local CSV fallback")) {
        cacheState.lastDataSource = "local";
    } else {
        cacheState.lastDataSource = "remote";
    }
} 
```

### **Choice 2: All Remote Strategies Failed**
```typescript
catch (remoteError) {
    // All 3 strategies failed
    // Throw error and fall back to expired cached data if available
    throw new Error("All data sources failed");
}
```

## 📊 **Real-World Timeline Example**

### **2:00 PM**: User visits site
- Cache: Empty
- Action: Fetch from Google Sheets → Cache for 1 hour
- Remote check timer: Reset to 2:00 PM

### **2:30 PM**: User visits site  
- Cache: 30 minutes old (fresh)
- Action: Serve cached data ⚡
- No fetching at all

### **3:30 PM**: User visits site
- Cache: 1.5 hours old (stale)
- Last remote check: 2:00 PM (1.5 hours ago)
- Remote check due: ✅ (> 5 minutes)
- Action: Try Google Sheets → Success → Update cache

### **3:32 PM**: Another user visits  
- Cache: 2 minutes old (fresh)
- Action: Serve cached data ⚡

### **4:35 PM**: User visits site
- Cache: 1 hour 5 minutes old (stale)  
- Last remote check: 3:30 PM (1 hour 5 minutes ago)
- Remote check due: ✅ (> 5 minutes)
- Action: Try Google Sheets → Update cache

### **4:36 PM**: User visits site
- Cache: 1 hour 6 minutes old (stale)
- Last remote check: 4:35 PM (1 minute ago)  
- Remote check due: ❌ (< 5 minutes)
- Action: **Use local CSV** ← This is when it happens!

## 🎯 **Key Insights**

1. **Most requests serve cached data** (when cache < 1 hour old)
2. **Remote checks happen only when needed** (cache stale + 5min gap)
3. **Local CSV is a "gentle refresh"** option (cache stale but don't spam API)
4. **Force refresh bypasses both timers** (immediate Google Sheets check)

The "use local CSV" part is basically saying: *"I need fresh data, but I don't want to be rude to Google's API by checking too frequently, so I'll use my local backup file instead."*

This design gives you **both performance and politeness** - fast responses most of the time, but respectful API usage when fetching updates! 🎯

graph TD
    A["👤 User Visits Page"] --> B{"Cache Fresh?<br/>< 1 hour old"}
    B -->|Yes| C["⚡ Serve Cached Data<br/>Lightning Fast"]
    B -->|No| D{"Remote Check Due?<br/>> 5 min since last"}
    
    D -->|No| E["📁 Use Local CSV<br/>Still Fast"]
    D -->|Yes| F["🌐 Multi-Strategy Fetch"]
    
    F --> G["📡 Strategy 1: Public CSV URL"]
    F --> H["🔐 Strategy 2: Service Account"]
    F --> I["📁 Strategy 3: Local Fallback"]
    
    G --> J{"Success?"}
    H --> J
    I --> J
    
    J -->|Yes| K["🔍 Enhanced Change Detection"]
    J -->|No| L["❌ All Sources Failed"]
    
    K --> M["🧮 Type-Safe Field Comparison"]
    M --> N{"Data Changed?"}
    
    N -->|No| O["✅ Skip Invalidation<br/>Performance Win"]
    N -->|Yes| P["🧹 Smart Cache Invalidation"]
    
    P --> Q["🗑️ Clear In-Memory Cache"]
    Q --> R["🔄 Clear Page Cache"]
    R --> S["🎯 Clear Layout Cache"]
    S --> T["✅ User Sees Fresh Data"]
    
    style A fill:#e3f2fd
    style C fill:#e8f5e8
    style K fill:#fff3e0
    style P fill:#fce4ec
    style T fill:#e8f5e8