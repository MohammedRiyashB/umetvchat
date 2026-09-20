import { v4 as uuidv4 } from "uuid";
import React, { useEffect, useRef, useState } from 'react';
import { appCheck, auth } from "../lib/firebase";
import { getToken as getAppCheckToken } from "firebase/app-check";
import { io, Socket } from 'socket.io-client';
import { Send, Video, VideoOff, Minimize2, Maximize2, Mic, MicOff, Play, Square, SkipForward, AlertTriangle, MessageSquare, Smile, Gamepad2 } from 'lucide-react';
import Banner320x50Ad from './ads/Banner320x50Ad';
import GameSelector from './games/GameSelector';
import GamePanel from './games/GamePanel';
import type { GameAction, GameState, GameSyncEvent } from './games/gameTypes';
import SEO from "./SEO";
import GestureTutorialOverlay from "./GestureTutorialOverlay";



import { useHandGesture } from "../hooks/useHandGesture";

let ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
};

type WebRtcConfig = RTCConfiguration;
type GameStartedPayload = {
  gameId: string;
  gameType: string;
  role: 'host' | 'guest';
  state?: GameState;
};
type GameSyncPayload = {
  state: GameState;
  version: number;
  turn: string;
};
type GameErrorPayload = { message?: string };
type GameActionPayload = Record<string, unknown>;

type AppState = 'IDLE' | 'WAITING' | 'CONNECTED';

interface Message {
  gameType?: string;
  id: string;
  sender: 'me' | 'partner' | 'system';
  text: string;
  isGameChallenge?: boolean;
  gameId?: string;
  challengeId?: string;
  gameStatus?: 'pending' | 'accepted' | 'declined';
}

interface ChatProps {
  onBack: () => void;
}

