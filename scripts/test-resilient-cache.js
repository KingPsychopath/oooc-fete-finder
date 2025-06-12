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
  { id: "1", title: "Test Event 1", date: "2025-01-20" },
  { id: "2", title: "Test Event 2", date: "2025-01-21" },
];

const mockInvalidEvents = [
  { id: "", title: "", date: "" }, // Invalid event
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
    typeof event.title === 'string' && 
    event.title.trim() !== ''
  );

  const validPercentage = validEvents.length / events.length;
  return validPercentage >= 0.5;
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
  
  cacheState.lastFetchTime = now;
  cacheState.lastRemoteFetchTime = now;
  cacheState.lastRemoteErrorMessage = errorMessage;

  console.log(`🔄 Cache validity refreshed: keeping ${cacheState.events.length} cached events fresh`);
  console.log(`📡 Remote fetch failed, but cached data remains valid: ${errorMessage}`);
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
          title: "Service Temporarily Unavailable",
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
        title: "Service Temporarily Unavailable",
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
  
  // Scenario 5: Bootstrap mode - no cache, all sources fail
  cacheState.events = null; // Clear cache to simulate fresh start
  await simulateScenario("Bootstrap mode: No cache + all sources fail", null, true);
  
  // Scenario 6: Another successful fetch updates the cache
  await simulateScenario("Successful fetch updates cache", [
    ...mockValidEvents,
    { id: "3", title: "New Event", date: "2025-01-22" }
  ]);
  
  console.log("\n🎉 Demonstration Complete!");
  console.log("\nKey Benefits of Resilient Caching:");
  console.log("• Continues serving users even when remote data source fails");
  console.log("• Prevents cache expiration during outages");
  console.log("• Maintains service availability during API issues");
  console.log("• Bootstrap mode prevents infinite empty cache loops");
  console.log("• Automatically recovers when remote source becomes available");
}

// Run the demonstration
runDemo().catch(console.error); 