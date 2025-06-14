/**
 * Environment Configuration - Main Export
 * Clean, focused exports for environment variables
 */

// Re-export schemas for direct access
export { SERVER_ENV_SCHEMA as serverEnv, CLIENT_ENV_SCHEMA as clientEnv } from "./env-schema";
export type { ServerEnvironmentConfig, ClientEnvironmentConfig } from "./env-schema";

// Re-export validation functions
export { validateCacheConfig, validateGoogleSheetsConfig, validateEnvironmentConfig, getEnvInfo } from "./env-validation";

// Re-export managers for complex use cases
export { ServerEnvironmentManager, ClientEnvironmentManager } from "./env-managers";

// ========================================
// CONVENIENCE EXPORTS
// ========================================

/**
 * Check if running in development mode
 * 
 * Best Practice: Uses process.env.NODE_ENV directly for consistency
 * Works reliably on both client and server without additional complexity
 */
export const isDev = process.env.NODE_ENV === "development";

/**
 * Check if running in production mode
 * 
 * Best Practice: Uses process.env.NODE_ENV directly for consistency
 * Works reliably on both client and server without additional complexity
 */
export const isProd = process.env.NODE_ENV === "production";

/**
 * Check if running in test mode
 * 
 * Useful for conditional logic in tests
 */
export const isTest = process.env.NODE_ENV === "test";

/**
 * Get current environment name
 * 
 * Returns the actual NODE_ENV value for debugging/logging
 */
export const currentEnv = process.env.NODE_ENV || "development"; 