export default function Chat({ onBack }: ChatProps) {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  
  const [showGameSelector, setShowGameSelector] = useState(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [gameVersion, setGameVersion] = useState<number>(0);
  const [gameRole, setGameRole] = useState<'host' | 'guest' | null>(null);
  const [incomingGameEvent, setIncomingGameEvent] = useState<GameSyncEvent | null>(null);
  const [hasVideo, setHasVideo] = useState(true);
  const [hasAudio, setHasAudio] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [isLocalVideoMinimized, setIsLocalVideoMinimized] = useState(false);


  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const [showReactions, setShowReactions] = useState(false);
  const [remoteReaction, setRemoteReaction] = useState<{emoji: string, id: number} | null>(null);
  const [localReaction, setLocalReaction] = useState<{emoji: string, id: number} | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const prevAppState = useRef<AppState>('IDLE');
  const candidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const actionLockRef = useRef(false);
  const sessionIdRef = useRef('');
  const partnerIdRef = useRef<string | null>(null);
  const { recognizedAction } = useHandGesture(
    localVideoRef,
    () => nextChat(),
    appState !== "IDLE"
  );

  useEffect(() => {
    prevAppState.current = appState;
  }, [appState]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);



  useEffect(() => {
    let isMounted = true;
    
    let clientId = localStorage.getItem('umetv_client_id');
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem('umetv_client_id', clientId);
    }

    const setupSocket = async () => {
      const user = await new Promise<typeof auth.currentUser>(resolve => {
        if (auth.currentUser) {
          resolve(auth.currentUser);
          return;
        }

        const unsub = auth.onAuthStateChanged(currentUser => {
          unsub();
          resolve(currentUser);
        });
      });

      if (!isMounted) return;

      if (!user) {
        console.error("[UmeTV Auth] No authenticated Firebase user");
        addSystemMessage("Please sign in before starting random chat.");
        return;
      }

      let token: string;
      let appCheckToken: string | undefined;
      try {
        token = await user.getIdToken(true);
        if (appCheck) {
          appCheckToken = (await getAppCheckToken(appCheck, false)).token;
        }
        console.log("[UmeTV Auth] Firebase ID token obtained");
      } catch (error) {
        if (!isMounted) return;
        console.error("[UmeTV Auth] Failed to get Firebase ID token:", error);
        addSystemMessage("Authentication failed. Please try again.");
        return;
      }
      
      if (!isMounted) return;

      const socket = io(import.meta.env.VITE_SOCKET_URL || "", {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        auth: { token, appCheckToken },
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 10000
      });
      socketRef.current = socket;

      const joinQueue = () => {
        if (!socketRef.current) return;
        socketRef.current.emit('join_queue');
      };

      socket.on('connect_error', async (error) => {
        console.error('[UmeTV Socket] connect_error:', error.message);
        if (error.message === "invalid_token" || error.message === "authentication_required" || error.message === "app_check_required") {
            if (auth.currentUser) {
                try {
                    const refreshedAuth: { token: string; appCheckToken?: string } = {
                      token: await auth.currentUser.getIdToken(true),
                    };
                    if (appCheck) {
                      refreshedAuth.appCheckToken = (await getAppCheckToken(appCheck, true)).token;
                    }
                    socket.auth = refreshedAuth;
                    socket.connect();
                    return;
                } catch (e) {
                    console.error("Token refresh failed", e);
                }
            }
        }
        addSystemMessage(`Connection error: ${error.message}`);
      });

      socket.on('disconnect', (reason) => {
        console.warn('[UmeTV Socket] disconnected:', reason);
      });
      
      socket.on('webrtc_config', (data: RTCConfiguration) => {
        if (Array.isArray(data.iceServers)) ICE_SERVERS = data;
      });

      socket.on('connect', () => {
        console.log('[UmeTV Socket] connected:', socket.id);

        // Socket connection does not start matchmaking.
        // Matchmaking starts only from Start Chatting.
        console.log('[UmeTV Socket] ready for matchmaking');
      });

      socket.on('waiting', () => {
        setAppState('WAITING');
        addSystemMessage('Waiting for a stranger...');
      });

      socket.on('matched', async (data: { initiator: boolean; partnerId: string; sessionId?: string }) => {
        if (data.sessionId) sessionIdRef.current = data.sessionId;
        if (data.partnerId) partnerIdRef.current = data.partnerId;
        setAppState('CONNECTED');
        setMessages([]);
        addSystemMessage("You're now chatting with a random stranger. Say hi!");
        await setupPeerConnection(data.initiator, data.partnerId);
      });

      socket.on('partner_left', () => {
        setAppState('IDLE');
        addSystemMessage('Stranger has disconnected.');
        cleanupPeerConnection();
        setActiveGame(null);
      });

      socket.on('webrtc_offer', async (data: { sessionId: string; sdp?: RTCSessionDescriptionInit }) => {
        if (!data || data.sessionId !== sessionIdRef.current) return;
        const offer = data.sdp || data;
        if (!pcRef.current) await setupPeerConnection(false);
        try {
            if (pcRef.current) {
                await pcRef.current.setRemoteDescription(offer);
                candidateBufferRef.current.forEach(c => pcRef.current?.addIceCandidate(c).catch(()=>{}));
                candidateBufferRef.current = [];
                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);
                socketRef.current?.emit('webrtc_answer', { sdp: answer, sessionId: sessionIdRef.current });
            }
        } catch (err) {
            console.error("webrtc_offer error", err);
        }
      });

      socket.on('webrtc_answer', async (data: { sessionId: string; sdp?: RTCSessionDescriptionInit }) => {
        if (!data || data.sessionId !== sessionIdRef.current) return;
        const answer = data.sdp || data;
        try {
            if (pcRef.current) {
                await pcRef.current.setRemoteDescription(answer);
                candidateBufferRef.current.forEach(c => pcRef.current?.addIceCandidate(c).catch(()=>{}));
                candidateBufferRef.current = [];
            }
        } catch (err) {
            console.error("webrtc_answer error", err);
        }
      });

      socket.on('webrtc_ice_candidate', async (data: { sessionId: string; candidate?: RTCIceCandidateInit }) => {
        if (!data) return;
        const candidate = data.candidate || data;
        const sessionId = data.sessionId;
        if (sessionId !== sessionIdRef.current) return;
        try {
            if (pcRef.current) {
                if (pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
                    await pcRef.current.addIceCandidate(candidate);
                } else {
                    candidateBufferRef.current.push(candidate);
                }
            }
        } catch (err) {
            console.error("webrtc_ice_candidate error", err);
        }
      });

      socket.on('chat_message', (msg: unknown) => {
        if (typeof msg !== 'string' || msg.length > 500) return;
        setMessages(prev => [...prev, { text: msg, sender: 'partner', timestamp: new Date() }]);
      });

      socket.on('chat_message_blocked', () => {
        setToastMessage('Message blocked by UmeTV community rules.');
        setTimeout(() => setToastMessage(''), 3000);
      });

      socket.on('chat_reaction', (reaction: string) => {
        setRemoteReaction({ emoji: reaction, id: Date.now() });
      });

      socket.on('game_challenge_received', (data: { gameType: string, challengerId: string, challengeId: string }) => {
        setMessages(prev => [...prev, {
            id: uuidv4(),
            sender: 'system',
            text: `Stranger challenged you to a game of ${data.gameType}.`,
            isGameChallenge: true,
            gameType: data.gameType,
            gameId: data.challengerId,
            challengeId: data.challengeId,
            gameStatus: 'pending'
        }]);
      });

      socket.on('game_challenge_declined', () => {
        addSystemMessage('Stranger declined your game invitation.');
      });

      socket.on('game_started', (payload: GameStartedPayload) => {
        setActiveGameId(payload.gameId);
        setActiveGame(payload.gameType);
        setGameRole(payload.role);
        setGameVersion(1);
        addSystemMessage(`Started playing ${payload.gameType}. Have fun!`);
      });

      socket.on('game_sync', (payload: GameSyncPayload) => {
        const isMyTurn = payload.turn === auth.currentUser?.uid;
        setGameVersion(payload.version);
        setIncomingGameEvent({ type: 'sync', state: payload.state, isMyTurn });
      });

      socket.on('game_error', (data: GameErrorPayload) => {
        addSystemMessage(`Game error: ${data.message}`);
      });

      socket.on('game_ended', () => {
        addSystemMessage('Game ended.');
        setActiveGame(null);
        setGameRole(null);
      });
      socket.connect();
    };

    setupSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) socketRef.current.disconnect();
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

    useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (!user) {
        if (appState !== 'IDLE') {
           stopChat();
           addSystemMessage('You have been signed out.');
        }
      }
    });
    return () => unsub();
  }, [appState]);

  useEffect(() => {
    let active = true;
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, 
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } 
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.warn('Play error:', e));
        }
      } catch (err) {
        console.error("Error accessing media devices.", err);
        if (active) {
          setMediaError(true);
          addSystemMessage('Could not access camera/microphone. Please ensure permissions are allowed. If you are in the AI Studio preview, try opening the app in a new tab using the button in the top right corner.');
        }
      }
    };
    initMedia();

    return () => {
      active = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, []);





  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, { id: uuidv4(), sender: 'system', text }]);
  };

    const waitForMedia = async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current;
    if (mediaError) return null; // Already failed
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (localStreamRef.current) {
          clearInterval(interval);
          resolve(localStreamRef.current);
        } else if (mediaError) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
      setTimeout(() => {
         clearInterval(interval);
         resolve(null);
      }, 5000);
    });
  };

  const setupPeerConnection = async (initiator: boolean, partnerId?: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    let disconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let restartTimeout: ReturnType<typeof setTimeout> | undefined;
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'disconnected') {
        // Transient disconnect, give it a grace period to recover
        console.warn('WebRTC ICE Connection transient disconnect. Waiting 5s for recovery...');
        disconnectTimeout = setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
             console.warn('WebRTC ICE did not recover. Terminating.');
             stopChat();
          }
        }, 5000);
      } else if (state === 'connected' || state === 'completed') {
        if (disconnectTimeout) clearTimeout(disconnectTimeout);
        if (restartTimeout) clearTimeout(restartTimeout);
      } else if (state === 'failed') {
        console.warn('WebRTC ICE Connection failed. Triggering ICE restart...');
        if (!restartTimeout) {
            restartTimeout = setTimeout(() => {
                if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                    console.warn('WebRTC ICE Restart failed. Terminating.');
                    stopChat();
                }
            }, 10000);
            
            const myUid = auth.currentUser?.uid || "";
            const isDesignatedRestarter = partnerIdRef.current ? myUid > partnerIdRef.current : initiator;

            if (isDesignatedRestarter) {
                pc.restartIce();
                pc.createOffer().then(offer => {
                    return pc.setLocalDescription(offer);
                }).then(() => {
                    if (socketRef.current) {
                        socketRef.current.emit('webrtc_offer', { sdp: pc.localDescription, sessionId: sessionIdRef.current });
                    }
                }).catch(err => console.error("ICE restart error:", err));
            }
        }
      } else if (state === 'closed') {
         if (disconnectTimeout) clearTimeout(disconnectTimeout);
         if (restartTimeout) clearTimeout(restartTimeout);
      }
    };

    const stream = await waitForMedia();
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    const audioSender = pc.getSenders().find(sender => sender.track?.kind === "audio");
    if (audioSender) {
      try {
        const parameters = audioSender.getParameters();
        parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
        parameters.encodings[0].maxBitrate = 64000;
        await audioSender.setParameters(parameters);
      } catch (e) {
        console.warn('Could not set audio bitrate limit', e);
      }
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', { candidate: event.candidate, sessionId: sessionIdRef.current });
      }
    };

    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socketRef.current) {
          socketRef.current.emit('webrtc_offer', { sdp: offer, sessionId: sessionIdRef.current });
        }
      } catch(err) {
        console.error("Failed to create offer", err);
      }
    }
  };

  const cleanupPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    candidateBufferRef.current = [];
  };

  const startChat = async () => {
    if (actionLockRef.current) return;

    const socket = socketRef.current;
    if (!socket) {
      console.error("[UmeTV Chat] Socket is not initialized");
      addSystemMessage("Connection is not ready. Please try again.");
      return;
    }

    actionLockRef.current = true;
    setTimeout(() => {
      actionLockRef.current = false;
    }, 500);

    try {
      // Make sure Socket.IO is connected before entering matchmaking.
      if (!socket.connected) {
        console.log("[UmeTV Chat] Socket not connected. Connecting...");

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Socket connection timeout"));
          }, 10000);

          const onConnect = () => {
            cleanup();
            resolve();
          };

          const onError = (error: Error) => {
            cleanup();
            reject(error);
          };

          const cleanup = () => {
            clearTimeout(timeout);
            socket.off("connect", onConnect);
            socket.off("connect_error", onError);
          };

          socket.once("connect", onConnect);
          socket.once("connect_error", onError);

          socket.connect();
        });
      }

      if (!socket.connected) {
        throw new Error("Socket is still disconnected");
      }

      setAppState("WAITING");
      setMessages([]);

      const user = auth.currentUser;
      if (!user) {
        addSystemMessage("Please sign in first.");
        return;
      }
      
      console.log("[UmeTV Chat] Joining matchmaking queue");
      socket.emit("join_queue");

    } catch (error) {
      console.error("[UmeTV Chat] Failed to start chat:", error);
      setAppState("IDLE");
      addSystemMessage("Unable to connect. Please try again.");
    }
  };

  const stopChat = () => {
    if (!socketRef.current) return;
    if (appState === 'IDLE') return;
    setActiveGame(null);
    setGameRole(null);
    socketRef.current.emit('leave_chat');
    cleanupPeerConnection();
    setAppState('IDLE');
    addSystemMessage('You disconnected.');
  };

  const reportUser = () => {
    if (!socketRef.current || appState !== 'CONNECTED') return;
    const category = window.prompt(
      "Why are you reporting this user? Enter: nudity, harassment, spam, scam, or other.",
      "other"
    )?.trim().toLowerCase();

    const allowedCategories = new Set(["nudity", "harassment", "spam", "scam", "other"]);
    const safeCategory = category && allowedCategories.has(category) ? category : "other";

    socketRef.current.emit('report_user', { category: safeCategory });
    socketRef.current.emit('leave_chat');
    cleanupPeerConnection();
    setAppState('IDLE');
    setToastMessage('User reported and blocked. The session was closed.');
    setTimeout(() => setToastMessage(''), 4000);
    addSystemMessage('You have reported and blocked the stranger for misconduct. The session has been disconnected.');
  };

  const nextChat = () => {
    if (actionLockRef.current) return;
    stopChat();
    startChat();
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socketRef.current) return;

    const text = inputText.trim();
    const lowerText = text.toLowerCase();
    const bannedWords = [
      'spam', 'buy', 'sell', 'subscribe', 'nude', 'sex', 'naked', 'porn',
      'address', 'phone number', 'social security', 'ssn', 'bank account',
      'credit card', 'racist', 'hate', 'kill', 'suicide', 'fuck', 'bitch', 'whore',
      'onlyfans', 'cashapp', 'venmo', 'paypal', 'crypto', 'bitcoin'
    ];
    
    if (bannedWords.some(word => lowerText.includes(word))) {
      setToastMessage('Message blocked for violating community rules.');
      setTimeout(() => setToastMessage(''), 4000);
      stopChat();
      addSystemMessage('Your account was flagged by the automated filter for violating rules. The session has been closed.');
      setInputText('');
      return;
    }

    socketRef.current.emit('chat_message', text);
    setMessages(prev => [...prev, { id: uuidv4(), sender: 'me', text }]);
    setInputText('');
  };

  const sendReaction = (emoji: string) => {
    if (!socketRef.current || appState !== 'CONNECTED') return;
    socketRef.current.emit('chat_reaction', emoji);
    setLocalReaction({ emoji, id: Date.now() });
    setTimeout(() => {
      setLocalReaction(null);
    }, 3000);
    setShowReactions(false);
  };

  const sendGame = () => {
    if (!socketRef.current || appState !== 'CONNECTED') return;
    setShowGameSelector(true);
  };

  const sendGameChallenge = (gameId: string) => {
    if (!socketRef.current || appState !== "CONNECTED") return;
    setMessages(prev => [...prev, {
      id: uuidv4(),
      sender: "me",
      text: "I challenged you to a game!",
      isGameChallenge: true,
      gameId,
      gameStatus: "pending",
      gameType: gameId
    }]);
    socketRef.current.emit("game_challenge", { gameType: gameId });
    setShowGameSelector(false);
  };
  const acceptGame = (challengerId: string, msgId: string, gameType: string, challengeId?: string) => {
    if (!socketRef.current || appState !== "CONNECTED") return;
    socketRef.current.emit("game_challenge_accept", { challengerId, gameType, challengeId });
  };
  const declineGame = (challengerId: string, msgId: string, challengeId?: string) => {
    if (!socketRef.current || appState !== "CONNECTED") return;
    socketRef.current.emit("game_challenge_decline", { challengerId, challengeId });
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, gameStatus: "declined" } : m));
  };

  const handleGameExit = () => {
    setActiveGame(null);
    setActiveGameId(null);
    setGameRole(null);
    if (socketRef.current && appState === "CONNECTED") {
      socketRef.current.emit("game_exit");
    }
  };

  const sendGameEvent = (payload: GameAction) => {
    if (socketRef.current && appState === "CONNECTED" && activeGameId) {
      socketRef.current.emit("game_action", {
        ...payload,
        gameId: activeGameId,
        actionId: crypto.randomUUID(),
        version: gameVersion,
        actor: auth.currentUser?.uid
      });
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setHasVideo(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setHasAudio(audioTrack.enabled);
      }
    }
  };

  
  useEffect(() => {
    // Push history state to intercept Android back button
    window.history.pushState({ isChat: true }, '', window.location.href);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (appState !== 'CONNECTED' && appState !== 'WAITING') { 
          onBack();
        } else { 
          stopChat();
          onBack();
        }
      }
    };
    
    const handlePopState = () => {
      if (appState !== 'CONNECTED' && appState !== 'WAITING') { 
        onBack();
      } else { 
        stopChat();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [appState, onBack]);

  const touchStartX = useRef(0);

  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
    touchStartY.current = e.changedTouches[0].screenY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    touchEndY.current = e.changedTouches[0].screenY;
    
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);

    if (deltaX > 100 && deltaX > deltaY) { // Swipe right and primarily horizontal
      if (appState !== 'CONNECTED' && appState !== 'WAITING') {
         onBack();
      } else {
         stopChat();
         onBack();
      }
    }
  };


  return (
    <div 
      className="flex flex-col h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-hidden bg-slate-100 text-slate-900 font-sans relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <SEO
        title="UmeTV Chat - Talk to Strangers"
        description="Start chatting instantly with strangers worldwide in high quality video or text chat."
        url="https://umetvchat.web.app/chat"
      />
      <GestureTutorialOverlay />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl font-bold text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          {toastMessage}
        </div>
      )}
      {/* Main Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-0 sm:p-4 gap-0 sm:gap-4 max-w-[1600px] w-full mx-auto bg-black sm:bg-transparent">
        
        {/* Left Column: Videos & Controls */}
        <div className="flex flex-col w-full lg:w-[65%] xl:w-[60%] gap-1 sm:gap-4 shrink-0 h-[52dvh] sm:h-[55dvh] lg:h-auto relative flex-none lg:flex-1">
          
          {/* Videos Container - Picture in Picture */}
          <div className="relative w-full h-full sm:aspect-[4/3] bg-black sm:rounded-lg overflow-hidden sm:border sm:border-slate-300 shadow-sm flex items-center justify-center flex-1 min-h-[45vh]">
            
            {/* Floating Controls Overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
              {appState === 'WAITING' && (
                <span className="text-xs font-semibold text-white bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-md shadow-sm">
                  Searching...
                </span>
              )}
              {appState === 'CONNECTED' && (
                <span className="text-xs font-semibold text-emerald-100 bg-emerald-500/80 backdrop-blur-sm px-2.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  Connected
                </span>
              )}
              {appState === 'CONNECTED' && (
                <button 
                  onClick={reportUser}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600/90 hover:bg-red-600 backdrop-blur-sm rounded-md transition-colors shadow-sm"
                  title="Report and block user for misconduct"
                >
                  <AlertTriangle className="w-4 h-4" /> Report & Block
                </button>
              )}
            </div>
            {/* Ume Tv Watermark */}
            <div className="absolute bottom-4 left-4 z-20 opacity-40 pointer-events-none select-none">
              <img src="/icon.png" alt="Ume Tv Logo" width="64" height="32" className="h-8 object-contain opacity-80 drop-shadow-md" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            
            {/* Stranger Video */}
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              style={{ transform: 'none', WebkitTransform: 'none' }}
              className={`absolute inset-0 w-full h-full object-cover ${appState !== 'CONNECTED' ? 'opacity-0' : 'opacity-100'}`}
            />
            {remoteReaction && (
              <div key={remoteReaction.id} className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                <span className="text-6xl sm:text-8xl animate-[ping_1s_ease-out_forwards] drop-shadow-2xl">{remoteReaction.emoji}</span>
              </div>
            )}
            {appState !== 'CONNECTED' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 bg-slate-900 z-0 overflow-hidden">
                <div className="absolute inset-0 tv-noise pointer-events-none"></div>
                {appState === 'WAITING' ? (
                  <div className="z-10 flex flex-col items-center gap-4">
                    <img src="/icon.png" alt="Ume Tv Logo" width="128" height="64" className="h-16 sm:h-20 object-contain drop-shadow-lg" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span className="text-white/60 text-sm font-semibold tracking-widest animate-pulse">SEARCHING...</span>
                  </div>
                ) : (
                  <>
                    <VideoOff className="w-16 h-16 mb-4 opacity-40 text-white/50 z-10" />
                    <p className="font-medium text-lg text-center px-4 z-10">
                      Ready to chat
                    </p>
                  </>
                )}
              </div>
            )}

            {/* User Video (PIP) - Moved to bottom right and made smaller */}
            <div 
              onClick={() => setIsLocalVideoMinimized(!isLocalVideoMinimized)}
              className={`absolute bottom-3 right-3 ${isLocalVideoMinimized ? "w-12 h-12 sm:w-16 sm:h-16 rounded-full cursor-pointer hover:scale-105" : "w-[22%] sm:w-[20%] max-w-[85px] sm:max-w-[160px] aspect-[3/4] sm:aspect-[4/3] rounded-lg cursor-pointer"} bg-slate-900 overflow-hidden border border-white/20 shadow-xl z-10 flex items-center justify-center transition-all duration-300 group`}
            >
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ transform: "scaleX(-1)", WebkitTransform: "scaleX(-1)" }}
                className={`w-full h-full object-cover transition-opacity duration-300 ${isLocalVideoMinimized ? "opacity-30" : "opacity-100"}`}
              />
              {!isLocalVideoMinimized && (
                <div className="absolute top-1 right-1 p-1 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  <Minimize2 className="w-4 h-4 text-white" />
                </div>
              )}
              {isLocalVideoMinimized && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  <Maximize2 className="w-5 h-5 text-white" />
                </div>
              )}
              {recognizedAction && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 bg-black/40 backdrop-blur-sm">
                  <span className="text-white font-bold text-sm sm:text-lg animate-bounce drop-shadow-md">{recognizedAction}</span>
                </div>
              )}

              {localReaction && (
                <div key={localReaction.id} className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                  <span className="text-3xl animate-[ping_1s_ease-out_forwards] drop-shadow-md">{localReaction.emoji}</span>
                </div>
              )}
              {mediaError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400">
                  <VideoOff className="w-5 h-5 mb-1" />
                  <span className="text-[9px] font-bold text-center px-1">No Camera</span>
                </div>
              )}
            </div>
          </div>

          {/* Call Controls */}
          <div className="flex items-center gap-1 sm:gap-3 bg-white p-1 sm:p-4 sm:rounded-lg border-t sm:border border-slate-200 shadow-sm z-10 shrink-0">
            {appState === 'IDLE' ? (
              <button 
                onClick={startChat} 
                className="flex-1 flex items-center justify-center gap-2 py-2 sm:py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-md font-bold text-base sm:text-lg transition-colors shadow-sm"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" /> Start Chatting
              </button>
            ) : (
              <>
                <button 
                  onClick={stopChat} 
                  className="flex-1 flex items-center justify-center gap-2 py-2 sm:py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md font-bold text-base sm:text-lg transition-colors"
                >
                  <Square className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" /> Stop
                </button>
                <button 
                  onClick={nextChat} 
                  className="flex-1 flex items-center justify-center gap-2 py-2 sm:py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-md font-bold text-base sm:text-lg transition-colors shadow-sm"
                >
                  <SkipForward className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" /> Next
                </button>
              </>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2 hidden sm:block">
            <Banner320x50Ad />
          </div>
        </div>

        {/* Right Column: Chat Box */}
        <div className="flex-1 flex flex-col bg-white sm:rounded-lg border-t sm:border-slate-200 sm:border sm:shadow-sm overflow-hidden relative">
          
          {showGameSelector && (
            <GameSelector 
              onSelect={sendGameChallenge} 
              onClose={() => setShowGameSelector(false)} 
            />
          )}

          {activeGame && (
            <GamePanel
              game={activeGame}
              isHost={gameRole === 'host'}
              onExit={handleGameExit}
              sendEvent={sendGameEvent}
              incomingEvent={incomingGameEvent}
            />
          )}

          {/* Chat Messages */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col gap-3 sm:gap-4">
             {messages.length === 0 && (
               <div className="m-auto flex flex-col items-center justify-center text-slate-400">
                 <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                 <span className="text-sm font-medium">Messages will appear here once connected.</span>
               </div>
             )}
             {messages.map(msg => {
               if (msg.isGameChallenge) {

                 return (
                   <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                     <div className="max-w-[80%] flex flex-col">
                       <span className={`text-[11px] font-bold mb-1 ml-1 ${msg.sender === 'me' ? 'text-sky-600 text-right mr-1' : 'text-red-500'}`}>
                         {msg.sender === 'me' ? 'You' : 'Stranger'}
                       </span>
                       <div className={`p-4 shadow-sm border rounded-2xl ${msg.sender === 'me' ? 'bg-sky-50 text-slate-900 border-sky-100 rounded-tr-sm' : 'bg-slate-50 text-slate-900 border-slate-200 rounded-tl-sm'}`}>
                         <div className="font-bold mb-3 flex items-center gap-2">
                           <Gamepad2 className="w-5 h-5" />
                           {msg.sender === 'me' ? 'You challenged them to' : 'Challenged you to'} {msg.gameType}!
                         </div>
                         {msg.gameStatus === 'pending' ? (
                           msg.sender === 'me' ? (
                             <span className="text-sm text-slate-500 italic">Waiting for response...</span>
                           ) : (
                             <div className="flex gap-2">
                               <button onClick={() => acceptGame(msg.gameId!, msg.id, msg.gameType!, msg.challengeId)} className="flex-1 bg-sky-500 text-white font-bold py-1.5 px-3 rounded text-sm hover:bg-sky-600">Accept</button>
                               <button onClick={() => declineGame(msg.gameId!, msg.id, msg.challengeId)} className="flex-1 bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded text-sm hover:bg-slate-300">Decline</button>
                             </div>
                           )
                         ) : (
                           <span className={`text-sm font-bold ${msg.gameStatus === 'accepted' ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {msg.gameStatus === 'accepted' ? 'Accepted' : 'Declined'}
                           </span>
                         )}
                       </div>
                     </div>
                   </div>
                 );
               }


               return (
               <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : msg.sender === 'partner' ? 'items-start' : 'items-center'}`}>
                 {msg.sender === 'system' ? (
                   <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider my-2">
                     {msg.text}
                   </span>
                 ) : (
                   <div className="max-w-[80%] flex flex-col">
                     <span className={`text-[11px] font-bold mb-1 ml-1 ${msg.sender === 'me' ? 'text-sky-600 text-right mr-1' : 'text-red-500'}`}>
                       {msg.sender === 'me' ? 'You' : 'Stranger'}
                     </span>
                     <div className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm break-words ${msg.sender === 'me' ? 'bg-sky-50 text-slate-900 border border-sky-100 rounded-2xl rounded-tr-sm' : 'bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl rounded-tl-sm'}`}>
                       {msg.text}
                     </div>
                   </div>
                 )}
               </div>
               );
             })}
          </div>

          {/* Chat Input */}
          <div className="p-2 sm:p-4 bg-slate-50 border-t border-slate-200 relative">
            {showReactions && (
              <div className="absolute bottom-full right-4 mb-2 bg-white border border-slate-200 shadow-xl rounded-2xl p-2 flex gap-2">
                {['👋', '❤️', '😂', '👍'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => sendReaction(emoji)}
                    className="w-10 h-10 flex items-center justify-center text-xl hover:bg-slate-100 rounded-full transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={sendMessage} className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={sendGame}
                disabled={appState !== 'CONNECTED'}
                className="px-3 bg-white border border-slate-300 rounded-md text-slate-500 hover:text-sky-500 hover:border-sky-500 disabled:opacity-50 transition-colors flex items-center justify-center shadow-sm"
                title="Send Icebreaker Game"
              >
                <Gamepad2 className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={appState === 'CONNECTED' ? "Type your message..." : "Connect to start chatting"}
                disabled={appState !== 'CONNECTED'}
                className="flex-1 bg-white border border-slate-300 rounded-md px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-[15px] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-400 shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowReactions(!showReactions)}
                disabled={appState !== 'CONNECTED'}
                className="px-3 bg-white border border-slate-300 rounded-md text-slate-500 hover:text-amber-500 hover:border-amber-500 disabled:opacity-50 transition-colors flex items-center justify-center shadow-sm"
                title="Send Reaction"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={appState !== 'CONNECTED' || !inputText.trim()}
                className="px-4 sm:px-6 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-md font-semibold transition-colors flex items-center justify-center shadow-sm text-sm sm:text-base"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
