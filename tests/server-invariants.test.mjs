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
  assert.match(server, /const matchSessions = new Map<string, string>/);
  assert.match(server, /const getMatchSessionId = async \(uid: string\): Promise<string \| null> => matchSessions\.get\(uid\) \|\| null/);
  assert.match(server, /data\.sessionId === await getMatchSessionId\(myUid\)/);
  assert.match(server, /matchSessions\.set\(myUid, sessionId\)/);
  assert.match(server, /matchSessions\.set\(partnerUid, sessionId\)/);
});

test("Firestore user profiles are restricted to expected fields", () => {
  assert.match(rules, /hasOnly\(\['name', 'age', 'gender', 'interests'\]\)/);
  assert.match(rules, /data\.interests\.size\(\) <= 20/);
});

test("Firestore rules support guest-safe gender choice and have one catch-all", () => {
  assert.ok(rules.includes("data.age.matches('^\\\\d{4}-\\\\d{2}-\\\\d{2}$')"));
  assert.ok(rules.includes("prefer_not_to_say"));
  assert.equal((rules.match(/match \/\{document=\*\*\}/g) || []).length, 1);
});

test("website-only build has no Android/Capacitor dependency path", () => {
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
  assert.match(server, /collection\(["']reports["']\)/);
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

test("guest chat can bootstrap anonymous Firebase auth from the website", () => {
  const home = fs.readFileSync("src/components/Home.tsx", "utf8");
  const chat = fs.readFileSync("src/components/Chat.tsx", "utf8");
  assert.match(home, /signInAnonymously\(auth\)/);
  assert.match(chat, /signInAnonymously\(auth\)/);
  assert.match(home, /no login required/i);
});

test("moderation, favorites and game-stat APIs exist server-side", () => {
  assert.match(server, /\/api\/admin\/reports/);
  assert.match(server, /\/api\/admin\/users\/:uid\/action/);
  assert.match(server, /favorite_user/);
  assert.match(server, /\/api\/me\/favorites/);
  assert.match(server, /\/api\/me\/stats/);
  assert.match(server, /\/api\/leaderboard/);
});

test("production SPA fallback is rate limited", () => {
  assert.match(server, /app\.get\("\/\{\*splat\}", pageLimiter/);
});

test("moderation restrictions are enforced on realtime connections", () => {
  assert.match(server, /getActiveRestriction\(socket\.data\.userId as string\)/);
  assert.match(server, /account_restricted/);
});

test("feature pages are present", () => {
  assert.equal(fs.existsSync("src/components/Admin.tsx"), true);
  assert.equal(fs.existsSync("src/components/Stats.tsx"), true);
  assert.equal(fs.existsSync("src/components/Favorites.tsx"), true);
  assert.equal(fs.existsSync("src/lib/api.ts"), true);
});

test("server tracks operational metrics", () => {
  assert.match(server, /const metrics =/);
  assert.match(server, /metrics\.matches/);
  assert.match(server, /metrics\.messages/);
  assert.match(server, /metrics\.webRtcIce/);
});

test("single-instance realtime architecture has no Redis or TURN dependencies", () => {
  assert.doesNotMatch(server, /redis|REDIS_/i);
  assert.doesNotMatch(server, /TURN_SERVERS|TURN_REALM|TURN_USERNAME|TURN_PASSWORD|TURN_EXTERNAL_IP/);
  assert.doesNotMatch(JSON.stringify(packageJson.dependencies || {}), /redis|socket\.io\/redis-adapter/i);
  assert.match(server, /stun:stun\.l\.google\.com:19302/);
  assert.match(server, /const globalRateLimits = new Map/);
});

test("single-instance infrastructure does not provision Redis or TURN", () => {
  const compose = fs.readFileSync("docker-compose.infrastructure.yml", "utf8");
  const render = fs.readFileSync("render.yaml", "utf8");
  assert.match(compose, /services: \{\}/);
  assert.doesNotMatch(compose, /redis:|turn:|coturn/i);
  assert.doesNotMatch(render, /TURN_SERVERS|REDIS_URL|REDIS_REQUIRED_FOR_MULTI_INSTANCE/);
});
