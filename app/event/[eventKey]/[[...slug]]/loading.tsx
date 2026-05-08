import { HomeHeader } from "../../../HomeHeader";
import { EventShareLoadingShell } from "./EventShareLoadingShell";

export default function EventShareLoading() {
	return (
		<div className="ooo-site-shell">
			<HomeHeader />
			<main
				id="main-content"
				className="container mx-auto px-4 py-8"
				tabIndex={-1}
			>
				<EventShareLoadingShell />
			</main>
		</div>
	);
}
