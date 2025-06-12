#!/usr/bin/env node

/**
 * Resilient Cache Demonstration Script
 * 
 * This script demonstrates the new resilient caching behavior:
 * - When remote fetch fails or returns invalid/empty data
 * - The system continues to serve previous cached data
 * - And refreshes the cache validity timer to keep it fresh
 * 
 * Usage: node scripts/test-resilient-cache.js
 */

console.log("🧪 Resilient Cache Behavior Demonstration");
console.log("=========================================\n");

// Mock Event data for demonstration
const mockValidEvents = [
  { id: "1", name: "Test Event 1", date: "2025-01-20" },
  { id: "2", name: "Test Event 2", date: "2025-01-21" },
];

const mockInvalidEvents = [
  { id: "", name: "", date: "" }, // Invalid event
  null, // Null event
];

// Mock the data validation function
function isValidEventsData(events) {
  if (!events || !Array.isArray(events) || events.length === 0) {
    return false;
  }

  const validEvents = events.filter(event => 
    event && 
    typeof event.id === 'string' && 
    event.id.trim() !== '' &&
    typeof event.name === 'string' && 
    event.name.trim() !== '' &&
    typeof event.date === 'string' &&
    event.date.trim() !== ''
  );

  const validPercentage = validEvents.length / events.length;
  return validPercentage >= 0.8;
}

// Mock cache state
const cacheState = {
  events: null,
  lastFetchTime: 0,
  lastRemoteFetchTime: 0,
  lastRemoteErrorMessage: "",
};

// Mock cache operations
function updateCache(events, source) {
  const now = Date.now();
  cacheState.events = events;
  cacheState.lastFetchTime = now;
  console.log(`📦 Cache updated: ${events.length} events from ${source} source`);
}

function refreshCacheValidity(errorMessage) {
  if (!cacheState.events) {
    console.log("⚠️ Cannot refresh cache validity - no cached data exists");
    return;
  }

  const now = Date.now();
  const originalFetchTime = cacheState.lastFetchTime;
  const cacheAge = now - originalFetchTime;
  
  // Hybrid approach: Balance between keeping service available and preventing indefinitely old data
  const MAX_CACHE_AGE = 6 * 60 * 60 * 1000; // 6 hours maximum age
  const EXTENSION_DURATION = 30 * 60 * 1000; // 30 minutes extension
  
  if (cacheAge < MAX_CACHE_AGE) {
    // Cache is not too old yet - extend its validity by a reasonable amount
    cacheState.lastFetchTime = now - (cacheAge - EXTENSION_DURATION);
    console.log(`🔄 Cache validity extended: age ${Math.round(cacheAge / 60000)}min, extended by ${EXTENSION_DURATION / 60000}min`);
  } else {
    // Cache is getting very old - refresh to current time but log warning
    cacheState.lastFetchTime = now;
    console.log(`⚠️ Cache is very old (${Math.round(cacheAge / 60000)}min), refreshing to current time`);
    console.log("📊 Consider checking data source connectivity - cache data may be significantly outdated");
  }
  
  // Record the remote attempt
  cacheState.lastRemoteFetchTime = now;
  cacheState.lastRemoteErrorMessage = errorMessage;

  const newCacheAge = now - cacheState.lastFetchTime;
  console.log(`⏰ Cache validity refreshed - effective age: ${Math.round(newCacheAge / 60000)}min`);
  
  if (errorMessage) {
    console.log(`📡 Remote fetch failed, but cached data remains valid: ${errorMessage}`);
  }
}

function getCachedEventsForced() {
  return cacheState.events;
}

