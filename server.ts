import crypto from "crypto";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Chess } from "chess.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { CarromState, ChessState, GameState, HandCricketState, TicTacToeState } from './src/components/games/gameTypes';

let firebaseAdminInitialized = false;
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Firebase Admin] FATAL ERROR: Missing Firebase credentials in production.');
      process.exit(1);
    }
    console.warn('[Firebase Admin] Missing Firebase credentials. Firebase Auth will be mocked.');
  } else {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    firebaseAdminInitialized = true;
    console.log('[Firebase Admin] initialized:', projectId);
  }
}


async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  const httpServer = createServer(app);

  // Security Headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com", "https://www.gstatic.com", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'", "wss:", "ws:", "https://*.firebaseio.com", "https://*.googleapis.com", "https://securetoken.googleapis.com", "https://identitytoolkit.googleapis.com", "https://cdn.jsdelivr.net", "https://storage.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com"],
        mediaSrc: ["'self'", "blob:"],
        workerSrc: ["'self'", "blob:", "https://cdn.jsdelivr.net"],
        frameSrc: ["'self'", "https://*.firebaseapp.com"],
        frameAncestors: ["'self'", "https://aistudio.google.com", "https://*.aistudio.google.com", "https://*.google.com"]
      }
    }
  }));

  // Rate Limiting for Express APIs
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limited" }
  });
  app.use("/api/", apiLimiter);
  app.use(express.json({ limit: "1mb" })); // Prevent oversized payloads

  const allowedOrigins = [
    "https://umetvchat.web.app", 
    "https://umetvchat.onrender.com", 
    "http://localhost:3000",
    "http://localhost:5173"
  ];

  app.use(cors({ origin: allowedOrigins, credentials: true }));

  const io = new Server(httpServer, {
    cors: { 
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 15000,
    pingInterval: 10000,
    maxHttpBufferSize: 1e6,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false,
    }
  });
    
  const PORT = Number(process.env.PORT) || 3000;

  // WebRTC matching logic
  interface UserProfile {
    age?: string;
    language?: string;
    interests?: string[];
  }

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  const isValidWebRtcPayload = (value: unknown): value is Record<string, unknown> => {
    if (!isPlainObject(value) || typeof value.sessionId !== "string" || value.sessionId.length > 128) return false;
    if ("sdp" in value) {
      if (!isPlainObject(value.sdp)) return false;
      const type = value.sdp.type;
      const sdp = value.sdp.sdp;
      if (type !== undefined && typeof type !== "string") return false;
      if (sdp !== undefined && (typeof sdp !== "string" || sdp.length > 20000)) return false;
    }
    if ("candidate" in value && value.candidate !== null) {
      if (!isPlainObject(value.candidate)) return false;
      const candidate = value.candidate.candidate;
      if (candidate !== undefined && (typeof candidate !== "string" || candidate.length > 4096)) return false;
      const sdpMid = value.candidate.sdpMid;
      if (sdpMid !== undefined && sdpMid !== null && (typeof sdpMid !== "string" || sdpMid.length > 256)) return false;
      const sdpMLineIndex = value.candidate.sdpMLineIndex;
      if (sdpMLineIndex !== undefined && sdpMLineIndex !== null && typeof sdpMLineIndex !== "number") return false;
    }
    return true;
  };

  const isValidSdpSignal = (value: unknown): value is Record<string, unknown> =>
    isPlainObject(value) &&
    isValidWebRtcPayload(value) &&
    isPlainObject(value.sdp) &&
    typeof value.sdp.type === "string" &&
    ["offer", "answer", "pranswer", "rollback"].includes(value.sdp.type) &&
    typeof value.sdp.sdp === "string" &&
    value.sdp.sdp.length <= 20000;

  const isValidIceSignal = (value: unknown): value is Record<string, unknown> =>
    isPlainObject(value) &&
    isValidWebRtcPayload(value) &&
    isPlainObject(value.candidate);

  const calculateAge = (dobValue: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dobValue)) return null;
    const dob = new Date(`${dobValue}T00:00:00.000Z`);
    if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== dobValue) return null;

    const now = new Date();
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const birthdayPassed =
      now.getUTCMonth() > dob.getUTCMonth() ||
      (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() >= dob.getUTCDate());
    if (!birthdayPassed) age -= 1;
    return age;
  };
  interface UserInQueue {
    userId: string;
    profile: UserProfile | null;
    queuedAt: number;
  }
  let queue: UserInQueue[] = [];
  const users: Record<string, string> = {}; // userId -> partnerUserId
  const matchSessions = new Map<string, string>(); // userId -> active WebRTC match session
  const blockedUsers = new Map<string, Set<string>>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>();
  const onlineUserIds = new Set<string>();
  const MAX_QUEUE_SIZE = 5000;
  const QUEUE_ENTRY_TTL_MS = 10 * 60 * 1000;

  // --- MULTIPLAYER GAME SYSTEM ---
  interface GameSession {
    gameId: string;
    gameType: string;
    player1: string; // userId (Host)
    player2: string; // userId (Guest)
    state: GameState;
    version: number;
    turn: string; // userId whose turn it is
    rematchRequests?: Record<string, boolean>;
    processedActions: Set<string>;
  }
  const games: Record<string, GameSession> = {}; // gameId -> GameSession
  const userGames: Record<string, string> = {}; // userId -> gameId

  // NOTE (Render multi-instance limitation): 
  // Rate limits, matchmaking queues, active games, and connection state are currently stored in-memory.
  // This is perfectly fine for a single-instance Render deployment.
  // However, if the deployment scales to multiple instances, this state will not be shared across instances,
  // causing inconsistent matchmaking, broken games, and ineffective rate limiting. 
  // To support multi-instance scaling, migrate this state to Redis (via Render Redis) or Firestore.
  const globalRateLimits = new Map<string, { count: number, lastReset: number }>();
  const checkRateLimit = (uid: string, action: string, limit: number, windowMs: number = 5000) => {
      const key = uid + '_' + action;
      const now = Date.now();
      let record = globalRateLimits.get(key);
      if (!record) {
          record = { count: 1, lastReset: now };
          globalRateLimits.set(key, record);
          return false;
      }
      if (now - record.lastReset > windowMs) {
          record.count = 1;
          record.lastReset = now;
          return false;
      }
      record.count++;
      return record.count > limit;
  };

  io.use(async (socket, next) => {
    const ipKey = `ip:${socket.handshake.address || "unknown"}`;
    if (checkRateLimit(ipKey, "socket_connect", 30, 60 * 1000)) {
      return next(new Error("rate_limited"));
    }

    const token = socket.handshake.auth.token;
    const appCheckToken = socket.handshake.auth.appCheckToken;
    
    if (!token) {
      return next(new Error("authentication_required"));
    }
    if (process.env.REQUIRE_APP_CHECK === "true" && typeof appCheckToken !== "string") {
      return next(new Error("app_check_required"));
    }

    try {
      if (process.env.REQUIRE_APP_CHECK === "true") {
        await getAppCheck().verifyToken(appCheckToken as string);
      }
      if (firebaseAdminInitialized) {
        const decodedToken = await getAuth().verifyIdToken(token);
        socket.data.userId = decodedToken.uid;
      } else {
        if (process.env.NODE_ENV !== "production" && process.env.ALLOW_MOCK_AUTH === "true") {
          // Mock auth is explicitly development-only.
          socket.data.userId = `mock-user-${socket.id}`;
        } else {
          return next(new Error("firebase_admin_uninitialized"));
        }
      }
      next();
    } catch (error) {
      return next(new Error("invalid_token"));
    }
  });

  interface PendingChallenge {
    challengeId: string;
    challenger: string;
    target: string;
    gameType: string;
    createdAt: number;
  }
  const pendingChallenges = new Map<string, PendingChallenge>(); // challengeId -> PendingChallenge

  setInterval(() => {
    const now = Date.now();
    for (const [id, challenge] of pendingChallenges.entries()) {
      if (now - challenge.createdAt > 5 * 60 * 1000) {
        pendingChallenges.delete(id);
      }
    }
  }, 60 * 1000);

  const ALLOWED_GAMES = ["tictactoe", "chess", "handcricket", "carrom"];

  setInterval(() => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const [key, record] of globalRateLimits.entries()) {
      if (record.lastReset < cutoff) globalRateLimits.delete(key);
    }
  }, 5 * 60 * 1000).unref();
  const BLOCKED_CHAT_TERMS = [
    "onlyfans", "bank account", "credit card", "social security", "ssn",
    "phone number", "cashapp", "venmo", "paypal", "bitcoin", "crypto",
    "porn", "nude", "naked", "sex", "sexual services", "escort", "whore", "bitch",
  ];
  const normalizeChatForModeration = (message: string) =>
    message.toLowerCase().replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  const isBlockedChatMessage = (message: string) => {
    const normalized = normalizeChatForModeration(message);
    return BLOCKED_CHAT_TERMS.some(term => normalized.includes(term));
  };

  io.on("connection", async (socket: Socket) => {
    const myUid = socket.data.userId as string;
    socket.join(myUid);
    onlineUserIds.add(myUid);

    // Initialize block cache if not present
    if (firebaseAdminInitialized && !blockedUsers.has(myUid)) {
       try {
           const blockDoc = await getFirestore().collection('blocks').doc(myUid).get();
           const blocks = blockDoc.exists ? (blockDoc.data()?.blocked || []) : [];
           blockedUsers.set(myUid, new Set(blocks));
       } catch (error) {
           console.error("Failed to load blocks for", myUid, error);
       }
    }

    let turnServers: Record<string, unknown>[] = [];
    try {
       if (process.env.TURN_SERVERS) {
           const parsed = JSON.parse(process.env.TURN_SERVERS);
           if (Array.isArray(parsed)) {
               turnServers = parsed;
           }
       }
    } catch (e) {}

    socket.emit("webrtc_config", {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...turnServers
      ]
    });

    console.log("TOTAL CONNECTED:", io.engine.clientsCount, "User:", myUid);
    io.emit("online_users_count", onlineUserIds.size);

    if (disconnectTimers.has(myUid)) {
      clearTimeout(disconnectTimers.get(myUid)!);
      disconnectTimers.delete(myUid);
      console.log("[IDENTITY] User reconnected, cleared disconnect timer:", myUid);
    }

    const currentPartnerId = users[myUid];
    if (currentPartnerId) {
      console.log("[IDENTITY] Restoring session for:", myUid);
      const gameId = userGames[myUid];
      if (gameId && games[gameId]) {
        const game = games[gameId];
        const role = game.player1 === myUid ? "host" : "guest";
        socket.emit("game_started", { gameId: game.gameId, gameType: game.gameType, role, state: game.state });
        socket.emit("game_sync", { state: game.state, version: game.version, turn: game.turn });
      }
    }

    const cleanupGame = (uid: string) => {
      const gameId = userGames[uid];
      if (gameId) {
        delete userGames[uid];
        const game = games[gameId];
        if (game) {
          const partner = game.player1 === uid ? game.player2 : game.player1;
          delete userGames[partner];
          io.to(partner).emit("game_ended", { reason: "opponent_disconnected" });
          delete games[gameId];
        }
      }
    };

    socket.on("join_queue", async () => {
      console.log("[MATCHMAKING] join_queue received:", myUid);
      if (checkRateLimit(myUid, 'join_queue', 5)) return;

      let profile: UserProfile | null = null;
      if (firebaseAdminInitialized) {
        try {
          const docSnap = await getFirestore().collection("users").doc(myUid).get();
          if (docSnap.exists) {
            profile = docSnap.data() as UserProfile;
          }
        } catch (error) {
          console.error("[PROFILE] Firestore lookup failed:", error);
        }
      } else if (process.env.NODE_ENV !== "production" && process.env.ALLOW_MOCK_AUTH === "true") {
        profile = { age: "1990-01-01", interests: [] };
      }

      if (!profile || typeof profile.age !== "string" || !profile.age) {
          socket.emit("game_error", { message: "Profile with valid Date of Birth is required." });
          return;
      }
      
      const age = calculateAge(profile.age);
      if (age === null) {
          socket.emit("game_error", { message: "Invalid Date of Birth format. Use YYYY-MM-DD." });
          return;
      }
      
      if (age < 18) {
          socket.emit("game_error", { message: "You must be at least 18 years old." });
          return;
      }

      cleanupGame(myUid); 
      const currentPartnerId = users[myUid];
      if (currentPartnerId) {
        cleanupGame(currentPartnerId);
        io.to(currentPartnerId).emit("partner_left");
        delete users[currentPartnerId];
        delete users[myUid];
        matchSessions.delete(currentPartnerId);
        matchSessions.delete(myUid);
      }
        
      const now = Date.now();
      queue = queue.filter(u => now - u.queuedAt <= QUEUE_ENTRY_TTL_MS && u.userId !== myUid);
      if (queue.length >= MAX_QUEUE_SIZE) {
        socket.emit("game_error", { message: "Matchmaking is busy. Please try again shortly." });
        return;
      }
      const interests = Array.isArray(profile.interests)
        ? profile.interests
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim().slice(0, 50))
            .filter(Boolean)
            .slice(0, 20)
        : [];
      profile = { age: profile.age, language: profile.language, interests };
      const myBlocked = blockedUsers.get(myUid) || new Set();

      if (queue.length > 0) {
        let validCandidates = queue.filter(u => {
            const partnerUid = u.userId;
            const partnerBlocked = blockedUsers.get(partnerUid) || new Set();
            return !myBlocked.has(partnerUid) && !partnerBlocked.has(myUid);
        });

        if (validCandidates.length > 0) {
            let bestIndex = -1;
            let maxOverlap = -1;
            const myInterests = (profile && Array.isArray(profile.interests)) ? profile.interests : [];

            for (let i = 0; i < validCandidates.length; i++) {
                const partnerProfile = validCandidates[i].profile;
                const partnerInterests = (partnerProfile && Array.isArray(partnerProfile.interests)) ? partnerProfile.interests : [];
                let overlap = myInterests.filter(x => partnerInterests.includes(x)).length;
                if (overlap > maxOverlap) {
                    maxOverlap = overlap;
                    bestIndex = i;
                }
            }
            
            if (maxOverlap === 0 || myInterests.length === 0) {
                bestIndex = Math.floor(Math.random() * validCandidates.length);
            }

            const selectedCandidate = validCandidates[bestIndex];
            const originalIndex = queue.findIndex(u => u.userId === selectedCandidate.userId);
            const partnerInfo = queue.splice(originalIndex, 1)[0];
            
            const partnerUid = partnerInfo.userId;
            users[myUid] = partnerUid;
            users[partnerUid] = myUid;
            const sessionId = crypto.randomUUID();
            matchSessions.set(myUid, sessionId);
            matchSessions.set(partnerUid, sessionId);

            io.to(partnerUid).emit("matched", { initiator: true, partnerId: myUid, sessionId });
            io.to(myUid).emit("matched", { initiator: false, partnerId: partnerUid, sessionId });
            return;
        }
      }
      
      queue.push({ userId: myUid, profile: profile || null, queuedAt: Date.now() });
      socket.emit("waiting");
    });

    socket.on("webrtc_offer", (data: unknown) => {
      if (!isValidSdpSignal(data) || checkRateLimit(myUid, "webrtc_offer", 20)) return;
      const partnerId = users[myUid];
      if (partnerId && data.sessionId === matchSessions.get(myUid)) io.to(partnerId).emit("webrtc_offer", data);
    });
    socket.on("webrtc_answer", (data: unknown) => {
      if (!isValidSdpSignal(data) || checkRateLimit(myUid, "webrtc_answer", 20)) return;
      const partnerId = users[myUid];
      if (partnerId && data.sessionId === matchSessions.get(myUid)) io.to(partnerId).emit("webrtc_answer", data);
    });
    socket.on("webrtc_ice_candidate", (data: unknown) => {
      if (!isValidIceSignal(data) || checkRateLimit(myUid, "webrtc_ice", 60)) return;
      const partnerId = users[myUid];
      if (partnerId && data.sessionId === matchSessions.get(myUid)) io.to(partnerId).emit("webrtc_ice_candidate", data);
    });
    socket.on("chat_reaction", (reaction: unknown) => {
      const allowedReactions = new Set(["👋", "❤️", "😂", "👍"]);
      if (typeof reaction !== "string" || !allowedReactions.has(reaction)) return;
      const partnerId = users[myUid];
      if (partnerId) io.to(partnerId).emit("chat_reaction", reaction);
    });
    socket.on("chat_message", (rawMsg) => {
       if (checkRateLimit(myUid, 'chat', 10, 5000)) return;
       if (typeof rawMsg !== "string") return;
       const msg = rawMsg.trim();
       if (!msg || msg.length > 500) return;
       const cleanMsg = msg.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
       if (!cleanMsg.trim()) return;
       if (isBlockedChatMessage(cleanMsg)) {
         socket.emit("chat_message_blocked", { reason: "community_rules" });
         return;
       }
       
       const partnerId = users[myUid];
       if (partnerId) {
          io.to(partnerId).emit("chat_message", cleanMsg);
       }
    });

    socket.on("game_challenge", (payload: unknown) => {
      if (checkRateLimit(myUid, 'challenge', 5, 10000) || !isPlainObject(payload)) return;
      const gameType = payload.gameType;
      if (typeof gameType !== "string" || gameType.length > 32 || !ALLOWED_GAMES.includes(gameType)) return;
      const partnerId = users[myUid];
      if (!partnerId) return;
      if (userGames[myUid] || userGames[partnerId]) {
         socket.emit("game_error", { message: "A game is already active." });
         return;
      }
      
      const challengeId = crypto.randomUUID();
      pendingChallenges.set(challengeId, {
        challengeId,
        challenger: myUid,
        target: partnerId,
        gameType,
        createdAt: Date.now()
      });
      
      io.to(partnerId).emit("game_challenge_received", { gameType, challengerId: myUid, challengeId });
    });
    
    socket.on("game_challenge_accept", (payload: unknown) => {
      if (!isPlainObject(payload)) return;
      const { challengerId, gameType, challengeId } = payload;
      if (typeof challengerId !== "string" || typeof gameType !== "string" || typeof challengeId !== "string") return;
      
      const pending = pendingChallenges.get(challengeId);
      if (!pending) return; // Expired or invalid
      if (Date.now() - pending.createdAt > 5 * 60 * 1000) {
         pendingChallenges.delete(challengeId);
         return;
      }
      if (pending.target !== myUid || pending.challenger !== challengerId || pending.gameType !== gameType) return; // Security check
      
      pendingChallenges.delete(challengeId); // Consume challenge
      
      const partnerId = users[myUid];
      if (partnerId !== challengerId) return;
      if (userGames[myUid] || userGames[partnerId]) return;
      
      const gameId = crypto.randomUUID();
      const session: GameSession = {
        gameId,
        gameType: pending.gameType,
        player1: challengerId, // Host
        player2: myUid,    // Guest
        state: initializeGameState(pending.gameType),
        version: 1,
        turn: challengerId,
        processedActions: new Set<string>()
      };
      if (pending.gameType === "handcricket") {
          session.state = { inning: 1, p1Role: "batting", p1Choice: null, p2Choice: null, p1Score: 0, p2Score: 0, target: null, gameOver: false, result: null, round: 1 };
      }
      games[gameId] = session;
      userGames[challengerId] = gameId;
      userGames[myUid] = gameId;
      
      io.to(challengerId).emit("game_started", { gameId, gameType: pending.gameType, role: "host", state: session.state });
      io.to(myUid).emit("game_started", { gameId, gameType: pending.gameType, role: "guest", state: session.state });
    });
    
    socket.on("game_challenge_decline", (payload: unknown) => {
      if (!isPlainObject(payload)) return;
      const { challengerId, challengeId } = payload;
      if (challengeId && typeof challengeId === "string") {
         pendingChallenges.delete(challengeId);
      }
      const partnerId = users[myUid];
      if (partnerId === challengerId) {
        io.to(challengerId).emit("game_challenge_declined");
      }
    });
    socket.on("game_exit", () => {
      cleanupGame(myUid);
    });
    socket.on("game_action", (action: unknown) => {
      if (checkRateLimit(myUid, 'game_action', 20, 1000) || !isGameActionPayload(action)) return;
      const gameId = userGames[myUid];
      if (!gameId) return;
      const game = games[gameId];
      if (!game) return;
      if (action.gameId !== gameId) return;
      if (action.actor !== myUid) return; // Verify actor
      if (game.processedActions.has(action.actionId)) return; // Strict replay protection
      if (action.version !== game.version) {
         socket.emit("game_error", { message: "Stale game state, please wait." });
         return; // Reject stale actions
      }

      try {
        processGameAction(game, myUid, action);
        game.processedActions.add(action.actionId);
        game.version++;
        io.to(game.player1).emit("game_sync", { state: game.state, version: game.version, turn: game.turn });
        io.to(game.player2).emit("game_sync", { state: game.state, version: game.version, turn: game.turn });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Invalid move";
        if (message !== "Waiting for opponent to accept rematch") {
          socket.emit("game_error", { message });
        }
      }
    });
    socket.on("report_user", async (payload: unknown) => {
      if (checkRateLimit(myUid, 'report', 3, 10000)) return;
      const partnerId = users[myUid];
      if (!partnerId) return;

      const allowedCategories = new Set(["nudity", "harassment", "spam", "scam", "other"]);
      const category = isPlainObject(payload) && typeof payload.category === "string" && allowedCategories.has(payload.category)
        ? payload.category
        : "other";
      
      if (!blockedUsers.has(myUid)) blockedUsers.set(myUid, new Set());
      blockedUsers.get(myUid)!.add(partnerId);
      
      if (firebaseAdminInitialized) {
          try {
              const firestore = getFirestore();
              await firestore.collection('blocks').doc(myUid).set({
                  blocked: FieldValue.arrayUnion(partnerId)
              }, { merge: true });
              await firestore.collection('reports').add({
                  reporterId: myUid,
                  reportedUserId: partnerId,
                  category,
                  createdAt: FieldValue.serverTimestamp(),
                  source: "chat_session",
                  status: "open"
              });
          } catch (e) {
              console.error("Failed to persist block for", myUid, e);
          }
      }
      
      io.to(partnerId).emit("partner_left");
      cleanupGame(myUid);
      socket.emit("partner_left");
      delete users[myUid];
      delete users[partnerId];
      matchSessions.delete(myUid);
      matchSessions.delete(partnerId);
    });
    socket.on("leave_chat", () => {
      cleanupGame(myUid);
      queue = queue.filter(u => u.userId !== myUid);
      const partnerId = users[myUid];
      if (partnerId) {
        io.to(partnerId).emit("partner_left");
        delete users[partnerId];
        matchSessions.delete(partnerId);
      }
      delete users[myUid];
      matchSessions.delete(myUid);
    });

    socket.on("disconnect", async () => {
      // Check if user has other active sockets in their room
      const sockets = await io.in(myUid).fetchSockets();
      if (sockets.length > 0) {
        console.log("[IDENTITY] User has other active sockets, not starting disconnect timer:", myUid);
        return;
      }

      console.log("[IDENTITY] User disconnected, starting 15s grace period:", myUid);
      const timer = setTimeout(() => {
        console.log("[IDENTITY] Grace period expired, cleaning up:", myUid);
        cleanupGame(myUid);
        queue = queue.filter(u => u.userId !== myUid);
        blockedUsers.delete(myUid);
        const partnerId = users[myUid];
        if (partnerId) {
          io.to(partnerId).emit("partner_left");
          delete users[partnerId];
          matchSessions.delete(partnerId);
        }
        delete users[myUid];
        matchSessions.delete(myUid);
        disconnectTimers.delete(myUid);
      }, 15000);
      disconnectTimers.set(myUid, timer);
    });
  });

  function initializeGameState(type: string): GameState {
    if (type === "tictactoe") return { board: Array(9).fill(null), winner: null };
    if (type === "chess") return { fen: new Chess().fen(), winner: null };
    if (type === "carrom") return {
      scores: { host: 0, guest: 0 },
      pocketed: { white: 0, black: 0, queen: 0 },
      winner: null,
      activeShotId: null,
      activeShotPlayer: null,
      scoresThisShot: 0,
    };
    if (type === "handcricket") {
      return {
        inning: 1,
        p1Role: "batting",
        p1Choice: null,
        p2Choice: null,
        p1Score: 0,
        p2Score: 0,
        target: null,
        gameOver: false,
        result: null,
        winner: null,
        round: 1,
      };
    }
    throw new Error("Unsupported game type");
  }

  interface GameActionPayload {
    type: string;
    gameId: string;
    actionId: string;
    actor: string;
    version: number;
    index?: number;
    move?: string | { from: string; to: string; promotion?: string };
    choice?: number;
    round?: number;
    label?: "white" | "black" | "queen";
    foul?: boolean;
    shot?: {
      position: { x: number; y: number };
      force: { x: number; y: number };
    };
  }

  const isGameActionPayload = (value: unknown): value is GameActionPayload =>
    isPlainObject(value) &&
    typeof value.type === "string" &&
    typeof value.gameId === "string" &&
    typeof value.actionId === "string" &&
    value.actionId.length <= 128 &&
    typeof value.actor === "string" &&
    typeof value.version === "number" &&
    Number.isInteger(value.version) &&
    value.version >= 1;

  function processGameAction(game: GameSession, playerId: string, action: GameActionPayload) {
    if (action.type === "rematch") {
      const isGameOver =
        Boolean(game.state.winner) ||
        (game.gameType === "handcricket" && (game.state as HandCricketState).gameOver);

      if (!isGameOver) throw new Error("Cannot rematch an active game");

      if (!game.rematchRequests) game.rematchRequests = {};
      game.rematchRequests[playerId] = true;

      if (game.rematchRequests[game.player1] && game.rematchRequests[game.player2]) {
        game.state = initializeGameState(game.gameType);
        game.turn = game.player1;
        game.rematchRequests = {};
      } else {
        throw new Error("Waiting for opponent to accept rematch");
      }
      return;
    }

    if (game.gameType === "tictactoe") {
      const state = game.state as TicTacToeState;
      if (game.turn !== playerId) throw new Error("Not your turn");
      if (state.winner) throw new Error("Game over");
      const { index } = action;
      if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 8) {
        throw new Error("Invalid cell");
      }
      if (state.board[index] !== null) throw new Error("Cell occupied");

      state.board[index] = playerId === game.player1 ? "X" : "O";

      const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (const [a,b,c] of lines) {
        if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
          state.winner = playerId === game.player1 ? "host" : "guest";
          return;
        }
      }
      if (!state.board.includes(null)) state.winner = "draw";
      game.turn = playerId === game.player1 ? game.player2 : game.player1;
      return;
    }

    if (game.gameType === "chess") {
      const state = game.state as ChessState;
      if (game.turn !== playerId) throw new Error("Not your turn");
      if (state.winner) throw new Error("Game over");
      if (typeof action.move !== "object" && typeof action.move !== "string") {
        throw new Error("Invalid move object");
      }

      const chess = new Chess(state.fen);
      try {
        chess.move(action.move);
        state.fen = chess.fen();

        if (chess.isCheckmate()) state.winner = playerId === game.player1 ? "host" : "guest";
        else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) state.winner = "draw";

        game.turn = playerId === game.player1 ? game.player2 : game.player1;
      } catch {
        throw new Error("Invalid move");
      }
      return;
    }

    if (game.gameType === "carrom") {
      const state = game.state as CarromState;
      if (game.turn !== playerId) throw new Error("Not your turn");
      if (state.winner) throw new Error("Game over");

      if (action.type === "shot") {
        const shot = action.shot;
        if (!shot || !isPlainObject(shot.position) || !isPlainObject(shot.force)) {
          throw new Error("Invalid shot");
        }

        const { position, force } = shot;
        const numeric = [position.x, position.y, force.x, force.y].every(
          (value) => typeof value === "number" && Number.isFinite(value)
        );

        if (!numeric ||
            Math.abs(position.x) > 2000 || Math.abs(position.y) > 2000 ||
            Math.abs(force.x) > 100 || Math.abs(force.y) > 100) {
          throw new Error("Invalid shot vector");
        }
        if (state.activeShotId) throw new Error("Shot already active");

        state.activeShotId = action.actionId;
        state.activeShotPlayer = playerId;
        state.scoresThisShot = 0;
        state.lastShot = {
          position: { x: position.x, y: position.y },
          force: { x: force.x, y: force.y },
        };
        return;
      }

      if (action.type === "score") {
        if (state.activeShotPlayer !== playerId || !state.activeShotId) {
          throw new Error("No active shot");
        }
        if (state.scoresThisShot >= 4) throw new Error("Too many scores in one shot");

        const isHost = playerId === game.player1;
        if (action.foul === true) {
          if (isHost) state.scores.host = Math.max(0, state.scores.host - 1);
          else state.scores.guest = Math.max(0, state.scores.guest - 1);
        } else {
          const label = action.label;
          if (!label) throw new Error("Invalid carrom piece");
          const limit = label === "queen" ? 1 : 9;
          if (state.pocketed[label] >= limit) throw new Error("Piece limit reached");

          const totalPocketed = state.pocketed.white + state.pocketed.black + state.pocketed.queen;
          if (totalPocketed >= 19) throw new Error("Board is complete");

          state.pocketed[label] += 1;
          state.scoresThisShot += 1;
          if (isHost) state.scores.host += 1;
          else state.scores.guest += 1;
        }

        if (state.scores.host >= 9) state.winner = "host";
        if (state.scores.guest >= 9) state.winner = "guest";
        return;
      }

      if (action.type === "turn_end") {
        if (state.activeShotPlayer !== playerId || !state.activeShotId) {
          throw new Error("No active shot");
        }
        state.activeShotId = null;
        state.activeShotPlayer = null;
        state.scoresThisShot = 0;
        game.turn = playerId === game.player1 ? game.player2 : game.player1;
        return;
      }

      throw new Error("Invalid carrom action");
    }

    if (game.gameType === "handcricket") {
      const state = game.state as HandCricketState;
      if (state.gameOver) throw new Error("Game over");
      if (typeof action.choice !== "number" || !Number.isInteger(action.choice) || action.choice < 1 || action.choice > 6) {
        throw new Error("Invalid choice. Must be 1-6.");
      }
      if (typeof action.round !== "number" || action.round !== state.round) {
        throw new Error("Invalid round");
      }

      if (playerId === game.player1) {
        if (state.p1Choice !== null) throw new Error("Choice already submitted for this round");
        state.p1Choice = action.choice;
      } else if (playerId === game.player2) {
        if (state.p2Choice !== null) throw new Error("Choice already submitted for this round");
        state.p2Choice = action.choice;
      } else {
        throw new Error("Not a player in this game");
      }

      if (state.p1Choice === null || state.p2Choice === null) return;

      const c1 = state.p1Choice;
      const c2 = state.p2Choice;
      state.lastC1 = c1;
      state.lastC2 = c2;

      const out = c1 === c2;

      if (state.inning === 1) {
        if (out) {
          state.inning = 2;
          state.p1Role = state.p1Role === "batting" ? "bowling" : "batting";
          state.target = (state.p1Role === "batting" ? state.p2Score : state.p1Score) + 1;
        } else if (state.p1Role === "batting") {
          state.p1Score += c1;
        } else {
          state.p2Score += c2;
        }
      } else if (out) {
        state.gameOver = true;
        if (state.p1Score > state.p2Score) state.result = "host";
        else if (state.p2Score > state.p1Score) state.result = "guest";
        else state.result = "draw";
        state.winner = state.result;
      } else {
        if (state.p1Role === "batting") state.p1Score += c1;
        else state.p2Score += c2;

        if (state.target !== null) {
          if (state.p1Role === "batting" && state.p1Score >= state.target) {
            state.gameOver = true;
            state.result = "host";
            state.winner = "host";
          } else if (state.p1Role === "bowling" && state.p2Score >= state.target) {
            state.gameOver = true;
            state.result = "guest";
            state.winner = "guest";
          }
        }
      }

      state.p1Choice = null;
      state.p2Choice = null;
      if (!state.gameOver) state.round++;
      return;
    }

    throw new Error("Unsupported game type");
  }

  app.get("/api/health", (_req, res) => {
    const ready = firebaseAdminInitialized || (process.env.NODE_ENV !== "production" && process.env.ALLOW_MOCK_AUTH === "true");
    res.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "not_ready",
      service: "umetvchat",
      uptimeSeconds: Math.floor(process.uptime()),
      firebaseAdmin: firebaseAdminInitialized,
      connectedSockets: io.engine.clientsCount,
      onlineUsers: onlineUserIds.size,
      queueLength: queue.length,
    });
  });

  app.get("/api/online_users", (_req, res) => res.json({ count: onlineUserIds.size }));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { maxAge: '1y' }));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  
  const shutdown = (signal: string) => {
    console.log(`[SHUTDOWN] Received ${signal}; closing server.`);
    io.close(() => {
      httpServer.close(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer().catch((error) => {
  console.error("[STARTUP] Fatal error:", error);
  process.exit(1);
});
