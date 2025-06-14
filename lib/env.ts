/**
 * Environment Configuration with Zod
 * Replaces the entire lib/config/* environment system
 * 
 * Features:
 * - Server-only vs client-safe variable separation
 * - Comprehensive validation with helpful error messages
 * - Type safety with TypeScript
 * - Lazy loading to prevent client-side access
 * - Development vs production defaults
 * - Helper methods for configuration status
 */

import { z } from 'zod';

// ========================================
// CUSTOM VALIDATORS
// ========================================

/**
 * URL validator with helpful error messages
 */
const urlSchema = (field: string) => 
  z.string()
    .refine((val) => !val || val.startsWith('http'), {
      message: `${field} must be a valid URL starting with http:// or https://`,
    });

/**
 * Positive integer validator
 */
const positiveInt = (field: string, min = 1) =>
  z.coerce.number().int().min(min, {
    message: `${field} must be a positive integer (minimum ${min})`,
  });

/**
 * Float between 0 and 1 validator
 */
const percentage = (field: string) =>
  z.coerce.number().min(0).max(1, {
    message: `${field} must be between 0 and 1 (e.g., 0.8 for 80%)`,
  });

/**
 * Environment-specific string validator
 */
const environmentString = (field: string, minLength = 1) =>
  z.string().min(minLength, {
    message: `${field} must be at least ${minLength} characters long`,
  });

// ========================================
// SERVER-ONLY ENVIRONMENT SCHEMA
// ========================================

/**
 * Server-side environment variables schema
 * These variables are NEVER sent to the client
 */
const serverEnvSchema = z.object({
  // Core settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Admin & Security (NEVER expose to client)
  ADMIN_KEY: process.env.NODE_ENV === 'production' 
    ? environmentString('ADMIN_KEY', 10).describe('Admin key for secure access (production requires 10+ chars)')
    : environmentString('ADMIN_KEY', 1).default('dev-key-123').describe('Admin key for secure access'),
  
  // Google Sheets Integration (server-only for security)
  REMOTE_CSV_URL: urlSchema('REMOTE_CSV_URL').default('').describe('Public CSV URL for remote data'),
  GOOGLE_SHEETS_API_KEY: z.string().default('').describe('Google Sheets API key for data access'),
  GOOGLE_SHEET_ID: z.string().default('').describe('Google Sheet ID for data source'),
  GOOGLE_SHEET_RANGE: z.string().default('A1:O1000').describe('Google Sheet range to fetch'),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().default('').describe('Google service account JSON key'),
  GOOGLE_SERVICE_ACCOUNT_FILE: z.string().default('').describe('Google service account file path'),
  GOOGLE_SHEETS_URL: urlSchema('GOOGLE_SHEETS_URL').default('').describe('Google Apps Script webhook URL'),
  
  // Cache Configuration (server-side only)
  CACHE_DURATION_MS: positiveInt('CACHE_DURATION_MS').default(3600000).describe('Cache duration (1 hour = 3600000ms)'),
  REMOTE_REFRESH_INTERVAL_MS: positiveInt('REMOTE_REFRESH_INTERVAL_MS').default(300000).describe('Remote refresh interval (5 min = 300000ms)'),
  MAX_CACHE_AGE_MS: positiveInt('MAX_CACHE_AGE_MS').default(21600000).describe('Max cache age (6 hours = 21600000ms)'),
  CACHE_EXTENSION_DURATION_MS: positiveInt('CACHE_EXTENSION_DURATION_MS').default(1800000).describe('Cache extension duration (30 min = 1800000ms)'),
  CACHE_MAX_MEMORY_BYTES: positiveInt('CACHE_MAX_MEMORY_BYTES').default(52428800).describe('Max memory usage (50MB = 52428800 bytes)'),
  CACHE_MEMORY_CHECK_INTERVAL_MS: positiveInt('CACHE_MEMORY_CHECK_INTERVAL_MS').default(300000).describe('Memory check interval (5 min = 300000ms)'),
  CACHE_CLEANUP_THRESHOLD: percentage('CACHE_CLEANUP_THRESHOLD').default(0.8).describe('Cache cleanup threshold (80% = 0.8)'),
  CACHE_EMERGENCY_THRESHOLD: percentage('CACHE_EMERGENCY_THRESHOLD').default(0.95).describe('Emergency cleanup threshold (95% = 0.95)'),
  CACHE_MAX_METRICS_HISTORY: positiveInt('CACHE_MAX_METRICS_HISTORY').default(100).describe('Max metrics history entries'),
  CACHE_METRICS_RESET_INTERVAL_MS: positiveInt('CACHE_METRICS_RESET_INTERVAL_MS').default(86400000).describe('Metrics reset interval (24 hours = 86400000ms)'),
  CACHE_DEDUPLICATION_TIMEOUT_MS: positiveInt('CACHE_DEDUPLICATION_TIMEOUT_MS').default(30000).describe('Deduplication timeout (30 sec = 30000ms)'),
  CACHE_MAX_RETRY_ATTEMPTS: positiveInt('CACHE_MAX_RETRY_ATTEMPTS').default(3).describe('Max retry attempts for failed operations'),
  CACHE_RETRY_BACKOFF_MS: positiveInt('CACHE_RETRY_BACKOFF_MS').default(1000).describe('Retry backoff delay (1 sec = 1000ms)'),
  CACHE_BOOTSTRAP_MODE: z.coerce.boolean().default(false).describe('Enable cache bootstrap mode'),
  CACHE_VERBOSE_LOGGING: z.coerce.boolean().default(false).describe('Enable verbose cache logging'),
  CACHE_LOG_MEMORY_USAGE: z.coerce.boolean().default(true).describe('Enable memory usage logging'),
  CACHE_LOG_PERFORMANCE_METRICS: z.coerce.boolean().default(false).describe('Enable performance metrics logging'),
  
  // Data source
  LOCAL_CSV_LAST_UPDATED: z.string().default('2025-01-18').describe('Last update date of local CSV data'),
  
  // OG Images
  DEFAULT_OG_IMAGE: z.string().default('').describe('Default OG image path'),
});

