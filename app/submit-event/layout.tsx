import { HomeHeader } from "../HomeHeader";
import { SubmitEventScrollReset } from "./SubmitEventScrollReset";

export default function SubmitEventLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="ooo-site-shell">
			<SubmitEventScrollReset />
			<HomeHeader />
			{children}
		</div>
	);
}
