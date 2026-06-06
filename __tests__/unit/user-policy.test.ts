import { describe, expect, it, vi } from "vitest";

type RepositoryMock = {
	getRestrictionDecision: ReturnType<typeof vi.fn>;
};

const loadPolicy = async (repository: RepositoryMock | null) => {
	vi.resetModules();
	vi.doMock("@/features/users/policy-repository", () => ({
		getUserPolicyRepository: () => repository,
	}));
	return await import("@/features/users/policy");
};

describe("user policy helpers", () => {
	it("allows actions when the repository is unavailable", async () => {
		const { getUserActionPolicyDecision } = await loadPolicy(null);

		const decision = await getUserActionPolicyDecision({
			userId: "user_1",
			email: "user@example.com",
			scope: "ticket_exchange.post",
		});

		expect(decision).toEqual({
			allowed: true,
			restriction: null,
			reason: null,
		});
	});

	it("delegates decisions to the repository when available", async () => {
		const repository = {
			getRestrictionDecision: vi.fn().mockResolvedValue({
				allowed: true,
				restriction: null,
				reason: null,
			}),
		};
		const { getUserActionPolicyDecision } = await loadPolicy(repository);

		await getUserActionPolicyDecision({
			userId: "user_1",
			email: "user@example.com",
			scope: "saved_events.sync",
		});

		expect(repository.getRestrictionDecision).toHaveBeenCalledWith({
			userId: "user_1",
			email: "user@example.com",
			scope: "saved_events.sync",
		});
	});

	it("throws the restriction reason when an action is denied", async () => {
		const repository = {
			getRestrictionDecision: vi.fn().mockResolvedValue({
				allowed: false,
				restriction: {
					id: "rst_1",
					scope: "ticket_exchange.post",
				},
				reason: "Posting is paused for this account.",
			}),
		};
		const { assertUserActionAllowed } = await loadPolicy(repository);

		await expect(
			assertUserActionAllowed({
				userId: "user_1",
				email: "user@example.com",
				scope: "ticket_exchange.post",
			}),
		).rejects.toThrow("Posting is paused for this account.");
	});
});