// ========================================
// CLIENT-SAFE ENVIRONMENT SCHEMA
// ========================================

/**
 * Client-side environment variables schema
 * These variables are sent to the browser and should NOT contain secrets
 */
const clientEnvSchema = z.object({
  // Site configuration (safe for client)
  NEXT_PUBLIC_BASE_PATH: z.string().default('').describe('Base path for subdirectory deployment'),
  NEXT_PUBLIC_SITE_URL: urlSchema('NEXT_PUBLIC_SITE_URL').default('http://localhost:3000').describe('Full site URL for OG images and links'),
  
  // Admin UI settings (non-sensitive)
  NEXT_PUBLIC_ADMIN_SESSION_HOURS: z.coerce.number().int().min(1).max(168).default(24).describe('Admin session duration (1-168 hours)'),
  
  // Auth settings (client-side duration only)
  NEXT_PUBLIC_AUTH_EXPIRY_DAYS: z.coerce.number().int().min(1).max(365).default(30).describe('Auth expiry duration (1-365 days)'),
});

// ========================================
// ENVIRONMENT PARSING & VALIDATION
// ========================================

/**
 * Parse and validate all environment variables
 * This function is called lazily when environment is first accessed
 */
function createEnvironment() {
  // Prevent client-side access to server environment
  if (typeof window !== 'undefined') {
    throw new Error('❌ Server environment variables cannot be accessed on the client-side. Use env.client for client-safe variables.');
  }

  try {
    // Parse server environment (never sent to client)
    const server = serverEnvSchema.parse({
      NODE_ENV: process.env.NODE_ENV,
      ADMIN_KEY: process.env.ADMIN_KEY,
      
      // Google configuration
      GOOGLE_SHEETS_API_KEY: process.env.GOOGLE_SHEETS_API_KEY,
      GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
      GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      GOOGLE_SERVICE_ACCOUNT_FILE: process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
      GOOGLE_SHEETS_URL: process.env.GOOGLE_SHEETS_URL,
      REMOTE_CSV_URL: process.env.REMOTE_CSV_URL,
      
      // Cache configuration
      CACHE_DURATION_MS: process.env.CACHE_DURATION_MS,
      REMOTE_REFRESH_INTERVAL_MS: process.env.REMOTE_REFRESH_INTERVAL_MS,
      MAX_CACHE_AGE_MS: process.env.MAX_CACHE_AGE_MS,
      CACHE_EXTENSION_DURATION_MS: process.env.CACHE_EXTENSION_DURATION_MS,
      
      // Memory management
      CACHE_MAX_MEMORY_BYTES: process.env.CACHE_MAX_MEMORY_BYTES,
      CACHE_MEMORY_CHECK_INTERVAL_MS: process.env.CACHE_MEMORY_CHECK_INTERVAL_MS,
      CACHE_CLEANUP_THRESHOLD: process.env.CACHE_CLEANUP_THRESHOLD,
      CACHE_EMERGENCY_THRESHOLD: process.env.CACHE_EMERGENCY_THRESHOLD,
      
      // Performance settings
      CACHE_MAX_METRICS_HISTORY: process.env.CACHE_MAX_METRICS_HISTORY,
      CACHE_METRICS_RESET_INTERVAL_MS: process.env.CACHE_METRICS_RESET_INTERVAL_MS,
      CACHE_DEDUPLICATION_TIMEOUT_MS: process.env.CACHE_DEDUPLICATION_TIMEOUT_MS,
      
      // Error handling  
      CACHE_MAX_RETRY_ATTEMPTS: process.env.CACHE_MAX_RETRY_ATTEMPTS,
      CACHE_RETRY_BACKOFF_MS: process.env.CACHE_RETRY_BACKOFF_MS,
      CACHE_BOOTSTRAP_MODE: process.env.CACHE_BOOTSTRAP_MODE,
      
      // Logging
      CACHE_VERBOSE_LOGGING: process.env.CACHE_VERBOSE_LOGGING,
      CACHE_LOG_MEMORY_USAGE: process.env.CACHE_LOG_MEMORY_USAGE,
      CACHE_LOG_PERFORMANCE_METRICS: process.env.CACHE_LOG_PERFORMANCE_METRICS,
      
      // Data source metadata
      LOCAL_CSV_LAST_UPDATED: process.env.LOCAL_CSV_LAST_UPDATED,
    });

    // Parse client environment (sent to browser)
    const client = clientEnvSchema.parse({
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_ADMIN_SESSION_HOURS: process.env.NEXT_PUBLIC_ADMIN_SESSION_HOURS,
      NEXT_PUBLIC_AUTH_EXPIRY_DAYS: process.env.NEXT_PUBLIC_AUTH_EXPIRY_DAYS,
    });

    // Additional validation for production
    if (server.NODE_ENV === 'production') {
      // Validate admin key strength in production
      if (server.ADMIN_KEY.length < 10) {
        throw new Error('❌ ADMIN_KEY must be at least 10 characters in production');
      }
    }

    return { server, client };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod validation errors in a user-friendly way
      const errorMessages = error.errors.map(err => {
        const field = err.path.join('.');
        const message = err.message;
        return `❌ ${field}: ${message}`;
      });
      
      console.error('🚨 Environment Configuration Errors:');
      errorMessages.forEach(msg => console.error(`   ${msg}`));
      
      // In production, fail hard. In development, provide helpful guidance
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Invalid environment configuration:\n${errorMessages.join('\n')}`);
      } else {
        console.error('\n💡 Fix these issues to continue. Check your .env files or environment variables.');
        throw error;
      }
    }
    throw error;
  }
}

// ========================================
// LAZY-LOADED ENVIRONMENT PROXY
// ========================================

/**
 * Lazy-initialized environment configuration
 * Only evaluates when accessed on server-side
 */
let _env: ReturnType<typeof createEnvironment> | null = null;

export const env = new Proxy({} as ReturnType<typeof createEnvironment>, {
  get(_target, prop) {
    if (!_env) {
      _env = createEnvironment();
    }
    return _env[prop as keyof typeof _env];
  }
});

// ========================================
// HELPER FUNCTIONS & UTILITIES
// ========================================

/**
 * Check if running in development mode
 */
export const isDev = () => env.server.NODE_ENV === 'development';

/**
 * Check if running in production mode
 */
export const isProd = () => env.server.NODE_ENV === 'production';

/**
 * Check if running in test mode
 */
export const isTest = () => env.server.NODE_ENV === 'test';

/**
 * Get current environment name
 */
export const currentEnv = () => env.server.NODE_ENV;

/**
 * Get Google Sheets configuration status
 */
export const getGoogleSheetsStatus = () => {
  const config = env.server;
  return {
    hasApiKey: !!(config.GOOGLE_SHEETS_API_KEY && config.GOOGLE_SHEET_ID),
    hasServiceAccount: !!(
      (config.GOOGLE_SERVICE_ACCOUNT_KEY || config.GOOGLE_SERVICE_ACCOUNT_FILE) && 
      config.GOOGLE_SHEET_ID
    ),
    hasDirectUrl: !!(config.GOOGLE_SHEETS_URL && config.GOOGLE_SHEETS_URL.startsWith('https://')),
    hasRemoteUrl: !!(config.REMOTE_CSV_URL && config.REMOTE_CSV_URL.startsWith('https://')),
    isConfigured: function() {
      return this.hasApiKey || this.hasServiceAccount || this.hasDirectUrl || this.hasRemoteUrl;
    }
  };
};

/**
 * Get cache configuration
 */
export const getCacheConfig = () => {
  const config = env.server;
  return {
    // Core cache settings
    cacheDuration: config.CACHE_DURATION_MS,
    remoteRefreshInterval: config.REMOTE_REFRESH_INTERVAL_MS,
    maxCacheAge: config.MAX_CACHE_AGE_MS,
    cacheExtensionDuration: config.CACHE_EXTENSION_DURATION_MS,

    // Memory management
    maxMemoryUsage: config.CACHE_MAX_MEMORY_BYTES,
    memoryCheckInterval: config.CACHE_MEMORY_CHECK_INTERVAL_MS,
    cleanupThreshold: config.CACHE_CLEANUP_THRESHOLD,
    emergencyThreshold: config.CACHE_EMERGENCY_THRESHOLD,

    // Performance settings
    maxMetricsHistory: config.CACHE_MAX_METRICS_HISTORY,
    metricsResetInterval: config.CACHE_METRICS_RESET_INTERVAL_MS,
    deduplicationTimeout: config.CACHE_DEDUPLICATION_TIMEOUT_MS,

    // Error handling
    maxRetryAttempts: config.CACHE_MAX_RETRY_ATTEMPTS,
    retryBackoffMs: config.CACHE_RETRY_BACKOFF_MS,
    bootstrapMode: config.CACHE_BOOTSTRAP_MODE,

    // Logging
    verboseLogging: config.CACHE_VERBOSE_LOGGING,
    logMemoryUsage: config.CACHE_LOG_MEMORY_USAGE,
    logPerformanceMetrics: config.CACHE_LOG_PERFORMANCE_METRICS,

    // Data source metadata
    localCsvLastUpdated: config.LOCAL_CSV_LAST_UPDATED,
  };
};

/**
 * Get admin configuration
 */
export const getAdminConfig = () => {
  const config = env.server;
  return {
    key: config.ADMIN_KEY,
    isDevelopment: isDev(),
    isProduction: isProd(),
  };
};

/**
 * Get site configuration
 */
export const getSiteConfig = () => {
  const config = env.client;
  return {
    basePath: config.NEXT_PUBLIC_BASE_PATH,
    siteUrl: config.NEXT_PUBLIC_SITE_URL,
  };
};

/**
 * Get admin UI configuration
 */
export const getAdminUIConfig = () => {
  const config = env.client;
  return {
    sessionHours: config.NEXT_PUBLIC_ADMIN_SESSION_HOURS,
    authExpiryDays: config.NEXT_PUBLIC_AUTH_EXPIRY_DAYS,
  };
};

/**
 * Log current configuration status (for debugging)
 */
export const logConfigStatus = (): void => {
  if (typeof window !== 'undefined') return;
  
  const serverConfig = env.server;
  const clientConfig = env.client;
  const googleStatus = getGoogleSheetsStatus();
  
  console.log('🔧 Environment Configuration Status:');
  console.log(`   Environment: ${serverConfig.NODE_ENV}`);
  console.log(`   Admin Key: ${serverConfig.ADMIN_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Google Sheets: ${googleStatus.isConfigured() ? '✅ Configured' : '⚠️ Not configured'}`);
  console.log(`   Cache Duration: ${serverConfig.CACHE_DURATION_MS}ms`);
  console.log(`   Max Cache Age: ${serverConfig.MAX_CACHE_AGE_MS}ms`);
  console.log(`   Site URL: ${clientConfig.NEXT_PUBLIC_SITE_URL}`);
  
  if (googleStatus.isConfigured()) {
    console.log('   Google Sheets Details:');
    if (googleStatus.hasApiKey) console.log('     - API Key: ✅');
    if (googleStatus.hasServiceAccount) console.log('     - Service Account: ✅');
    if (googleStatus.hasDirectUrl) console.log('     - Direct URL: ✅');
    if (googleStatus.hasRemoteUrl) console.log('     - Remote CSV: ✅');
  }
};

/**
 * Validate environment configuration and return status
 */
export const validateEnvironmentConfig = (): { 
  isValid: boolean; 
  errors: string[]; 
  warnings: string[] 
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Try to access the environment to trigger validation
    const serverConfig = env.server;
    const clientConfig = env.client;
    
    // Check Google Sheets configuration
    if (!getGoogleSheetsStatus().isConfigured()) {
      warnings.push('Google Sheets: No valid configuration found for remote data fetching');
    }
    
    // Check site URL in production
    if (serverConfig.NODE_ENV === 'production' && clientConfig.NEXT_PUBLIC_SITE_URL === 'http://localhost:3000') {
      warnings.push('NEXT_PUBLIC_SITE_URL: Should be set to production URL for proper functionality');
    }
    
    return { isValid: true, errors, warnings };
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      });
    } else {
      errors.push(error instanceof Error ? error.message : 'Unknown validation error');
    }
    
    return { isValid: false, errors, warnings };
  }
};

// ========================================
// TYPE EXPORTS
// ========================================

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type Environment = ReturnType<typeof createEnvironment>; 