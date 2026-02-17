import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

type RouteStateProps = {
	icon?: ReactNode;
	title: string;
	description: string;
	actions?: ReactNode;
	footer?: ReactNode;
	className?: string;
};

export function RouteState({
	icon,
	title,
	description,
	actions,
	footer,
	className,
}: RouteStateProps) {
	return (
		<div className={cn("ooo-site-shell flex min-h-screen items-center justify-center p-4", className)}>
			<Card className="ooo-site-card w-full max-w-lg border">
				<CardHeader className="text-center">
					{icon && <div className="mx-auto mb-4">{icon}</div>}
					<CardTitle className="text-2xl">{title}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6 text-center">
					<p className="text-sm text-muted-foreground">{description}</p>
					{actions}
					{footer && <div className="text-xs text-muted-foreground">{footer}</div>}
				</CardContent>
			</Card>
		</div>
	);
}
