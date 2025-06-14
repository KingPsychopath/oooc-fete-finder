# Environment Configuration

Clean, type-safe environment variable parsing with an intuitive API.

## Features

- 🎯 **Intuitive API** - Variables are optional by default, only mark as `.required()` when needed
- 🔒 **Type Safe** - Full TypeScript support with proper type inference
- 🚀 **Zero Dependencies** - Lightweight, no external dependencies
- 🛡️ **Validation** - Built-in parsing and validation with helpful error messages
- 📦 **Modular** - Reusable parser separated from application config

## Quick Start

```typescript
import { env } from "./env-parser";

// Required variables (throws if missing)
const apiKey = env.string("API_KEY").required();
const port = env.int("PORT").required();

// Optional with defaults
const timeout = env.int("TIMEOUT", 5000).value;
const debug = env.bool("DEBUG", false).value;
const basePath = env.string("BASE_PATH", "").value;
```

## API Reference

### Basic Types

```typescript
// String parsing
env.string("API_KEY").required()           // Required string
env.string("BASE_PATH", "").value          // Optional with default

// Integer parsing  
env.int("PORT").required()                 // Required integer
env.int("TIMEOUT", 5000).value             // Optional with default

// Float parsing
env.float("RATIO").required()              // Required float
env.float("THRESHOLD", 0.8).value          // Optional with default

// Boolean parsing (accepts: "true", "1", "yes", "on")
env.bool("ENABLED").required()             // Required boolean
env.bool("DEBUG", false).value             // Optional with default
```

### Advanced Types

```typescript
// URL validation
env.url("API_ENDPOINT").required()         // Must be valid URL
env.url("WEBHOOK_URL", "").value           // Optional URL

// JSON parsing
env.json<Config>("CONFIG").required()      // Required JSON
env.json("SETTINGS", {}).value             // Optional with default

// Enum validation
env.enum("LOG_LEVEL", ["debug", "info", "warn", "error"]).required()
env.enum("NODE_ENV", ["development", "production"], "development").value
```

## Usage Examples

### Application Configuration

```typescript
// lib/config/env.ts
import { env } from "./env-parser";

const SERVER_ENV_SCHEMA = {
  // Core settings
  NODE_ENV: env.string("NODE_ENV", "development").value,
  
  // Required in production
  ADMIN_KEY: process.env.NODE_ENV === "production" 
    ? env.string("ADMIN_KEY").required()
    : env.string("ADMIN_KEY", "dev-key").value,
    
  // Cache configuration
  CACHE_DURATION_MS: env.int("CACHE_DURATION_MS", 3600000).value,
  CACHE_ENABLED: env.bool("CACHE_ENABLED", true).value,
  
  // External services
  DATABASE_URL: env.url("DATABASE_URL").required(),
  API_CONFIG: env.json<ApiConfig>("API_CONFIG", defaultConfig).value,
} as const;
```

### Error Handling

The parser provides clear, actionable error messages:

```bash
# Missing required variable
❌ Required environment variable API_KEY is not set

# Invalid type
❌ Required environment variable PORT="abc" must be a valid integer

# Invalid enum value
❌ Required environment variable LOG_LEVEL="verbose" must be one of: debug, info, warn, error
```

## Benefits vs Alternatives

| Feature | Our Parser | Zod | Manual `process.env` |
|---------|------------|-----|---------------------|
| Bundle Size | ~2KB | ~50KB+ | 0KB |
| Runtime Overhead | Minimal | High | None |
| Type Safety | ✅ Perfect | ✅ Perfect | ❌ Manual |
| Error Messages | ✅ Clear | ✅ Good | ❌ Poor |
| API Simplicity | ✅ Intuitive | ⚠️ Verbose | ❌ Repetitive |
| Validation | ✅ Built-in | ✅ Extensive | ❌ Manual |

## Migration from Manual `process.env`

```typescript
// BEFORE
const port = parseInt(process.env.PORT || "3000", 10);
const debug = process.env.DEBUG?.toLowerCase() === "true";
const apiKey = process.env.API_KEY; // Could be undefined!

// AFTER  
const port = env.int("PORT", 3000).value;
const debug = env.bool("DEBUG", false).value;
const apiKey = env.string("API_KEY").required(); // Type-safe!
```

This parser gives you the simplicity of manual environment variable handling with the safety and features of a validation library, without the bloat. 