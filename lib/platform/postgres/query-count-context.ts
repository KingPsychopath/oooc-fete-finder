import "server-only";

import { AsyncLocalStorage } from "async_hooks";

interface QueryCountState {
	count: number;
}

const queryCountStorage = new AsyncLocalStorage<QueryCountState>();

export const withQueryCountTracking = async <T>(
	task: () => Promise<T>,
): Promise<{ result: T; queryCount: number }> => {
	const state: QueryCountState = { count: 0 };
	const result = await queryCountStorage.run(state, task);
	return {
		result,
		queryCount: state.count,
	};
};

export const incrementTrackedQueryCount = (): void => {
	const state = queryCountStorage.getStore();
	if (!state) return;
	state.count += 1;
};
