import React from "react";
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
import { DynamicSheetConfig } from "../types";

type DynamicSheetCardProps = {
	dynamicConfig: DynamicSheetConfig;
	adminKey: string;
	isLoading: boolean;
	onSubmit: (e: React.FormEvent) => void;
};

export const DynamicSheetCard = ({
	dynamicConfig,
	adminKey,
	isLoading,
	onSubmit,
}: DynamicSheetCardProps) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle>📊 Dynamic Google Sheet Override</CardTitle>
				<CardDescription>
					Temporarily override the Google Sheet source for testing different
					data
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="mb-4 p-4 bg-muted rounded-lg">
					<h3 className="font-medium mb-2">Current Configuration:</h3>
					<div className="space-y-1 text-sm">
						{dynamicConfig.hasDynamicOverride ? (
							<>
								<p>
									<strong>🔄 Active Override:</strong> {dynamicConfig.sheetId}
								</p>
								<p>
									<strong>Range:</strong> {dynamicConfig.range}
								</p>
								<p className="text-muted-foreground">
									Environment sheet:{" "}
									{dynamicConfig.envSheetId || "Not configured"}
								</p>
							</>
						) : (
							<>
								<p>
									<strong>📝 Using Environment Variable:</strong>{" "}
									{dynamicConfig.envSheetId || "Not configured"}
								</p>
								<p>
									<strong>Range:</strong> {dynamicConfig.envRange}
								</p>
								<p className="text-muted-foreground">
									No dynamic override active
								</p>
							</>
						)}
					</div>
				</div>

				<form onSubmit={onSubmit} className="space-y-4">
					<input type="hidden" name="adminKey" value={adminKey} />

					<div>
						<Label htmlFor="sheetInput">Google Sheet URL or ID:</Label>
						<Input
							type="text"
							name="sheetInput"
							id="sheetInput"
							placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit or just the ID"
							defaultValue={
								dynamicConfig.hasDynamicOverride
									? dynamicConfig.sheetId || ""
									: ""
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Leave empty to clear override and use environment variables
						</p>
					</div>

					<div>
						<Label htmlFor="sheetRange">Sheet Range (optional):</Label>
						<Input
							type="text"
							name="sheetRange"
							id="sheetRange"
							placeholder="A:Z (default)"
							defaultValue={dynamicConfig.range || "A:Z"}
						/>
					</div>

					<div className="flex gap-2">
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "🔄 Setting..." : "🔄 Set Dynamic Sheet"}
						</Button>
					</div>
				</form>

				<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
					<p className="text-sm text-blue-800">
						<strong>💡 How it works:</strong> This temporarily overrides the
						Google Sheet ID from your environment variables. Changes are stored
						in memory and will reset when the server restarts. Perfect for
						testing different sheets!
					</p>
				</div>
			</CardContent>
		</Card>
	);
};
