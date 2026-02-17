"use client";

import { createAdminSession } from "@/features/auth/actions";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { AuthForm } from "./components/AuthForm";

export function AdminAuthClient() {
	const router = useRouter();
	const [adminKey, setAdminKey] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

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
			router.refresh();
		} catch (submitError) {
			setError(
				submitError instanceof Error ?
					submitError.message
				:	"Something went wrong",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AuthForm
			onSubmit={handleSubmit}
			isLoading={isLoading}
			error={error}
			adminKey={adminKey}
			setAdminKey={setAdminKey}
		/>
	);
}
