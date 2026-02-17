/**
 * Keeps instrumentation runtime-safe by delegating Node-only work to a helper.
 */
export async function register(): Promise<void> {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const { runNodeInstrumentation } = await import("./instrumentation.server");
		await runNodeInstrumentation();
	}
}
