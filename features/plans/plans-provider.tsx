"use client";

import { useOptionalAuth } from "@/features/auth/auth-context";
import { getUserProfileStorageKey } from "@/features/auth/user-profile-storage-key";
import {
	enqueueRoutePlanDeleteMutation,
	enqueueRoutePlanMutation,
	flushPendingMutations,
	getPendingMutationCount,
} from "@/features/offline-mutations/pending-mutation-queue";
import { sanitizePlanTitleForStorage } from "@/features/plans/plan-title";
import {
	MAX_PLANS_PER_DATE,
	type PlanUpsertInput,
	type UserPlan,
} from "@/features/plans/types";
import {
	type PendingSyncStatus,
	canSyncAccountData,
	getClientSyncMode,
	getPendingSyncStatus,
} from "@/features/sync/client-sync-mode";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

const STORAGE_PREFIX = "oooc:route-plans:v1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface PlansContextValue {
	plans: UserPlan[];
	pendingPlanMutationCount: number;
	pendingPlanMutationStatus: PendingSyncStatus;
	upsertPlan: (plan: PlanUpsertInput, source?: string) => UserPlan | null;
	sharePlan: (plan: UserPlan) => Promise<UserPlan | null>;
	revokePlanShare: (plan: UserPlan) => Promise<UserPlan | null>;
	deletePlan: (planId: string) => void;
	getPlansForDate: (date: string) => UserPlan[];
}

const PlansContext = createContext<PlansContextValue | null>(null);

const createId = (): string => {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const nowIso = (): string => new Date().toISOString();

const normalizeEventKey = (eventKey: string): string =>
	eventKey.trim().toLowerCase();

export const getPlansOwnerKey = (
	userId: string | null,
	email: string | null,
	isAuthenticated: boolean,
): string =>
	getUserProfileStorageKey({
		userId,
		email,
		isAuthenticated,
		anonymousKey: "anon",
	});

const getStorageKey = (ownerKey: string): string =>
	`${STORAGE_PREFIX}:${ownerKey}`;

const isUserPlan = (value: unknown): value is UserPlan => {
	if (!value || typeof value !== "object") return false;
	const plan = value as Partial<UserPlan>;
	return (
		typeof plan.id === "string" &&
		typeof plan.ownerKey === "string" &&
		typeof plan.planDate === "string" &&
		typeof plan.title === "string" &&
		Array.isArray(plan.stops)
	);
};

const readLocalPlans = (ownerKey: string): UserPlan[] => {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(getStorageKey(ownerKey));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isUserPlan).map((plan) => ({
			...plan,
			shareOwnerNameVisible: plan.shareOwnerNameVisible !== false,
		}));
	} catch {
		window.localStorage.removeItem(getStorageKey(ownerKey));
		return [];
	}
};

const writeLocalPlans = (ownerKey: string, plans: UserPlan[]) => {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		getStorageKey(ownerKey),
		JSON.stringify(
			plans
				.slice()
				.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
		),
	);
};

const sortPlansByUpdatedAt = (plans: UserPlan[]): UserPlan[] =>
	plans
		.slice()
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

const clearLocalPlans = (ownerKey: string) => {
	if (typeof window === "undefined") return;
	window.localStorage.removeItem(getStorageKey(ownerKey));
};

const mergePlans = (
	localPlans: UserPlan[],
	remotePlans: UserPlan[],
): UserPlan[] => {
	const byId = new Map<string, UserPlan>();
	for (const plan of [...remotePlans, ...localPlans]) {
		const existing = byId.get(plan.id);
		if (!existing || plan.updatedAt > existing.updatedAt) {
			byId.set(plan.id, plan);
		}
	}
	return Array.from(byId.values()).sort((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt),
	);
};

