/**
 * Structured server-side logger.
 *
 * Dev: human-readable [scope] message + optional context.
 * Prod: JSON lines (one per entry) for log drains.
 *
 * Usage:
 *   import { log } from '@/lib/platform/logger';
 *   log.info('cache', 'Events loaded', { source: 'store', count: 81 });
 *   log.warn('geocoding', 'Using arrondissement fallback (API unavailable)');
 */

import "server-only";

type LogLevel = "info" | "warn" | "error";

const IS_DEV = process.env.NODE_ENV === "development";

function formatError(err: unknown): { message: string; stack?: string } {
	if (err instanceof Error) {
		return {
			message: err.message,
			...(err.stack ? { stack: err.stack } : {}),
		};
	}
	return { message: String(err) };
}

function emit(
	level: LogLevel,
	scope: string,
	message: string,
	context?: Record<string, unknown>,
	err?: unknown,
): void {
	const entry: Record<string, unknown> = {
		level,
		scope,
		message,
		...(context ? { context } : {}),
		...(err ? { error: formatError(err) } : {}),
		ts: new Date().toISOString(),
	};

	if (IS_DEV) {
		const prefix =
			level === "error" ? "✗" : level === "warn" ? "⚠" : "·";
		const tag = `[${scope}]`;
		const extra = context ? ` ${JSON.stringify(context)}` : "";
		const errLine = err ? `\n  → ${formatError(err).message}` : "";
		const fn =
			level === "error"
				? console.error
				: level === "warn"
					? console.warn
					: console.log;
		fn(`${prefix} ${tag} ${message}${extra}${errLine}`);
	} else {
		const fn =
			level === "error"
				? console.error
				: level === "warn"
					? console.warn
					: console.log;
		fn(JSON.stringify(entry));
	}
}

export const log = {
	info: (
		scope: string,
		message: string,
		context?: Record<string, unknown>,
	) => emit("info", scope, message, context),

	warn: (
		scope: string,
		message: string,
		context?: Record<string, unknown>,
	) => emit("warn", scope, message, context),

	error: (
		scope: string,
		message: string,
		context?: Record<string, unknown>,
		err?: unknown,
	) => emit("error", scope, message, context, err),
};
