import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync("server.ts", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");
const firebaseConfig = JSON.parse(fs.readFileSync("firebase.json", "utf8"));
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

test("server does not trust client profile payloads for matchmaking", () => {
  assert.match(server, /socket\.on\(["']join_queue["'], async \(\) =>/);
  assert.match(server, /getFirestore\(\)\.collection\(["']users["']\)/);
});

test("production authentication cannot silently fall back to mock auth", () => {
  assert.match(server, /NODE_ENV !== ["']production["'] && process\.env\.ALLOW_MOCK_AUTH === ["']true["']/);
});

test("WebRTC signaling is bound to an active match session", () => {
  assert.match(server, /matchSessions\.get\(myUid\)/);
  assert.match(server, /data\.sessionId === matchSessions\.get\(myUid\)/);
});

test("Firestore user profiles are restricted to expected fields", () => {
  assert.match(rules, /hasOnly\(\['name', 'age', 'gender', 'interests'\]\)/);
  assert.match(rules, /data\.interests\.size\(\) <= 20/);
});

test("website-only build has no Android/Captacitor dependency path", () => {
  assert.equal(fs.existsSync("android"), false);
  assert.equal(fs.existsSync("capacitor.config.ts"), false);
  assert.equal(packageJson.dependencies?.["@capacitor/android"], undefined);
  assert.equal(packageJson.dependencies?.["@capacitor/cli"], undefined);
  assert.equal(packageJson.dependencies?.["@capacitor/core"], undefined);
});

test("Firebase Hosting has baseline security headers", () => {
  const headers = firebaseConfig.hosting?.headers ?? [];
  const joined = JSON.stringify(headers);
  assert.match(joined, /X-Content-Type-Options/i);
  assert.match(joined, /Referrer-Policy/i);
  assert.match(joined, /Strict-Transport-Security/i);
});

test("server-side chat moderation cannot be bypassed by skipping the client UI", () => {
  assert.match(server, /isBlockedChatMessage\(cleanMsg\)/);
  assert.match(server, /chat_message_blocked/);
});

test("reports are persisted with controlled categories", () => {
  assert.match(server, /allowedCategories = new Set/);
  assert.match(server, /collection\('reports'\)/);
  assert.match(server, /status: "open"/);
});

test("production bundle does not publish the server source map", () => {
  const build = fs.readFileSync("build-server.mjs", "utf8");
  assert.match(build, /sourcemap: false/);
});

test("Firebase App Check integration is explicitly gated", () => {
  assert.match(server, /REQUIRE_APP_CHECK === "true"/);
  assert.match(server, /verifyToken/);
});

test("website includes a browser app manifest", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const manifest = JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));
  assert.match(html, /rel="manifest"/);
  assert.equal(manifest.name, "UmeTV");
  assert.equal(manifest.display, "standalone");
});

test("realtime connection attempts are rate-limited before authentication", () => {
  assert.match(server, /socket_connect/);
  assert.match(server, /rate_limited/);
});