const toUserPlan = (
	ownerKey: string,
	userId: string | null,
	input: PlanUpsertInput,
	current?: UserPlan,
): UserPlan => {
	const timestamp = nowIso();
	const planId = input.id || current?.id || createId();
	return {
		id: planId,
		userId,
		ownerKey,
		planDate: input.planDate,
		title: sanitizePlanTitleForStorage(input.title, "My route"),
		visibility: input.visibility,
		shareToken: current?.shareToken ?? null,
		shareOwnerNameVisible:
			input.shareOwnerNameVisible ?? current?.shareOwnerNameVisible ?? true,
		createdAt: current?.createdAt ?? timestamp,
		updatedAt: timestamp,
		stops: input.stops
			.map((stop, index) => ({
				id: stop.id || current?.stops[index]?.id || createId(),
				eventKey: normalizeEventKey(stop.eventKey),
				stopOrder: index + 1,
				locked: stop.locked ?? false,
				arrivalTime: stop.arrivalTime ?? null,
				departureTime: stop.departureTime ?? null,
				travelMinutesFromPrevious: stop.travelMinutesFromPrevious ?? null,
				createdAt: current?.stops[index]?.createdAt ?? timestamp,
				updatedAt: timestamp,
			}))
			.filter((stop) => stop.eventKey.length > 0),
	};
};

const syncPlan = async (input: {
	ownerKey: string;
	plan: UserPlan;
	source: string;
	queueOnFailure?: boolean;
}): Promise<UserPlan | null> => {
	try {
		const response = await fetch(`${basePath}/api/user/plans`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				plan: {
					id: input.plan.id,
					planDate: input.plan.planDate,
					title: input.plan.title,
					visibility: input.plan.visibility,
					shareOwnerNameVisible: input.plan.shareOwnerNameVisible,
					stops: input.plan.stops.map((stop) => ({
						id: stop.id,
						eventKey: stop.eventKey,
						stopOrder: stop.stopOrder,
						locked: stop.locked,
						arrivalTime: stop.arrivalTime,
						departureTime: stop.departureTime,
						travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
					})),
				},
				source: input.source,
				idempotencyKey: `route_plan:${input.ownerKey}:${input.plan.id}`,
			}),
		});
		if (response.ok) {
			const payload = (await response.json()) as {
				success: boolean;
				plan?: UserPlan;
			};
			return payload.success && payload.plan ? payload.plan : input.plan;
		}
	} catch {
		// Queue below.
	}
	if (input.queueOnFailure) {
		enqueueRoutePlanMutation({
			ownerKey: input.ownerKey,
			planId: input.plan.id,
			plan: input.plan,
			source: input.source,
		});
	}
	return null;
};

const syncPlanDelete = async (input: {
	ownerKey: string;
	planId: string;
	source: string;
	queueOnFailure?: boolean;
}): Promise<boolean> => {
	try {
		const response = await fetch(`${basePath}/api/user/plans`, {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				planId: input.planId,
				source: input.source,
				idempotencyKey: `route_plan_delete:${input.ownerKey}:${input.planId}`,
			}),
		});
		if (response.ok) return true;
	} catch {
		// Queue below.
	}
	if (input.queueOnFailure) {
		enqueueRoutePlanDeleteMutation({
			ownerKey: input.ownerKey,
			planId: input.planId,
			source: input.source,
		});
	}
	return false;
};

