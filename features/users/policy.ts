import "server-only";

import type {
	UserPolicyDecision,
	UserRestrictionScope,
} from "@/features/users/types";
import { getUserPolicyRepository } from "./policy-repository";

const DEFAULT_RESTRICTION_MESSAGE =
	"This action is currently restricted for your account.";

export const getUserActionPolicyDecision = async (input: {
	userId?: string | null;
	email?: string | null;
	scope: UserRestrictionScope;
}): Promise<UserPolicyDecision> => {
	const repository = getUserPolicyRepository();
	if (!repository) {
		return { allowed: true, restriction: null, reason: null };
	}

	return repository.getRestrictionDecision(input);
};

export const assertUserActionAllowed = async (input: {
	userId?: string | null;
	email?: string | null;
	scope: UserRestrictionScope;
	message?: string;
}): Promise<void> => {
	const decision = await getUserActionPolicyDecision(input);
	if (decision.allowed) return;

	throw new Error(
		decision.reason || input.message || DEFAULT_RESTRICTION_MESSAGE,
	);
};

export const getUserRestrictionMessage = (decision: UserPolicyDecision): string =>
	decision.reason || DEFAULT_RESTRICTION_MESSAGE;
