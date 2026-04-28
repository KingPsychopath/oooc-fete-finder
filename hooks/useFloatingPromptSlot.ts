"use client";

import { useEffect, useState } from "react";

type PromptRegistration = {
	id: string;
	priority: number;
	requestedAt: number;
};

const promptRegistrations = new Map<string, PromptRegistration>();
const listeners = new Set<() => void>();

function notifyListeners(): void {
	for (const listener of listeners) {
		listener();
	}
}

function getActivePromptId(): string | null {
	const registrations = Array.from(promptRegistrations.values());
	if (registrations.length === 0) return null;

	registrations.sort((left, right) => {
		if (left.priority !== right.priority) {
			return right.priority - left.priority;
		}
		return left.requestedAt - right.requestedAt;
	});

	return registrations[0]?.id ?? null;
}

export function useFloatingPromptSlot(
	id: string,
	isRequestingSlot: boolean,
	priority: number,
): boolean {
	const [activePromptId, setActivePromptId] = useState<string | null>(() =>
		getActivePromptId(),
	);

	useEffect(() => {
		const listener = () => setActivePromptId(getActivePromptId());
		listeners.add(listener);
		listener();

		return () => {
			listeners.delete(listener);
		};
	}, []);

	useEffect(() => {
		if (!isRequestingSlot) {
			if (promptRegistrations.delete(id)) {
				notifyListeners();
			}
			return;
		}

		if (!promptRegistrations.has(id)) {
			promptRegistrations.set(id, {
				id,
				priority,
				requestedAt: Date.now(),
			});
			notifyListeners();
			return;
		}

		const current = promptRegistrations.get(id);
		if (current && current.priority !== priority) {
			promptRegistrations.set(id, {
				...current,
				priority,
			});
			notifyListeners();
		}

		return () => {
			if (promptRegistrations.delete(id)) {
				notifyListeners();
			}
		};
	}, [id, isRequestingSlot, priority]);

	return activePromptId === id;
}
