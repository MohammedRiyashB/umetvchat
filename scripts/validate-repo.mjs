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

console.log("Repository validation passed.");
