"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import React from "react";

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
	size = "default",
	variant = "outline",
}) => {
	return (
		<Button
			variant={variant}
			size={size}
			onClick={onClickAction}
			className={`min-h-[44px] ${className}`}
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
