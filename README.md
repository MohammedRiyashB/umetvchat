# UmeTV

<p align="center">
  <img src="https://umetvchat.web.app/logo.png" alt="UmeTV Logo" width="120">
</p>

<h1 align="center">UmeTV</h1>

<p align="center">
  <strong>Meet. Talk. Connect.</strong>
</p>

<p align="center">
  A real-time random video and text chat platform for meeting new people online.
</p>

<p align="center">
  <a href="https://umetvchat.web.app/">Live Website</a> •
  <a href="https://umetvchat.onrender.com/">Backend</a> •
  <a href="https://github.com/MohammedRiyashB/umetvchat">Repository</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/UmeTV-v1.0.0-blue?style=for-the-badge" alt="UmeTV Version">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/WebRTC-Real--Time-orange?style=for-the-badge" alt="WebRTC">
  <img src="https://img.shields.io/badge/Socket.IO-4.8-010101?style=for-the-badge&logo=socket.io" alt="Socket.IO">
</p>

---

## 🌐 Live

**UmeTV:**  
https://umetvchat.web.app/

UmeTV uses Firebase Hosting for the production web application and a Render-hosted Node.js/Socket.IO service for real-time signaling and matchmaking.

---

## ✨ What is UmeTV?

UmeTV is a real-time social communication platform designed to make meeting new people simple.

Users can enter a random video chat, get matched with another available user, and communicate through:

- 🎥 Live video
- 🎙️ Real-time voice
- 💬 Text messaging
- 😀 Reactions
- 🎮 Icebreaker games
- 🔄 Next/skip matching
- 👤 Guest access
- 🔐 Google authentication

The goal is simple:

> **Meet new people. Start a conversation. Discover the world.**

---

## 🚀 Features

### 🎥 Random Video Chat

Connect two users through peer-to-peer WebRTC communication.

### 🎙️ Real-Time Voice

Low-latency browser audio with:

- Echo cancellation
- Noise suppression
- Automatic gain control
- Mono audio optimization
- WebRTC audio transmission

### 💬 Real-Time Text Chat

Send messages instantly through Socket.IO.

### 🔄 Smart Random Matching

The matchmaking server supports:

- Random matching
- Interest matching
- Queue management
- Automatic rematching



### 🎮 Icebreakers

Built-in conversation starters help users avoid awkward first moments.

### 😀 Reactions

Send quick reactions during conversations.

### 🛡️ Safety & Moderation

UmeTV includes platform-level protections such as:

- Message filtering
- Rate limiting
- Report functionality
- Session cleanup
- Automatic disconnect handling
- Community rules
- Privacy and terms pages

### 📱 Responsive Web Experience

Designed for:

- Android browsers
- iPhone browsers
- Tablets
- Desktop browsers
- Laptop browsers
- Modern Chromium, Safari, Firefox and Edge

---

# 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │       UmeTV User     │
                         │  Mobile / Desktop    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Firebase Hosting   │
                         │    React + Vite      │
                         └──────────┬───────────┘
                                    │
                         Socket.IO signaling
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │        Render        │
                         │ Node.js + Express    │
                         │      Socket.IO       │
                         └──────────┬───────────┘
                                    │
                         WebRTC signaling
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
             ┌─────────────┐                 ┌─────────────┐
             │    User A   │◄─── WebRTC ───►│    User B   │
             │ Camera/Mic  │                 │ Camera/Mic  │
             └─────────────┘                 └─────────────┘

                         Firebase Services
                    ┌────────────┬─────────────┐
                    │    Auth    │  Firestore  │
                    └────────────┴─────────────┘


## 🔐 Production hardening

The real-time server validates Firebase ID tokens before accepting Socket.IO connections. Matchmaking reads the authenticated user's profile from Firestore rather than trusting a profile payload sent by the browser, and the client no longer stores or transmits the date of birth for matchmaking.

Socket.IO signaling is rate-limited and bound to an active match session. Chat reactions are allowlisted, game actions are structurally validated, Carrom scoring has server-side turn/piece limits, and the server exposes `/api/health` for platform health checks.

WebRTC uses the configured `TURN_SERVERS` in addition to public STUN servers. A TURN service is recommended for production networks where direct peer-to-peer connectivity fails.

### Deployment notes

- Set `NODE_ENV=production` and provide Firebase Admin credentials through environment variables.
- Keep `ALLOW_MOCK_AUTH=false` (or unset) in production.
- Configure `TURN_SERVERS` with your production TURN provider.
- Set `VITE_FIREBASE_APPCHECK_SITE_KEY` when Firebase App Check is configured for the web app. Set `REQUIRE_APP_CHECK=true` on the backend only after the site key/provider is deployed and verified.
- For production WebRTC reliability, configure `TURN_SERVERS` with a real TURN provider.
- The realtime state is process-local. A multi-instance deployment requires shared state (typically Redis) and a Socket.IO adapter.
- The current matchmaking, presence, game sessions, and rate-limit maps are process-local. Keep the real-time service on a single instance unless a shared-state/Socket.IO Redis adapter is introduced.
- The production target is the website; there is no Android application or Android CI build in this branch.
- Keep the web frontend and real-time backend independently deployable.