export function PlansProvider({ children }: { children: ReactNode }) {
	const { authMode, isAuthenticated, isOnline, userEmail, userId } =
		useOptionalAuth();
	const ownerKey = getPlansOwnerKey(userId, userEmail, isAuthenticated);
	const syncMode = getClientSyncMode({ authMode, isAuthenticated, isOnline });
	const canSync = canSyncAccountData(syncMode);
	const [plans, setPlans] = useState<UserPlan[]>(() => []);
	const plansRef = useRef<UserPlan[]>([]);
	const [pendingPlanMutationCount, setPendingPlanMutationCount] = useState(0);
	const previousOwnerKeyRef = useRef(ownerKey);
	const pendingPlanMutationStatus = getPendingSyncStatus(
		pendingPlanMutationCount,
		isOnline,
	);

	useEffect(() => {
		const previousOwnerKey = previousOwnerKeyRef.current;
		previousOwnerKeyRef.current = ownerKey;
		const localPlans = readLocalPlans(ownerKey);
		const anonymousPlans = readLocalPlans("anon");
		const shouldMergeAnonymous =
			canSync &&
			previousOwnerKey === "anon" &&
			ownerKey !== "anon" &&
			anonymousPlans.length > 0;
		const mergedLocal = shouldMergeAnonymous
			? mergePlans(localPlans, anonymousPlans).map((plan) => ({
					...plan,
					ownerKey,
					userId,
				}))
			: localPlans;
		plansRef.current = sortPlansByUpdatedAt(mergedLocal);
		setPlans(plansRef.current);
		setPendingPlanMutationCount(getPendingMutationCount(ownerKey));

		if (shouldMergeAnonymous) {
			writeLocalPlans(ownerKey, mergedLocal);
			clearLocalPlans("anon");
			for (const plan of mergedLocal) {
				void syncPlan({
					ownerKey,
					plan,
					source: "anonymous_plan_merge",
					queueOnFailure: true,
				});
			}
		}
	}, [canSync, ownerKey, userId]);

	useEffect(() => {
		if (!canSync) return;
		let isCancelled = false;
		const loadRemotePlans = async () => {
			try {
				const response = await fetch(`${basePath}/api/user/plans`, {
					cache: "no-store",
				});
				if (!response.ok) return;
				const payload = (await response.json()) as {
					success: boolean;
					plans?: UserPlan[];
				};
				if (!payload.success || !Array.isArray(payload.plans) || isCancelled) {
					return;
				}
				setPlans((current) => {
					const merged = mergePlans(current, payload.plans ?? []);
					plansRef.current = merged;
					writeLocalPlans(ownerKey, merged);
					return merged;
				});
			} catch {
				// Local plans remain canonical while remote fetch is unavailable.
			}
		};
		void loadRemotePlans();
		return () => {
			isCancelled = true;
		};
	}, [canSync, ownerKey]);

	useEffect(() => {
		if (!canSync) return;
		const flush = async () => {
			const result = await flushPendingMutations({
				ownerKey,
				routePlan: ({ mutation }) =>
					syncPlan({
						ownerKey: mutation.ownerKey,
						plan: mutation.payload.plan as UserPlan,
						source: mutation.payload.source,
					}).then(Boolean),
				routePlanDelete: ({ mutation }) =>
					syncPlanDelete({
						ownerKey: mutation.ownerKey,
						planId: mutation.payload.planId,
						source: mutation.payload.source,
					}),
			});
			setPendingPlanMutationCount(result.remaining);
		};
		void flush();
	}, [canSync, ownerKey]);

	const upsertPlan = useCallback(
		(input: PlanUpsertInput, source = "plans_page") => {
			const currentPlans = plansRef.current;
			const existing = input.id
				? currentPlans.find((plan) => plan.id === input.id)
				: undefined;
			if (
				!existing &&
				currentPlans.filter((plan) => plan.planDate === input.planDate)
					.length >= MAX_PLANS_PER_DATE
			) {
				return null;
			}
			const savedPlan = toUserPlan(ownerKey, userId, input, existing);
			const next = [
				savedPlan,
				...currentPlans.filter((plan) => plan.id !== savedPlan.id),
			].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
			plansRef.current = next;
			writeLocalPlans(ownerKey, next);
			setPlans(next);
			if (canSync) {
				void syncPlan({
					ownerKey,
					plan: savedPlan,
					source,
					queueOnFailure: true,
				}).then((remotePlan) => {
					if (remotePlan) {
						setPlans((current) => {
							const next = [
								remotePlan,
								...current.filter((plan) => plan.id !== remotePlan.id),
							].sort((left, right) =>
								right.updatedAt.localeCompare(left.updatedAt),
							);
							plansRef.current = next;
							writeLocalPlans(ownerKey, next);
							return next;
						});
					}
					setPendingPlanMutationCount(getPendingMutationCount(ownerKey));
				});
			} else if (isAuthenticated && ownerKey !== "anon") {
				enqueueRoutePlanMutation({
					ownerKey,
					planId: savedPlan.id,
					plan: savedPlan,
					source,
				});
				setPendingPlanMutationCount(getPendingMutationCount(ownerKey));
			}
			return savedPlan;
		},
		[canSync, isAuthenticated, ownerKey, userId],
	);

	const savePlanVisibility = useCallback(
		async (
			plan: UserPlan,
			visibility: UserPlan["visibility"],
			source: string,
		): Promise<UserPlan | null> => {
			if (!canSync) return null;
			const savedPlan = toUserPlan(
				ownerKey,
				userId,
				{
					id: plan.id,
					planDate: plan.planDate,
					title: plan.title,
					visibility,
					shareOwnerNameVisible: plan.shareOwnerNameVisible,
					stops: plan.stops,
				},
				plan,
			);
			const localPlan =
				visibility === "private"
					? { ...savedPlan, shareToken: null, shareOwnerNameVisible: true }
					: savedPlan;
			const applyPlan = (nextPlan: UserPlan) => {
				setPlans((current) => {
					const next = [
						nextPlan,
						...current.filter((candidate) => candidate.id !== nextPlan.id),
					].sort((left, right) =>
						right.updatedAt.localeCompare(left.updatedAt),
					);
					plansRef.current = next;
					writeLocalPlans(ownerKey, next);
					return next;
				});
			};
			const remotePlan = await syncPlan({
				ownerKey,
				plan: localPlan,
				source,
				queueOnFailure: false,
			});
			if (remotePlan) applyPlan(remotePlan);
			setPendingPlanMutationCount(getPendingMutationCount(ownerKey));
			return remotePlan;
		},
		[canSync, ownerKey, userId],
	);

	const sharePlan = useCallback(
		(plan: UserPlan) =>
			savePlanVisibility(plan, "unlisted", "plans_page_share"),
		[savePlanVisibility],
	);

	const revokePlanShare = useCallback(
		(plan: UserPlan) =>
			savePlanVisibility(plan, "private", "plans_page_revoke_share"),
		[savePlanVisibility],
	);

	const deletePlan = useCallback(
		(planId: string) => {
			setPlans((current) => {
				const next = current.filter((plan) => plan.id !== planId);
				plansRef.current = next;
				writeLocalPlans(ownerKey, next);
				return next;
			});
			if (canSync) {
				void syncPlanDelete({
					ownerKey,
					planId,
					source: "plans_page_delete",
					queueOnFailure: true,
				}).then(() => {
					setPendingPlanMutationCount(getPendingMutationCount(ownerKey));
				});
			} else if (isAuthenticated && ownerKey !== "anon") {
				enqueueRoutePlanDeleteMutation({
					ownerKey,
					planId,
					source: "plans_page_delete",
				});
				setPendingPlanMutationCount(getPendingMutationCount(ownerKey));
			}
		},
		[canSync, isAuthenticated, ownerKey],
	);

	const getPlansForDate = useCallback(
		(date: string) => plans.filter((plan) => plan.planDate === date),
		[plans],
	);

	const value = useMemo(
		() => ({
			plans,
			pendingPlanMutationCount,
			pendingPlanMutationStatus,
			upsertPlan,
			sharePlan,
			revokePlanShare,
			deletePlan,
			getPlansForDate,
		}),
		[
			deletePlan,
			getPlansForDate,
			pendingPlanMutationCount,
			pendingPlanMutationStatus,
			plans,
			revokePlanShare,
			sharePlan,
			upsertPlan,
		],
	);

	return (
		<PlansContext.Provider value={value}>{children}</PlansContext.Provider>
	);
}

export function usePlans() {
	const context = useContext(PlansContext);
	if (!context) throw new Error("usePlans must be used within PlansProvider");
	return context;
}
