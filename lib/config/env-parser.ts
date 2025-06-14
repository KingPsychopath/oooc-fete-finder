/**
 * Environment Variable Parser - Clean & Intuitive API
 * Reusable environment variable parsing with TypeScript support
 */

/**
 * Environment variable parser for required values
 */
class RequiredEnvParser<T> {
	constructor(
		private key: string,
		private parser: (value: string) => T,
		private typeName: string
	) {}

	/**
	 * Mark this environment variable as required
	 * Throws error if missing or invalid
	 */
	required(): T {
		const value = process.env[this.key];
		if (!value) {
			throw new Error(`❌ Required environment variable ${this.key} is not set`);
		}
		try {
			return this.parser(value);
		} catch {
			throw new Error(`❌ Required environment variable ${this.key}="${value}" must be a valid ${this.typeName}`);
		}
	}
}

/**
 * Parse environment variable with optional default
 * Returns the parsed value directly
 */
function parseEnvWithDefault<T>(
	key: string,
	parser: (value: string) => T,
	typeName: string,
	defaultValue: T
): T {
	const envValue = process.env[key];
	if (!envValue) {
		return defaultValue;
	}
	
	try {
		return parser(envValue);
	} catch {
		console.warn(`⚠️ Invalid ${typeName} for ${key}="${envValue}", using default: ${defaultValue}`);
		return defaultValue;
	}
}

// String parser functions
function envString(key: string): RequiredEnvParser<string>;
function envString(key: string, defaultValue: string): string;
function envString(key: string, defaultValue?: string): string | RequiredEnvParser<string> {
	if (defaultValue !== undefined) {
		return parseEnvWithDefault(key, (value: string) => value, "string", defaultValue);
	}
	return new RequiredEnvParser(key, (value: string) => value, "string");
}

// Integer parser functions
function envInt(key: string): RequiredEnvParser<number>;
function envInt(key: string, defaultValue: number): number;
function envInt(key: string, defaultValue?: number): number | RequiredEnvParser<number> {
	const parser = (value: string) => {
		const parsed = parseInt(value, 10);
		if (isNaN(parsed)) throw new Error("Invalid integer");
		return parsed;
	};
	
	if (defaultValue !== undefined) {
		return parseEnvWithDefault(key, parser, "integer", defaultValue);
	}
	return new RequiredEnvParser(key, parser, "integer");
}

// Float parser functions
function envFloat(key: string): RequiredEnvParser<number>;
function envFloat(key: string, defaultValue: number): number;
function envFloat(key: string, defaultValue?: number): number | RequiredEnvParser<number> {
	const parser = (value: string) => {
		const parsed = parseFloat(value);
		if (isNaN(parsed)) throw new Error("Invalid float");
		return parsed;
	};
	
	if (defaultValue !== undefined) {
		return parseEnvWithDefault(key, parser, "float", defaultValue);
	}
	return new RequiredEnvParser(key, parser, "float");
}

// Boolean parser functions
function envBool(key: string): RequiredEnvParser<boolean>;
function envBool(key: string, defaultValue: boolean): boolean;
function envBool(key: string, defaultValue?: boolean): boolean | RequiredEnvParser<boolean> {
	const parser = (value: string) => {
		const lower = value.toLowerCase().trim();
		return lower === "true" || lower === "1" || lower === "yes" || lower === "on";
	};
	
	if (defaultValue !== undefined) {
		return parseEnvWithDefault(key, parser, "boolean", defaultValue);
	}
	return new RequiredEnvParser(key, parser, "boolean");
}

// URL parser functions
function envUrl(key: string): RequiredEnvParser<string>;
function envUrl(key: string, defaultValue: string): string;
function envUrl(key: string, defaultValue?: string): string | RequiredEnvParser<string> {
	const parser = (value: string) => {
		try {
			new URL(value);
			return value;
		} catch {
			throw new Error("Invalid URL");
		}
	};
	
	if (defaultValue !== undefined) {
		return parseEnvWithDefault(key, parser, "URL", defaultValue);
	}
	return new RequiredEnvParser(key, parser, "URL");
}

// JSON parser functions
function envJson<T = unknown>(key: string): RequiredEnvParser<T>;
function envJson<T = unknown>(key: string, defaultValue: T): T;
function envJson<T = unknown>(key: string, defaultValue?: T): T | RequiredEnvParser<T> {
	const parser = (value: string) => {
		try {
			return JSON.parse(value) as T;
		} catch {
			throw new Error("Invalid JSON");
		}
	};
	
	if (defaultValue !== undefined) {
		return parseEnvWithDefault(key, parser, "JSON", defaultValue);
	}
	return new RequiredEnvParser(key, parser, "JSON");
}

// Enum parser functions
function envEnum<T extends string>(key: string, allowedValues: readonly T[]): RequiredEnvParser<T>;
function envEnum<T extends string>(key: string, allowedValues: readonly T[], defaultValue: T): T;
function envEnum<T extends string>(key: string, allowedValues: readonly T[], defaultValue?: T): T | RequiredEnvParser<T> {
	const parser = (value: string) => {
		if (!allowedValues.includes(value as T)) {
			throw new Error(`Must be one of: ${allowedValues.join(", ")}`);
		}
		return value as T;
	};
	
	if (defaultValue !== undefined) {
		return parseEnvWithDefault(key, parser, `enum (${allowedValues.join("|")})`, defaultValue);
	}
	return new RequiredEnvParser(key, parser, `enum (${allowedValues.join("|")})`);
}

/**
 * Environment variable API - clean and intuitive
 * 
 * @example
 * ```typescript
 * // Required variables
 * const apiKey = env.string("API_KEY").required();
 * const port = env.int("PORT").required();
 * 
 * // Optional with defaults (returns value directly)
 * const timeout = env.int("TIMEOUT", 5000);
 * const debug = env.bool("DEBUG", false);
 * const basePath = env.string("BASE_PATH", "");
 * ```
 */
export const env = {
	/**
	 * Parse as string
	 */
	string: envString,

	/**
	 * Parse as integer
	 */
	int: envInt,

	/**
	 * Parse as float
	 */
	float: envFloat,

	/**
	 * Parse as boolean
	 * Accepts: "true", "1", "yes", "on" (case insensitive)
	 */
	bool: envBool,

	/**
	 * Parse as URL
	 */
	url: envUrl,

	/**
	 * Parse as JSON
	 */
	json: envJson,

	/**
	 * Parse as enum (one of specific values)
	 */
	enum: envEnum,
};

/**
 * Type helper for extracting the type from an environment parser
 */
export type EnvType<T> = T extends RequiredEnvParser<infer U> ? U : T; 