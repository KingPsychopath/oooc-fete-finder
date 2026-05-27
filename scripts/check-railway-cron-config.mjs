import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const configPath = path.join(process.cwd(), "config/railway-cron-services.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const failures = [];

const fail = (message) => {
	failures.push(message);
	console.error(`x ${message}`);
};

const pass = (message) => {
	console.log(`ok ${message}`);
};

const sameArray = (left, right) =>
	Array.isArray(left) &&
	Array.isArray(right) &&
	left.length === right.length &&
	left.every((value, index) => value === right[index]);

const assertEqual = (actual, expected, label) => {
	if (actual === expected) {
		pass(label);
		return;
	}
	fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const assertArray = (actual, expected, label) => {
	if (sameArray(actual, expected)) {
		pass(label);
		return;
	}
	fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

for (const service of config.services) {
	const routeFile = path.join(
		process.cwd(),
		service.targetPath.replace(/^\/api\//, "app/api/"),
		"route.ts",
	);
	if (existsSync(routeFile)) {
		pass(`${service.name} route exists at ${path.relative(process.cwd(), routeFile)}`);
	} else {
		fail(`${service.name} route missing at ${path.relative(process.cwd(), routeFile)}`);
	}
}

let railwayStatus;
try {
	railwayStatus = JSON.parse(
		execFileSync("railway", ["status", "--json"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}),
	);
} catch (error) {
	fail(
		`railway status --json failed: ${
			error instanceof Error ? error.message : String(error)
		}`,
	);
}

if (railwayStatus) {
	assertEqual(railwayStatus.id, config.projectId, "Railway project id");

	const environment = railwayStatus.environments.edges
		.map((edge) => edge.node)
		.find((candidate) => candidate.name === config.environmentName);

	if (!environment) {
		fail(`Railway environment ${config.environmentName} exists`);
	} else {
		pass(`Railway environment ${config.environmentName} exists`);

		const services = new Map(
			environment.serviceInstances.edges.map((edge) => [
				edge.node.serviceName,
				edge.node,
			]),
		);

		for (const expected of config.services) {
			const actual = services.get(expected.name);
			if (!actual) {
				fail(`${expected.name} service exists`);
				continue;
			}

			const manifest = actual.latestDeployment?.meta?.serviceManifest ?? {};
			assertEqual(actual.source?.repo, config.repo, `${expected.name} repo`);
			assertEqual(
				actual.latestDeployment?.meta?.branch,
				config.branch,
				`${expected.name} branch`,
			);
			assertEqual(
				actual.cronSchedule,
				expected.schedule,
				`${expected.name} cron schedule`,
			);
			assertEqual(
				manifest.build?.buildCommand,
				config.runner.buildCommand,
				`${expected.name} build command`,
			);
			assertEqual(
				actual.startCommand,
				config.runner.startCommand,
				`${expected.name} start command`,
			);
			assertArray(
				manifest.build?.watchPatterns ?? [],
				config.runner.watchPatterns,
				`${expected.name} watch patterns`,
			);
		}
	}
}

if (failures.length > 0) {
	console.error(`\n${failures.length} Railway cron config check(s) failed.`);
	process.exitCode = 1;
} else {
	console.log("\nRailway cron config checks passed.");
}
