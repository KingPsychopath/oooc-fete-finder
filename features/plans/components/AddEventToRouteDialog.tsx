"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Event } from "@/features/events/types";
import { MAX_PLANS_PER_DATE, type UserPlan } from "@/features/plans/types";
import { cn } from "@/lib/utils";
import { Check, Plus, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const NEW_ROUTE_VALUE = "__new_route__";

const normalizeEventKey = (value: string): string => value.trim().toLowerCase();

const eventIsInPlan = (event: Event, plan: UserPlan): boolean =>
	plan.stops.some(
		(stop) =>
			normalizeEventKey(stop.eventKey) === normalizeEventKey(event.eventKey),
	);

export function AddEventToRouteDialog({
	isOpen,
	event,
	plans,
	suggestedPlanId,
	onClose,
	onAddToRoute,
	onOpenRoute,
}: {
	isOpen: boolean;
	event: Event | null;
	plans: UserPlan[];
	suggestedPlanId?: string | null;
	onClose: () => void;
	onAddToRoute: (event: Event, plan: UserPlan | undefined) => void;
	onOpenRoute?: (plan: UserPlan) => void;
}) {
	const sameDayPlans = useMemo(
		() => (event ? plans.filter((plan) => plan.planDate === event.date) : []),
		[event, plans],
	);
	const canCreateRoute = sameDayPlans.length < MAX_PLANS_PER_DATE;
	const suggestedId =
		suggestedPlanId && sameDayPlans.some((plan) => plan.id === suggestedPlanId)
			? suggestedPlanId
			: (sameDayPlans[0]?.id ?? null);
	const defaultSelection =
		suggestedId ?? (canCreateRoute ? NEW_ROUTE_VALUE : "");
	const [selectedValue, setSelectedValue] = useState(defaultSelection);

	useEffect(() => {
		if (!isOpen) return;
		setSelectedValue(defaultSelection);
	}, [defaultSelection, isOpen]);

	if (!event) return null;

	const selectedPlan = sameDayPlans.find((plan) => plan.id === selectedValue);
	const isNewRouteSelected = selectedValue === NEW_ROUTE_VALUE;
	const selectedAlreadyHasEvent = selectedPlan
		? eventIsInPlan(event, selectedPlan)
		: false;
	const canSubmit = Boolean(
		event.date &&
			selectedValue &&
			(!selectedAlreadyHasEvent || (selectedPlan && onOpenRoute)),
	);

	const submit = () => {
		if (!canSubmit) return;
		if (selectedAlreadyHasEvent && selectedPlan && onOpenRoute) {
			onOpenRoute(selectedPlan);
			onClose();
			return;
		}
		onAddToRoute(event, isNewRouteSelected ? undefined : selectedPlan);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-[min(34rem,calc(100dvw-2rem))] gap-0 overflow-hidden p-0">
				<DialogHeader className="border-b border-border/70 px-5 pt-5 pb-4">
					<DialogTitle className="[font-family:var(--ooo-font-display)] text-2xl leading-tight">
						Add to route
					</DialogTitle>
					<DialogDescription>
						Choose where this stop should go. Your most recent route for the day
						is selected first.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[58dvh] space-y-2 overflow-y-auto px-5 py-4">
					{sameDayPlans.map((plan) => {
						const selected = selectedValue === plan.id;
						const alreadyHasEvent = eventIsInPlan(event, plan);
						return (
							<label
								key={plan.id}
								className={cn(
									"flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-card/80 p-3 transition hover:border-foreground/25 hover:bg-card",
									selected &&
										"border-foreground/30 bg-[linear-gradient(145deg,var(--card),rgba(236,252,243,0.28))] shadow-sm",
								)}
							>
								<input
									type="radio"
									name="route-target"
									value={plan.id}
									checked={selected}
									onChange={() => setSelectedValue(plan.id)}
									className="sr-only"
								/>
								<span
									className={cn(
										"mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground",
										selected && "border-emerald-300 text-emerald-700",
									)}
									aria-hidden="true"
								>
									{selected ? (
										<Check className="h-4 w-4" />
									) : (
										<Route className="h-4 w-4" />
									)}
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex flex-wrap items-center gap-2">
										<span className="truncate font-medium">{plan.title}</span>
										{plan.id === suggestedId && (
											<Badge variant="outline" className="rounded-full">
												Suggested
											</Badge>
										)}
										{alreadyHasEvent && (
											<Badge
												variant="outline"
												className="rounded-full border-emerald-500/25 text-emerald-700 dark:text-emerald-200"
											>
												Already in route
											</Badge>
										)}
									</span>
									<span className="mt-1 block text-sm text-muted-foreground">
										{plan.stops.length} stop{plan.stops.length === 1 ? "" : "s"}
									</span>
								</span>
							</label>
						);
					})}
					{canCreateRoute && (
						<label
							className={cn(
								"flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-border/80 bg-background/70 p-3 transition hover:border-foreground/25 hover:bg-card",
								isNewRouteSelected &&
									"border-foreground/30 bg-[linear-gradient(145deg,var(--card),rgba(239,246,255,0.3))] shadow-sm",
							)}
						>
							<input
								type="radio"
								name="route-target"
								value={NEW_ROUTE_VALUE}
								checked={isNewRouteSelected}
								onChange={() => setSelectedValue(NEW_ROUTE_VALUE)}
								className="sr-only"
							/>
							<span
								className={cn(
									"mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground",
									isNewRouteSelected && "border-sky-300 text-sky-700",
								)}
								aria-hidden="true"
							>
								<Plus className="h-4 w-4" />
							</span>
							<span>
								<span className="font-medium">New route for this day</span>
								<span className="mt-1 block text-sm text-muted-foreground">
									Start a separate route with this event as the first stop.
								</span>
							</span>
						</label>
					)}
					{!canCreateRoute && sameDayPlans.length === 0 && (
						<p className="rounded-xl border border-border/70 bg-muted/35 p-3 text-sm text-muted-foreground">
							This event needs a confirmed date before it can be added to a
							route.
						</p>
					)}
					{!canCreateRoute && sameDayPlans.length >= MAX_PLANS_PER_DATE && (
						<p className="rounded-xl border border-border/70 bg-muted/35 p-3 text-sm text-muted-foreground">
							You have reached the route limit for this day. Choose an existing
							route, or delete one before creating another.
						</p>
					)}
				</div>
				<DialogFooter className="mx-0 mb-0 rounded-none bg-muted/35 px-5 py-4">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="button" onClick={submit} disabled={!canSubmit}>
						{selectedAlreadyHasEvent
							? onOpenRoute
								? "Open selected route"
								: "Already in selected route"
							: isNewRouteSelected
								? "Start route"
								: "Add to selected route"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
