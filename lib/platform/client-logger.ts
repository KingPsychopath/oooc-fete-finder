type LogLevel = "info" | "warn" | "error";

function toErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

function emit(
	level: LogLevel,
	scope: string,
	message: string,
	context?: Record<string, unknown>,
	err?: unknown,
): void {
	const prefix = `[${scope}]`;
	const fn =
		level === "error"
			? console.error
			: level === "warn"
				? console.warn
				: console.log;
	const details = context ? ` ${JSON.stringify(context)}` : "";
	const suffix = err ? ` (${toErrorMessage(err)})` : "";
	fn(`${prefix} ${message}${details}${suffix}`);
}

export const clientLog = {
	info: (
		scope: string,
		message: string,
		context?: Record<string, unknown>,
	): void => emit("info", scope, message, context),
	warn: (
		scope: string,
		message: string,
		context?: Record<string, unknown>,
	): void => emit("warn", scope, message, context),
	error: (
		scope: string,
		message: string,
		context?: Record<string, unknown>,
		err?: unknown,
	): void => emit("error", scope, message, context, err),
};
