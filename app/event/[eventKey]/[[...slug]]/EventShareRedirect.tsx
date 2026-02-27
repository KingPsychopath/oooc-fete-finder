"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface EventShareRedirectProps {
	targetPath: string;
}

export function EventShareRedirect({ targetPath }: EventShareRedirectProps) {
	const router = useRouter();

	useEffect(() => {
		router.replace(targetPath);
	}, [router, targetPath]);

	return null;
}
