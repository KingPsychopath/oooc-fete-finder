import React, { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type OGTestParams = {
	title: string;
	subtitle: string;
	theme: string;
	eventCount: string;
	arrondissement: string;
	localImage: string;
};

export const OGImageTestCard = () => {
	const [params, setParams] = useState<OGTestParams>({
		title: "Fête Finder",
		subtitle: "Interactive Paris Music Events Map",
		theme: "default",
		eventCount: "",
		arrondissement: "",
		localImage: "",
	});
	const [previewUrl, setPreviewUrl] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [isUploading, setIsUploading] = useState(false);
	const [uploadMessage, setUploadMessage] = useState<string>("");

	const generatePreviewUrl = () => {
		const searchParams = new URLSearchParams();

		if (params.title.trim()) searchParams.set("title", params.title.trim());
		if (params.subtitle.trim())
			searchParams.set("subtitle", params.subtitle.trim());
		if (params.theme && params.theme !== "default")
			searchParams.set("theme", params.theme);
		if (params.eventCount && !isNaN(Number(params.eventCount))) {
			searchParams.set("eventCount", params.eventCount);
		}
		if (params.arrondissement.trim())
			searchParams.set("arrondissement", params.arrondissement.trim());
		if (params.localImage) searchParams.set("localImage", params.localImage);

		const query = searchParams.toString();

		// Dynamically detect base path from current URL
		const currentPath =
			typeof window !== "undefined" ? window.location.pathname : "";
		const basePath = currentPath.includes("/fete/") ? "/fete" : "";

		return `${basePath}/api/og${query ? `?${query}` : ""}`;
	};

	const handleGeneratePreview = async () => {
		setIsLoading(true);
		setError("");

		try {
			const url = generatePreviewUrl();

			// Test the endpoint
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(
					`Failed to generate image: ${response.status} ${response.statusText}`,
				);
			}

			// Add timestamp to force reload
			setPreviewUrl(`${url}&t=${Date.now()}`);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to generate preview",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCopyUrl = () => {
		const fullUrl = `${window.location.origin}${generatePreviewUrl()}`;
		navigator.clipboard.writeText(fullUrl);
	};

	const handleImageUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		setIsUploading(true);
		setError("");

		try {
			const formData = new FormData();
			formData.append("image", file);
			formData.append("type", params.theme);

			// Get admin key from localStorage or wherever it's stored
			const adminKey =
				localStorage.getItem("adminKey") || "your-secret-key-123";

			// Dynamically detect base path from current URL
			const currentPath =
				typeof window !== "undefined" ? window.location.pathname : "";
			const basePath = currentPath.includes("/fete/") ? "/fete" : "";

			const response = await fetch(`${basePath}/api/og-upload`, {
				method: "POST",
				headers: {
					"x-admin-key": adminKey,
				},
				body: formData,
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Upload failed");
			}

			const result = await response.json();
			setUploadMessage(`✅ Image uploaded successfully: ${result.filename}`);

			// Automatically set the local image path
			setParams((prev) => ({ ...prev, localImage: result.url }));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setIsUploading(false);
		}
	};

	const presets = [
		{
			name: "Main Site",
			params: {
				title: "Fête Finder",
				subtitle: "Interactive Paris Music Events Map",
				theme: "default",
				eventCount: "55",
				arrondissement: "",
				localImage: "",
			},
		},
		{
			name: "Admin Dashboard",
			params: {
				title: "Admin Dashboard",
				subtitle: "Event Management & Cache Control",
				theme: "admin",
				eventCount: "",
				arrondissement: "",
				localImage: "",
			},
		},
		{
			name: "Montmartre Events",
			params: {
				title: "Events in Montmartre",
				subtitle: "Discover live music during Fête de la Musique 2025",
				theme: "event",
				eventCount: "12",
				arrondissement: "Montmartre",
				localImage: "",
			},
		},
		{
			name: "Custom Event",
			params: {
				title: "Jazz Festival",
				subtitle: "Live Music in Le Marais",
				theme: "event",
				eventCount: "8",
				arrondissement: "Le Marais",
				localImage: "",
			},
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					🎨 OG:Image Testing
				</CardTitle>
				<CardDescription>
					Test and preview Open Graph images for social media sharing
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Presets */}
				<div className="space-y-2">
					<Label className="text-sm font-medium">Quick Presets</Label>
					<div className="flex flex-wrap gap-2">
						{presets.map((preset) => (
							<Button
								key={preset.name}
								variant="outline"
								size="sm"
								onClick={() => setParams(preset.params)}
							>
								{preset.name}
							</Button>
						))}
					</div>
				</div>

				{/* Parameters Form */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="title">Title</Label>
						<Input
							id="title"
							value={params.title}
							onChange={(e) =>
								setParams((prev) => ({ ...prev, title: e.target.value }))
							}
							placeholder="Main title text"
							maxLength={100}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="theme">Theme</Label>
						<Select
							value={params.theme}
							onValueChange={(value) =>
								setParams((prev) => ({ ...prev, theme: value }))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">Default</SelectItem>
								<SelectItem value="event">Event</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
								<SelectItem value="custom">Custom</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="subtitle">Subtitle</Label>
						<Textarea
							id="subtitle"
							value={params.subtitle}
							onChange={(e) =>
								setParams((prev) => ({ ...prev, subtitle: e.target.value }))
							}
							placeholder="Description text"
							maxLength={100}
							rows={2}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="eventCount">Event Count</Label>
						<Input
							id="eventCount"
							type="number"
							value={params.eventCount}
							onChange={(e) =>
								setParams((prev) => ({ ...prev, eventCount: e.target.value }))
							}
							placeholder="Number of events"
							min="0"
							max="9999"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="arrondissement">Arrondissement</Label>
						<Input
							id="arrondissement"
							value={params.arrondissement}
							onChange={(e) =>
								setParams((prev) => ({
									...prev,
									arrondissement: e.target.value,
								}))
							}
							placeholder="Paris district name"
							maxLength={50}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="localImage">Local Image</Label>
						<Input
							id="localImage"
							value={params.localImage}
							onChange={(e) =>
								setParams((prev) => ({ ...prev, localImage: e.target.value }))
							}
							placeholder="/og-images/your-image.jpg"
							maxLength={255}
						/>
						<div className="text-xs text-gray-500">
							Use images from public/og-images/ folder. Path must start with
							/og-images/
						</div>
					</div>

					{/* Upload Local Image Section */}
					<div className="md:col-span-2 space-y-4 p-4 border rounded-lg bg-blue-50">
						<div className="flex items-center gap-2">
							<Label className="text-sm font-medium">
								📁 Upload Local Image
							</Label>
							<Badge variant="secondary">PNG, JPEG, WebP up to 5MB</Badge>
						</div>

						<Input
							type="file"
							accept="image/*"
							onChange={handleImageUpload}
							disabled={isUploading}
						/>

						<div className="text-xs text-gray-600">
							Upload an image to use as background. Theme will be set based on
							current selection.
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="flex flex-col sm:flex-row gap-2">
					<Button
						onClick={handleGeneratePreview}
						disabled={isLoading}
						className="flex-1"
					>
						{isLoading ? "🔄 Generating..." : "🎨 Generate Preview"}
					</Button>

					{previewUrl && (
						<Button variant="outline" onClick={handleCopyUrl}>
							📋 Copy URL
						</Button>
					)}
				</div>

				{/* Generated URL Display */}
				{previewUrl && (
					<div className="space-y-2">
						<Label className="text-sm font-medium">Generated URL</Label>
						<div className="p-2 bg-gray-50 rounded-md text-sm font-mono break-all">
							{`${window.location.origin}${generatePreviewUrl()}`}
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge variant="secondary">1200×630px</Badge>
							<Badge variant="secondary">PNG Format</Badge>
							<Badge variant="secondary">Edge Runtime</Badge>
						</div>
					</div>
				)}

				{/* Error Display */}
				{error && (
					<div className="p-3 rounded-md bg-red-50 text-red-700 border border-red-200">
						<strong>Error:</strong> {error}
					</div>
				)}

				{/* Preview Image */}
				{previewUrl && (
					<div className="space-y-2">
						<Label className="text-sm font-medium">Preview</Label>
						<div className="border rounded-md overflow-hidden">
							<img
								src={previewUrl}
								alt="OG Image Preview"
								className="w-full h-auto"
								style={{ aspectRatio: "1200/630" }}
								onError={() => setError("Failed to load preview image")}
							/>
						</div>
						<div className="text-xs text-gray-500">
							💡 This is how your link will appear when shared on social media
						</div>
					</div>
				)}

				{/* Social Media Testing Links */}
				{previewUrl && (
					<div className="space-y-2">
						<Label className="text-sm font-medium">
							Test on Social Platforms
						</Label>
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									window.open(
										`https://cards-dev.twitter.com/validator`,
										"_blank",
									)
								}
							>
								🐦 Twitter Validator
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									window.open(
										`https://developers.facebook.com/tools/debug/`,
										"_blank",
									)
								}
							>
								📘 Facebook Debugger
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									window.open(
										`https://www.linkedin.com/post-inspector/`,
										"_blank",
									)
								}
							>
								💼 LinkedIn Inspector
							</Button>
						</div>
					</div>
				)}

				{/* Upload Message */}
				{uploadMessage && (
					<div className="p-3 rounded-md bg-green-50 text-green-700 border border-green-200">
						{uploadMessage}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
