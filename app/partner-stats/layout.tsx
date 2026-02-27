import { FeatureEventHeader } from "../feature-event/FeatureEventHeader";

export default function PartnerStatsLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="ooo-site-shell">
			<FeatureEventHeader />
			{children}
		</div>
	);
}
