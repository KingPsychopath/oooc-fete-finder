import { FeatureEventHeader } from "./FeatureEventHeader";

export default function FeatureEventLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="ooo-site-shell">
			<FeatureEventHeader />
			{children}
		</div>
	);
}
