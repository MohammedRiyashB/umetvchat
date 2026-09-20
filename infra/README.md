# UmeTV infrastructure

## Single-instance architecture

UmeTV intentionally runs without Redis and without a TURN server.

```
Browser
  │
  ├── Firebase Auth / Firestore
  │
  └── Socket.IO
        │
     Render Node + Express
        ├── Matchmaking (memory)
        ├── WebRTC signaling
        ├── Chat
        ├── Games (memory)
        └── Moderation APIs
              │
        WebRTC media ↔ browser
```

Socket.IO carries signaling, chat, matchmaking and game actions. WebRTC carries the actual audio/video. The browser uses public STUN servers to discover direct peer-to-peer paths.

## Deployment rule

Run exactly one realtime application instance. Do not scale the Render service horizontally while realtime state is process-local.

## WebRTC limitation

STUN-only WebRTC will not connect every possible network. Some restrictive NAT/firewall combinations can require TURN relay infrastructure. UmeTV currently chooses not to provision TURN; it can be added later if real connection data shows it is necessary.

Firebase remains responsible for authentication, Firestore profiles, moderation data and game statistics.
