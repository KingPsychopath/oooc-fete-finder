"use client";

import { createAdminSession } from "@/features/auth/actions";
import { env } from "@/lib/config/env";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { AuthForm } from "./components/AuthForm";

const basePath = env.NEXT_PUBLIC_BASE_PATH;

export function AdminAuthClient() {
	const router = useRouter();
	const [adminKey, setAdminKey] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [isNavigating, startTransition] = useTransition();

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const sessionResult = await createAdminSession(adminKey);
			if (!sessionResult.success) {
				setError(sessionResult.error || "Invalid admin key");
				return;
			}
			setAdminKey("");
			startTransition(() => {
				router.replace(`${basePath}/admin`);
			});
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Something went wrong",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AuthForm
			onSubmit={handleSubmit}
			isLoading={isLoading || isNavigating}
			error={error}
			adminKey={adminKey}
			setAdminKey={setAdminKey}
		/>
	);
}
