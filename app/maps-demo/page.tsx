import { getEvents } from "@/features/data-management/actions";
import { MapsDemoClient } from "./MapsDemoClient";

export default async function MapsDemoPage() {
	const result = await getEvents();
	const initialEvents = result.success && result.data ? result.data : [];
	const initialError =
		!result.success && result.error ? result.error : null;

	return (
		<MapsDemoClient
			initialEvents={initialEvents}
			initialError={initialError}
		/>
	);
}