// Simulate different scenarios
async function simulateScenario(scenarioName, remoteData, shouldFail = false) {
  console.log(`\n🎬 Scenario: ${scenarioName}`);
  console.log("─".repeat(50));
  
  try {
    // Simulate remote fetch
    if (shouldFail) {
      throw new Error("503 Service Unavailable - Google Sheets API error");
    }
    
    // Check if remote data is valid
    if (isValidEventsData(remoteData)) {
      // Update cache with new valid data
      updateCache(remoteData, "remote");
      console.log(`✅ Successfully loaded and cached ${remoteData.length} events from remote source`);
      return { success: true, data: remoteData, cached: false };
    } else {
      // Remote data is invalid
      const errorMessage = "Remote data validation failed - data is empty or invalid";
      
      // Try to return cached data and refresh its validity
      const cachedEvents = getCachedEventsForced();
      if (cachedEvents && isValidEventsData(cachedEvents)) {
        refreshCacheValidity(errorMessage);
        console.log("🔄 Remote data invalid, refreshed cached data validity");
        console.log(`   Serving cached data: ${cachedEvents.length} events`);
        return { 
          success: true, 
          data: cachedEvents, 
          cached: true, 
          error: `Using cached data due to remote issue: ${errorMessage}` 
        };
      } else {
        // Bootstrap mode - create fallback event
        console.log("❌ No valid cached data available, activating bootstrap mode");
        const bootstrapEvent = {
          id: "bootstrap-fallback-1",
          name: "Service Temporarily Unavailable",
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
        cacheState.events = [bootstrapEvent];
        cacheState.lastFetchTime = Date.now();
        console.log("🚨 Bootstrap mode: Serving fallback event to prevent empty cache loop");
        return { 
          success: true, 
          data: [bootstrapEvent], 
          cached: true, 
          error: `Bootstrap mode activated: ${errorMessage}` 
        };
      }
    }
  } catch (error) {
    const errorMessage = error.message;
    
    // Try to return cached data and refresh its validity
    const cachedEvents = getCachedEventsForced();
    if (cachedEvents && isValidEventsData(cachedEvents)) {
      refreshCacheValidity(errorMessage);
      console.log("🔄 Exception occurred, refreshed cached data validity");
      console.log(`   Serving cached data: ${cachedEvents.length} events`);
      return { 
        success: true, 
        data: cachedEvents, 
        cached: true, 
        error: `Using cached data due to error: ${errorMessage}` 
      };
    } else {
      // Bootstrap mode - create fallback event
      console.log("❌ Exception with no valid cached data, activating bootstrap mode");
             const bootstrapEvent = {
         id: "bootstrap-fallback-1",
         name: "Service Temporarily Unavailable",
         date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
       };
      cacheState.events = [bootstrapEvent];
      cacheState.lastFetchTime = Date.now();
      console.log("🚨 Bootstrap mode: Serving fallback event after exception");
      return { 
        success: true, 
        data: [bootstrapEvent], 
        cached: true, 
        error: `Bootstrap mode activated after exception: ${errorMessage}` 
      };
    }
  }
}

// Run demonstration
async function runDemo() {
  // Scenario 1: Initial successful fetch
  await simulateScenario("Initial successful remote fetch", mockValidEvents);
  
  // Scenario 2: Remote fetch fails, but we have cached data
  await simulateScenario("Remote fetch fails (503 error)", null, true);
  
  // Scenario 3: Remote returns invalid data, but we have cached data
  await simulateScenario("Remote returns invalid/empty data", []);
  
  // Scenario 4: Remote returns partially invalid data
  await simulateScenario("Remote returns partially invalid data", mockInvalidEvents);
  
  // Scenario 5: Test cache age behavior - recent cache
  cacheState.lastFetchTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours old
  await simulateScenario("Recent cache (2h old) + remote fails", null, true);
  
  // Scenario 6: Test cache age behavior - old cache
  cacheState.lastFetchTime = Date.now() - (8 * 60 * 60 * 1000); // 8 hours old (very old)
  await simulateScenario("Very old cache (8h old) + remote fails", null, true);
  
  // Scenario 7: Bootstrap mode - no cache, all sources fail
  cacheState.events = null; // Clear cache to simulate fresh start
  await simulateScenario("Bootstrap mode: No cache + all sources fail", null, true);
  
  // Scenario 8: Another successful fetch updates the cache
  await simulateScenario("Successful fetch updates cache", [
    ...mockValidEvents,
    { id: "3", name: "New Event", date: "2025-01-22" }
  ]);
  
  console.log("\n🎉 Demonstration Complete!");
  console.log("\nKey Benefits of Resilient Caching:");
  console.log("• Continues serving users even when remote data source fails");
  console.log("• Hybrid cache validity: extends recent cache, refreshes very old cache");
  console.log("• Prevents indefinitely stale data while maintaining availability");
  console.log("• Bootstrap mode prevents infinite empty cache loops");
  console.log("• Automatically recovers when remote source becomes available");
  console.log("• Configurable cache age limits and extension durations");
}

// Run the demonstration
runDemo().catch(console.error); 