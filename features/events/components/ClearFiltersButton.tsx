"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ClearFiltersButtonProps = {
	onClick: () => void;
	className?: string;
	children?: ReactNode;
};

export function ClearFiltersButton({
	onClick,
	className,
	children = "Clear",
}: ClearFiltersButtonProps) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={onClick}
			className={cn(
				"h-8 rounded-full border border-dashed border-border/75 bg-muted/25 px-3 text-xs text-muted-foreground hover:bg-muted/45 hover:text-foreground",
				className,
			)}
		>
			{children}
		</Button>
	);
}
