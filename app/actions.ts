"use server";

/**
 * General Application Actions
 * 
 * This file now serves as a central re-export point for backwards compatibility.
 * All specific actions have been moved to their colocated modules:
 * 
 * - Data management actions → @/lib/data-management/actions
 * - Cache management actions → @/lib/cache-management/actions  
 * - Admin management actions → @/lib/admin/actions
 * - Google Apps Script actions → @/lib/google/apps-script-actions
 */

// Note: This file is kept minimal as a transition point.
// New code should import directly from the colocated action modules.
