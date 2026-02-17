import { Loader2 } from "lucide-react";

export default function AdminLoading() {
	return (
		<div className="ooo-admin-shell min-h-screen">
			<div className="mx-auto flex min-h-screen max-w-[1960px] items-center justify-center px-4 sm:px-6 lg:px-8">
				<div className="flex items-center gap-3 rounded-full border bg-card/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading admin console...
				</div>
			</div>
		</div>
	);
}
