"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";

type FilterButtonProps = {
	onClickAction: () => void;
	hasActiveFilters: boolean;
	activeFiltersCount: number;
	className?: string;
	size?: "sm" | "default" | "lg";
	variant?:
		| "outline"
		| "default"
		| "destructive"
		| "secondary"
		| "ghost"
		| "link";
};

export const FilterButton: React.FC<FilterButtonProps> = ({
	onClickAction,
	hasActiveFilters,
	activeFiltersCount,
	className = "",
	size = "sm",
	variant = "outline",
}) => {
	return (
		<Button
			variant={variant}
			size={size}
			onClick={onClickAction}
			className={className}
		>
			<Filter className="h-4 w-4 mr-2" />
			Filters
			{hasActiveFilters && (
				<Badge
					variant="destructive"
					className="ml-2 h-4 w-4 rounded-full p-0 text-xs"
				>
					{activeFiltersCount}
				</Badge>
			)}
		</Button>
	);
};
