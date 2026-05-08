import "server-only";

import { getUserCollectionRepository } from "@/lib/platform/postgres/user-collection-repository";
import { getUserRepository } from "@/lib/platform/postgres/user-repository";

type ClientContextInput = {
	deviceClass?: string | null;
	platform?: string | null;
	browserFamily?: string | null;
	timezone?: string | null;
	locale?: string | null;
};

const hasContextValue = (context: ClientContextInput): boolean =>
	Boolean(
		context.deviceClass ||
			context.platform ||
			context.browserFamily ||
			context.timezone ||
			context.locale,
	);

export const touchAuthenticatedUserContext = async (input: {
	userId?: string | null;
	email?: string | null;
	clientContext?: ClientContextInput | null;
}): Promise<void> => {
	const context = input.clientContext;
	if (!input.userId && !input.email) return;
	if (!context) return;
	if (!hasContextValue(context)) return;

	const touchInput = {
		userId: input.userId,
		email: input.email,
		deviceClass: context.deviceClass ?? null,
		platform: context.platform ?? null,
		browserFamily: context.browserFamily ?? null,
		timezone: context.timezone ?? null,
		locale: context.locale ?? null,
	};

	await Promise.all([
		getUserRepository()?.touchContext(touchInput) ?? Promise.resolve(),
		getUserCollectionRepository()?.touchContext(touchInput) ??
			Promise.resolve(),
	]);
};
