// Helper script to format service account JSON for environment variables
// Usage: node format-service-account.js [path/to/service-account.json]
// If no path provided, will look for service-account.json in current directory

const fs = require("fs");

// Get path from command line or default to service-account.json in current directory
let jsonPath = process.argv[2];

if (!jsonPath) {
	// Try to find service-account.json in current directory
	const defaultPath = "./service-account.json";
	if (fs.existsSync(defaultPath)) {
		jsonPath = defaultPath;
		console.log(`Found service-account.json in current directory`);
	} else {
		console.log(
			"Usage: node format-service-account.js [path/to/service-account.json]",
		);
		console.log("Or place service-account.json in the current directory");
		process.exit(1);
	}
} else if (!fs.existsSync(jsonPath)) {
	console.error(`Error: File not found at ${jsonPath}`);
	process.exit(1);
}

try {
	console.log(`Reading service account file: ${jsonPath}`);
	const jsonContent = fs.readFileSync(jsonPath, "utf8");
	const parsed = JSON.parse(jsonContent);

	// Create compact JSON string with proper escaping for environment variables
	const compactJson = JSON.stringify(parsed);

	console.log("\n✅ Service Account JSON processed successfully!");
	console.log("\n📋 Copy this line to your .env.local file:");
	console.log("─".repeat(80));
	console.log(`GOOGLE_SERVICE_ACCOUNT_KEY=${compactJson}`);
	console.log("─".repeat(80));
	console.log("\n📝 Notes:");
	console.log("• No quotes needed around the JSON value");
	console.log("• The JSON string is compact (no newlines or extra spaces)");
	console.log(
		"• Ready to paste directly into .env.local or Vercel environment variables",
	);
	console.log(
		`• File contains ${Object.keys(parsed).length} keys including project_id: ${parsed.project_id || "unknown"}`,
	);
} catch (error) {
	console.error("❌ Error reading or parsing JSON file:", error.message);
	if (error.message.includes("JSON")) {
		console.error("💡 Make sure the file contains valid JSON");
	}
	process.exit(1);
}
