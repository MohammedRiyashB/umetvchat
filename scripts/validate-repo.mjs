import fs from "node:fs";
import assert from "node:assert/strict";

const required = [
  "server.ts",
  "firestore.rules",
  "SECURITY.md",
  ".github/dependabot.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/web.yml",
  "public/manifest.webmanifest",
  "src/components/Admin.tsx",
  "src/components/Stats.tsx",
  "src/components/Favorites.tsx",
  "src/lib/api.ts",
];

for (const file of required) {
  assert.ok(fs.existsSync(file), `Missing required repository file: ${file}`);
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(typeof packageJson.scripts?.test, "string");
assert.equal(typeof packageJson.scripts?.["security:audit"], "string");
assert.equal(typeof packageJson.scripts?.["validate:repo"], "string");

assert.equal(fs.existsSync("android"), false, "Android application directory must remain removed");
assert.equal(fs.existsSync("capacitor.config.ts"), false, "Capacitor configuration must remain removed");
assert.equal(fs.existsSync(".github/workflows/android.yml"), false, "Android workflow must remain removed");

const rules = fs.readFileSync("firestore.rules", "utf8");
assert.ok(rules.includes("prefer_not_to_say"), "Guest-safe gender option must remain supported");
assert.equal((rules.match(/match \/\{document=\*\*\}/g) || []).length, 1, "Firestore catch-all rule should be singular");

console.log("Repository validation passed.");

const infrastructureFiles = ["docker-compose.infrastructure.yml", "infra/README.md", "render.yaml"];
for (const file of infrastructureFiles) {
  assert.ok(fs.existsSync(file), `Missing infrastructure manifest: ${file}`);
}
const compose = fs.readFileSync("docker-compose.infrastructure.yml", "utf8");
assert.ok(compose.includes("redis:7.4-alpine"), "Redis infrastructure image missing");
assert.ok(compose.includes("coturn/coturn:4.6"), "TURN infrastructure image missing");
assert.ok(compose.includes("49152-49252"), "TURN relay range missing");
const render = fs.readFileSync("render.yaml", "utf8");
for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_PRIVATE_KEY", "TURN_SERVERS", "REDIS_URL", "ADMIN_UIDS"]) {
  assert.ok(render.includes("key: " + key), "Render secret missing: " + key);
}
