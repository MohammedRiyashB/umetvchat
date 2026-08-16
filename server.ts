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
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com", "https://www.gstatic.com", "https://cdn.jsdelivr.net"],
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
    max: 1000,
    message: "Too many requests, please try again later."
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
    maxHttpBufferSize: 1e6 // 1MB payload limit
  });
    
  const PORT = Number(process.env.PORT) || 3000;

  // WebRTC matching logic
  interface UserProfile {
    language?: string;
    interests?: string[];
  }
  interface UserInQueue {
    userId: string;
    profile: UserProfile | null;
  }
  let queue: UserInQueue[] = [];
  const users: Record<string, string> = {}; // userId -> partnerUserId
  const blockedUsers = new Map<string, Set<string>>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>();

  // --- MULTIPLAYER GAME SYSTEM ---
  interface GameSession {
    gameId: string;
    gameType: string;
    player1: string; // userId (Host)
    player2: string; // userId (Guest)
    state: any;
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
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error("authentication_required"));
    }

    try {
      if (firebaseAdminInitialized) {
        const decodedToken = await getAuth().verifyIdToken(token);
        (socket as any).userId = decodedToken.uid;
      } else {
        if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_AUTH === 'true') {
          // Mock auth if explicitly allowed in dev
          (socket as any).userId = `mock-user-${socket.id}`;
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

  io.on("connection", async (socket: Socket) => {
    const myUid = (socket as any).userId;
    socket.join(myUid);

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

    let turnServers: any[] = [];
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
    io.emit("online_users_count", io.engine.clientsCount);

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

    socket.on("join_queue", async (clientProfile?: any) => {
      console.log("[MATCHMAKING] join_queue received:", myUid);
      if (checkRateLimit(myUid, 'join_queue', 5)) return;

      let profile = clientProfile;
      // Use the profile sent by the authenticated client.
      // Only query Firestore when the client did not provide a profile.
      if (firebaseAdminInitialized && !profile) {
        try {
          const docSnap = await getFirestore().collection('users').doc(myUid).get();
          if (docSnap.exists) {
            profile = docSnap.data();
          }
        } catch (error) {
          console.error("[PROFILE] Firestore lookup failed:", error);
        }
      }

      if (!profile || !profile.age) {
          socket.emit("game_error", { message: "Profile with valid Date of Birth is required." });
          return;
      }
      
      const dob = new Date(profile.age);
      if (isNaN(dob.getTime())) {
          socket.emit("game_error", { message: "Invalid Date of Birth format." });
          return;
      }
      
      if (dob.getTime() > Date.now()) {
          socket.emit("game_error", { message: "Date of Birth cannot be in the future." });
          return;
      }

      const ageDate = new Date(Date.now() - dob.getTime());
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      
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
      }
        
      queue = queue.filter(u => u.userId !== myUid);
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
            
            io.to(partnerUid).emit("matched", { initiator: true, partnerId: myUid, sessionId });
            io.to(myUid).emit("matched", { initiator: false, partnerId: partnerUid, sessionId });
            return;
        }
      }
      
      queue.push({ userId: myUid, profile: profile || null });
      socket.emit("waiting");
    });

    socket.on("webrtc_offer", (data) => {
      if (typeof data !== "object" || !data) return;
      const partnerId = users[myUid];
      if (partnerId) io.to(partnerId).emit("webrtc_offer", data);
    });
    socket.on("webrtc_answer", (data) => {
      if (typeof data !== "object" || !data) return;
      const partnerId = users[myUid];
      if (partnerId) io.to(partnerId).emit("webrtc_answer", data);
    });
    socket.on("webrtc_ice_candidate", (data) => {
      if (typeof data !== "object" || !data) return;
      const partnerId = users[myUid];
      if (partnerId) io.to(partnerId).emit("webrtc_ice_candidate", data);
    });
    socket.on("chat_reaction", (reaction) => {
      if (typeof reaction !== "string" || reaction.length > 50) return;
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
       
       const partnerId = users[myUid];
       if (partnerId) {
          io.to(partnerId).emit("chat_message", cleanMsg);
       }
    });

    socket.on("game_challenge", ({ gameType }) => {
      if (checkRateLimit(myUid, 'challenge', 5, 10000)) return;
      if (typeof gameType !== "string" || !ALLOWED_GAMES.includes(gameType)) return;
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
    
    socket.on("game_challenge_accept", ({ challengerId, gameType, challengeId }) => {
      if (!challengeId || typeof challengeId !== "string") return;
      
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
    
    socket.on("game_challenge_decline", ({ challengerId, challengeId }) => {
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
    socket.on("game_action", (action) => {
      if (checkRateLimit(myUid, 'game_action', 20, 1000)) return;
      const gameId = userGames[myUid];
      if (!gameId) return;
      const game = games[gameId];
      if (!game) return;
      if (!action.gameId || !action.actionId || action.version === undefined || !action.actor) return;
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
      } catch (e: any) {
        if (e.message !== "Waiting for opponent to accept rematch") {
          socket.emit("game_error", { message: e.message || "Invalid move" });
        }
      }
    });
    socket.on("report_user", async () => {
      if (checkRateLimit(myUid, 'report', 3, 10000)) return;
      const partnerId = users[myUid];
      if (!partnerId) return;
      
      if (!blockedUsers.has(myUid)) blockedUsers.set(myUid, new Set());
      blockedUsers.get(myUid)!.add(partnerId);
      
      if (firebaseAdminInitialized) {
          try {
              await getFirestore().collection('blocks').doc(myUid).set({
                  blocked: FieldValue.arrayUnion(partnerId)
              }, { merge: true });
          } catch (e) {
              console.error("Failed to persist block for", myUid, e);
          }
      }
      
      io.to(partnerId).emit("partner_left");
      cleanupGame(myUid);
      socket.emit("partner_left");
      delete users[myUid];
      delete users[partnerId];
    });
    socket.on("leave_chat", () => {
      cleanupGame(myUid);
      queue = queue.filter(u => u.userId !== myUid);
      const partnerId = users[myUid];
      if (partnerId) {
        io.to(partnerId).emit("partner_left");
        delete users[partnerId];
      }
      delete users[myUid];
    });

    socket.on("disconnect", async () => {
      io.emit("online_users_count", io.engine.clientsCount);
      
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
        const partnerId = users[myUid];
        if (partnerId) {
          io.to(partnerId).emit("partner_left");
          delete users[partnerId];
        }
        delete users[myUid];
        disconnectTimers.delete(myUid);
      }, 15000);
      disconnectTimers.set(myUid, timer);
    });
  });

  function initializeGameState(type: string) {
    if (type === "tictactoe") return { board: Array(9).fill(null), winner: null };
    if (type === "chess") return { fen: new Chess().fen(), winner: null };
    if (type === "carrom") return { scores: { host: 0, guest: 0 }, winner: null }; 
    if (type === "handcricket") return { inning: 1, p1Role: "batting", p1Choice: null, p2Choice: null, p1Score: 0, p2Score: 0, target: null, gameOver: false, result: null, round: 1 };
    return {};
  }

  function processGameAction(game: GameSession, playerId: string, action: any) {
    if (action.type === "rematch") {
        let isGameOver = false;
        if (game.gameType === "tictactoe" && (game.state.winner)) isGameOver = true;
        if (game.gameType === "chess" && (game.state.winner)) isGameOver = true;
        if (game.gameType === "carrom" && (game.state.winner)) isGameOver = true;
        if (game.gameType === "handcricket" && (game.state.gameOver)) isGameOver = true;

        if (!isGameOver) throw new Error("Cannot rematch an active game");

        if (!game.rematchRequests) game.rematchRequests = {};
        game.rematchRequests[playerId] = true;

        if (game.rematchRequests[game.player1] && game.rematchRequests[game.player2]) {
            game.state = initializeGameState(game.gameType);
            if (game.gameType === "handcricket") {
               game.state = { inning: 1, p1Role: "batting", p1Choice: null, p2Choice: null, p1Score: 0, p2Score: 0, target: null, gameOver: false, result: null, round: 1 };
            }
            game.turn = game.player1;
            game.rematchRequests = {};
        } else {
            throw new Error("Waiting for opponent to accept rematch"); // Prevent state broadcast until both accept
        }
        return;
    }

    if (game.gameType === "tictactoe") {
       if (game.turn !== playerId) throw new Error("Not your turn");
       if (game.state.winner) throw new Error("Game over");
       const { index } = action;
       if (typeof index !== "number" || index < 0 || index > 8) throw new Error("Invalid cell");
       if (game.state.board[index] !== null) throw new Error("Cell occupied");
       
       game.state.board[index] = playerId === game.player1 ? "X" : "O";
       
       // check win
       const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
       for (const [a,b,c] of lines) {
         if (game.state.board[a] && game.state.board[a] === game.state.board[b] && game.state.board[a] === game.state.board[c]) {
           game.state.winner = playerId === game.player1 ? "host" : "guest";
           return;
         }
       }
       if (!game.state.board.includes(null)) game.state.winner = "draw";
       game.turn = playerId === game.player1 ? game.player2 : game.player1;
    }
    else if (game.gameType === "chess") {
       if (game.turn !== playerId) throw new Error("Not your turn");
       if (game.state.winner) throw new Error("Game over");
       if (typeof action.move !== "object" && typeof action.move !== "string") throw new Error("Invalid move object");
       
       const chess = new Chess(game.state.fen);
       try {
         chess.move(action.move);
         game.state.fen = chess.fen();
         
         if (chess.isCheckmate()) game.state.winner = playerId === game.player1 ? "host" : "guest";
         else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) game.state.winner = "draw";
         
         game.turn = playerId === game.player1 ? game.player2 : game.player1;
       } catch (e) {
         throw new Error("Invalid move");
       }
    }
    else if (game.gameType === "carrom") {
       // SECURITY NOTE: Carrom physics (Matter.js) is currently client-side only.
       // This is a PARTIALLY AUTHORITATIVE implementation hardened to validate scores,
       // but shot vectors, puck pockets, and timings are trusted from the client.
       if (game.turn !== playerId) throw new Error("Not your turn");
       if (game.state.winner) throw new Error("Game over");
       
       if (action.type === "shot") {
          game.state.lastShot = action.shot;
       }
       else if (action.type === "score") {
          const isHost = playerId === game.player1;
          if (action.foul) {
             if (isHost) game.state.scores.host = Math.max(0, game.state.scores.host - 1);
             else game.state.scores.guest = Math.max(0, game.state.scores.guest - 1);
          } else if (['white', 'black', 'queen'].includes(action.label)) {
             // For strict mode, server should maintain puck counts. We do a basic validation here.
             if (isHost) game.state.scores.host += 1;
             else game.state.scores.guest += 1;
          }
          if (game.state.scores.host >= 9) game.state.winner = "host";
          if (game.state.scores.guest >= 9) game.state.winner = "guest";
       }
       else if (action.type === "turn_end") {
          game.turn = playerId === game.player1 ? game.player2 : game.player1;
       }
    }
    else if (game.gameType === "handcricket") {
       if (game.state.gameOver) throw new Error("Game over");
       if (typeof action.choice !== "number" || action.choice < 1 || action.choice > 6) throw new Error("Invalid choice. Must be 1-6.");
       if (typeof action.round !== "number" || action.round !== game.state.round) throw new Error("Invalid round");

       if (playerId === game.player1) {
           if (game.state.p1Choice !== null) throw new Error("Choice already submitted for this round");
           game.state.p1Choice = action.choice;
       }
       if (playerId === game.player2) {
           if (game.state.p2Choice !== null) throw new Error("Choice already submitted for this round");
           game.state.p2Choice = action.choice;
       }

       // If both have chosen
       if (game.state.p1Choice !== null && game.state.p2Choice !== null) {
          const c1 = game.state.p1Choice;
          const c2 = game.state.p2Choice;
          game.state.lastC1 = c1;
          game.state.lastC2 = c2;
          
          let out = c1 === c2;
          
          if (game.state.inning === 1) {
             if (out) {
                game.state.inning = 2;
                game.state.p1Role = game.state.p1Role === "batting" ? "bowling" : "batting";
                game.state.target = (game.state.p1Role === "batting" ? game.state.p2Score : game.state.p1Score) + 1;
             } else {
                if (game.state.p1Role === "batting") game.state.p1Score += c1;
                else game.state.p2Score += c2;
             }
          } else {
             if (out) {
                game.state.gameOver = true;
                // determine winner
                if (game.state.p1Score > game.state.p2Score) game.state.result = "host";
                else if (game.state.p2Score > game.state.p1Score) game.state.result = "guest";
                else game.state.result = "draw";
             } else {
                if (game.state.p1Role === "batting") game.state.p1Score += c1;
                else game.state.p2Score += c2;
                
                // check if target reached
                if (game.state.p1Role === "batting" && game.state.p1Score >= game.state.target) {
                   game.state.gameOver = true;
                   game.state.result = "host";
                } else if (game.state.p1Role === "bowling" && game.state.p2Score >= game.state.target) {
                   game.state.gameOver = true;
                   game.state.result = "guest";
                }
             }
          }
          
          game.state.p1Choice = null;
          game.state.p2Choice = null;
          if (!game.state.gameOver) {
             game.state.round++;
          }
       }
    }
  }

  app.get("/api/online_users", (req, res) => res.json({ count: io.engine.clientsCount }));

  const staticRouteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // limit each IP to 120 requests per minute for static/fallback routes
    standardHeaders: true,
    legacyHeaders: false,
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(staticRouteLimiter, express.static(distPath, { maxAge: '1y' }));
    app.get("*", staticRouteLimiter, (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
