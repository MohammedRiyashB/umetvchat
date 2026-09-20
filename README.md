# UmeTV

<p align="center"><img src="https://umetvchat.web.app/logo.png" alt="UmeTV Logo" width="120"></p>

<h1 align="center">UmeTV</h1>
<p align="center"><strong>Meet. Talk. Connect.</strong></p>

A real-time random video and text chat platform for meeting new people online.

## 🌐 Production website

https://umetvchat.web.app/

The current branch is **website-first**. Android/Capacitor configuration is intentionally removed.

## ✨ Features

- 🎥 Random WebRTC video chat
- 🎙️ Voice chat with browser echo/noise controls
- 💬 Real-time text chat and reactions
- 👤 **Instant guest mode — no login or signup UI required**
- 🔞 Server-side 18+ age gate before matchmaking
- 🧠 Interest-based matchmaking
- 🔄 Next/skip and automatic reconnect handling
- ⭐ Favorites
- 🎮 Tic-Tac-Toe, Chess, Hand Cricket and Carrom
- 🏆 Server-recorded game stats, points, achievements and leaderboard
- 📶 Network-quality indicator
- 📉 Low-bandwidth video mode
- 🔔 Optional browser message notifications
- 🚩 Reporting and blocking
- 🛡️ Moderator console with warn/suspend/ban/unban actions
- 🚫 Server-enforced moderation restrictions
- 🔐 Firebase Auth + optional App Check
- 🧪 Security regression tests, dependency audit, TypeScript and production build CI

## 👤 Guest mode

Users can start from the main **Start Chatting** button without creating an email/password or Google account. UmeTV creates a Firebase anonymous session behind the scenes so the realtime service still has a stable, revocable identity for abuse prevention, matchmaking blocks, favorites and game statistics.

A valid date of birth is still required and the realtime server checks the declared age before matchmaking. The date of birth is stored in the protected profile document and is not cached in browser localStorage.

## 🛡️ Safety and moderation

The realtime server validates authenticated sessions, filters disallowed chat content, rate-limits actions, binds WebRTC signaling to the active match session, stores reports, supports blocking, and can enforce moderator bans/suspensions.

Set `ADMIN_UIDS` or use Firebase custom claims `admin=true` / `moderator=true` to access `/admin`.

## 🎮 Games and rankings

The four multiplayer games use server-side state validation. Completed games can update `gameStats`, including wins, losses, draws, points and win streaks. The public leaderboard is exposed at `/stats`.

Carrom currently validates shot vectors, turn ownership, score counts and piece limits server-side. Full deterministic server-side Matter.js physics remains a future anti-cheat hardening step because the browser still performs the visual simulation.

## 📶 Video reliability

Configure `TURN_SERVERS` with a real production TURN provider. The browser uses STUN first and TURN fallback when configured. The UI exposes connection quality and a low-bandwidth mode.

## 🚀 Deployment phases

### Phase 1 — Security
- Token validation
- App Check support
- Input validation
- Rate limiting
- WebRTC session binding
- Server-side chat moderation
- Report/block persistence
- Moderator enforcement

### Phase 2 — Trust and safety
- Reports
- Moderator console
- Warning/suspension/ban workflow
- Audit records
- Duplicate-report throttling

### Phase 3 — WebRTC quality
- Reconnect handling
- TURN configuration
- Connection quality indicator
- Low-bandwidth mode
- Adaptive bitrate controls
- Browser notification support

### Phase 4 — Games
- Typed state contracts
- Server-side move validation
- Replay protection
- Game statistics
- Achievements
- Leaderboard
- Rematch lifecycle

### Phase 5 — Performance
- Lazy-loaded game modules
- Controlled media bitrate
- 15-second presence polling
- Static asset caching
- Mobile browser resource cleanup

### Phase 6 — Production scale
- Redis shared state
- Socket.IO Redis adapter
- Shared matchmaking/presence/rate limits
- Multi-instance realtime deployment

### Phase 7 — Observability and automation
- Health/readiness endpoint
- Structured logs
- Operational metrics
- TURN/network quality monitoring
- Expanded E2E coverage

Infrastructure-dependent items such as a real TURN provider, Redis service, Firebase App Check provider configuration, and moderator claims must be configured in their respective production systems; the repository includes the application hooks and safe defaults but does not provision those external services.

## 🏗️ Architecture

```
Web browser
   │
   ├── Firebase Auth / Firestore
   │
   └── Socket.IO
         │
     Node + Express
         ├── Matchmaking
         ├── WebRTC signaling
         ├── Chat moderation
         ├── Game authority
         └── Moderator API
```

For horizontal scaling, place shared Redis state between the realtime instances and add a Socket.IO Redis adapter before running more than one realtime process.
