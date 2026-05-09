import { HomeHeader } from "../HomeHeader";

export default function SubmitEventLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="ooo-site-shell">
			<HomeHeader />
			{children}
		</div>
	);
}
