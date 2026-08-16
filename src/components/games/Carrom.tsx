import React, { useState, useEffect, useRef } from 'react';
import Matter from 'matter-js';

const { Engine, Render, Runner, World, Bodies, Body, Events, Vector, Composite } = Matter;

export default function Carrom({ isHost, sendEvent, incomingEvent }: any) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const strikerRef = useRef<Matter.Body | null>(null);
  const coinsRef = useRef<Matter.Body[]>([]);

  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [isMyTurn, setIsMyTurn] = useState(isHost);
  const [winner, setWinner] = useState<string | null>(null);

  const myColor = isHost ? 'white' : 'black';
  const width = 400;
  const height = 400;

  // Drag aiming state
  const [isAiming, setIsAiming] = useState(false);
  const [aimStart, setAimStart] = useState({ x: 0, y: 0 });
  const [aimCurrent, setAimCurrent] = useState({ x: 0, y: 0 });

  const isMovingRef = useRef(false);

  useEffect(() => {
    if (incomingEvent && incomingEvent.type === "sync") {
      const state = incomingEvent.state;
      if (incomingEvent.isMyTurn !== undefined) setIsMyTurn(incomingEvent.isMyTurn);
      
      if (state.winner) {
        if (state.winner === 'draw') setWinner('Draw!');
        else if (state.winner === (isHost ? 'host' : 'guest')) setWinner('You Won!');
        else setWinner('You Lost!');
      } else {
        setWinner(null);
      }
      
      if (state.scores) {
        setMyScore(isHost ? state.scores.host : state.scores.guest);
        setOpponentScore(isHost ? state.scores.guest : state.scores.host);
      }
      if (state.lastShot && !isMyTurn && strikerRef.current) {
        // Apply remote shot
        Matter.Body.setPosition(strikerRef.current, state.lastShot.position);
        Matter.Body.applyForce(strikerRef.current, strikerRef.current.position, state.lastShot.force);
      }
    }
  }, [incomingEvent, isHost, isMyTurn]);

  useEffect(() => {
    if (!sceneRef.current) return;
    if (!sceneRef.current) return;

    // Create a canvas inside sceneRef instead of using Render
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    sceneRef.current.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const engine = Engine.create({
      gravity: { x: 0, y: 0, scale: 0 } // top down
    });
    engineRef.current = engine;

    const wallOpts = { isStatic: true, render: { visible: false }, restitution: 0.5 };
    const walls = [
      Bodies.rectangle(width/2, 10, width, 20, wallOpts),
      Bodies.rectangle(width/2, height-10, width, 20, wallOpts),
      Bodies.rectangle(10, height/2, 20, height, wallOpts),
      Bodies.rectangle(width-10, height/2, 20, height, wallOpts)
    ];

    const pocketOpts = { isStatic: true, isSensor: true };
    const pockets = [
      Bodies.circle(30, 30, 25, { ...pocketOpts, label: 'pocket' }),
      Bodies.circle(width-30, 30, 25, { ...pocketOpts, label: 'pocket' }),
      Bodies.circle(30, height-30, 25, { ...pocketOpts, label: 'pocket' }),
      Bodies.circle(width-30, height-30, 25, { ...pocketOpts, label: 'pocket' })
    ];

    const coinOpts = { restitution: 0.7, friction: 0.05, frictionAir: 0.02, density: 0.002 };
    
    const queen = Bodies.circle(width/2, height/2, 12, { ...coinOpts, label: 'queen' });
    const whites = [
      Bodies.circle(width/2, height/2 - 25, 12, { ...coinOpts, label: 'white' }),
      Bodies.circle(width/2, height/2 + 25, 12, { ...coinOpts, label: 'white' }),
      Bodies.circle(width/2 - 25, height/2, 12, { ...coinOpts, label: 'white' }),
      Bodies.circle(width/2 + 25, height/2, 12, { ...coinOpts, label: 'white' })
    ];
    const blacks = [
      Bodies.circle(width/2 - 18, height/2 - 18, 12, { ...coinOpts, label: 'black' }),
      Bodies.circle(width/2 + 18, height/2 - 18, 12, { ...coinOpts, label: 'black' }),
      Bodies.circle(width/2 - 18, height/2 + 18, 12, { ...coinOpts, label: 'black' }),
      Bodies.circle(width/2 + 18, height/2 + 18, 12, { ...coinOpts, label: 'black' })
    ];

    coinsRef.current = [queen, ...whites, ...blacks];

    const striker = Bodies.circle(width/2, isHost ? height - 70 : 70, 16, { 
      restitution: 0.8, 
      friction: 0.02, 
      frictionAir: 0.02, 
      density: 0.005,
      label: 'striker'
    });
    strikerRef.current = striker;

    World.add(engine.world, [...walls, ...pockets, ...coinsRef.current, striker]);

    // Handle pockets
    Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        if (bodyA.label === 'pocket' || bodyB.label === 'pocket') {
          const pocket = bodyA.label === 'pocket' ? bodyA : bodyB;
          const coin = bodyA.label === 'pocket' ? bodyB : bodyA;
          
          if (['white', 'black', 'queen', 'striker'].includes(coin.label as string)) {
            // Remove from world immediately
            World.remove(engine.world, coin);
            
            if (coin.label === 'striker') {
              // Foul
              sendEvent({ type: 'score', foul: true });
            } else {
              sendEvent({ type: 'score', label: coin.label });
            }
          }
        }
      });
    });

    // Custom Render Loop
    Events.on(engine, 'afterUpdate', () => {
      if (!ctx) return;
      
      // Clear
      ctx.clearRect(0, 0, width, height);

      // Draw premium wood background
      ctx.fillStyle = '#d97706'; // Base amber-600
      ctx.fillRect(0, 0, width, height);
      
      const boardGrad = ctx.createRadialGradient(width/2, height/2, 10, width/2, height/2, width*0.7);
      boardGrad.addColorStop(0, 'rgba(252, 211, 77, 0.4)'); // amber-300
      boardGrad.addColorStop(1, 'rgba(120, 53, 15, 0.8)'); // amber-900
      ctx.fillStyle = boardGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw board markings
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.6)';
      ctx.lineWidth = 2;
      
      // Center circles
      ctx.beginPath();
      ctx.arc(width/2, height/2, 20, 0, 2 * Math.PI);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(width/2, height/2, 40, 0, 2 * Math.PI);
      ctx.stroke();

      // Baselines
      const drawBaseline = (y: number) => {
        ctx.beginPath();
        ctx.moveTo(80, y);
        ctx.lineTo(width-80, y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(80, y > height/2 ? y + 25 : y - 25);
        ctx.lineTo(width-80, y > height/2 ? y + 25 : y - 25);
        ctx.stroke();
      }
      drawBaseline(70);
      drawBaseline(height-70);

      const drawSideBaseline = (x: number) => {
        ctx.beginPath();
        ctx.moveTo(x, 80);
        ctx.lineTo(x, height-80);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x > width/2 ? x + 25 : x - 25, 80);
        ctx.lineTo(x > width/2 ? x + 25 : x - 25, height-80);
        ctx.stroke();
      }
      drawSideBaseline(70);
      drawSideBaseline(width-70);

      // Draw pockets
      const pocketRadius = 25;
      const pocketCenters = [[30,30], [width-30,30], [30,height-30], [width-30,height-30]];
      pocketCenters.forEach(([px, py]) => {
         ctx.beginPath();
         ctx.arc(px, py, pocketRadius, 0, 2 * Math.PI);
         ctx.fillStyle = '#0f172a'; // slate-900
         ctx.fill();
         ctx.strokeStyle = '#1e293b'; // slate-800
         ctx.lineWidth = 3;
         ctx.stroke();
      });

      // Draw Shadows for coins
      const allBodies = Composite.allBodies(engine.world);
      allBodies.forEach(body => {
         if (['striker', 'queen', 'white', 'black'].includes(body.label)) {
            ctx.beginPath();
            const radius = body.label === 'striker' ? 16 : 12;
            ctx.arc(body.position.x + 3, body.position.y + 3, radius, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fill();
         }
      });

      // Draw Coins & Striker
      allBodies.forEach(body => {
         if (['wall', 'pocket'].includes(body.label)) return;

         const { x, y } = body.position;
         const angle = body.angle;

         ctx.translate(x, y);
         ctx.rotate(angle);

         if (body.label === 'striker') {
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, 2 * Math.PI);
            const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 16);
            grad.addColorStop(0, '#ffffff'); // white reflection
            grad.addColorStop(1, '#0284c7'); // sky-600
            ctx.fillStyle = grad;
            ctx.fill();
            
            ctx.strokeStyle = '#0369a1'; // sky-700
            ctx.lineWidth = 2;
            ctx.stroke();

            // inner circle pattern
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
         } else if (body.label === 'queen') {
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, 2 * Math.PI);
            const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 12);
            grad.addColorStop(0, '#fca5a5'); // red-300
            grad.addColorStop(1, '#be123c'); // rose-700
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = '#9f1239'; // rose-800
            ctx.lineWidth = 2;
            ctx.stroke();
         } else if (body.label === 'white') {
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, 2 * Math.PI);
            const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 12);
            grad.addColorStop(0, '#ffffff'); // white
            grad.addColorStop(1, '#cbd5e1'); // slate-300
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = '#94a3b8'; // slate-400
            ctx.lineWidth = 2;
            ctx.stroke();
         } else if (body.label === 'black') {
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, 2 * Math.PI);
            const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 12);
            grad.addColorStop(0, '#64748b'); // slate-500
            grad.addColorStop(1, '#0f172a'); // slate-900
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = '#020617'; // slate-950
            ctx.lineWidth = 2;
            ctx.stroke();
         }

         ctx.rotate(-angle);
         ctx.translate(-x, -y);
      });

      // Check motion
      let isAnythingMoving = false;
      for (const b of allBodies) {
        if (!b.isStatic && b.speed > 0.1) {
          isAnythingMoving = true;
          break;
        }
      }

      if (isMovingRef.current && !isAnythingMoving) {
        isMovingRef.current = false;
        // Turn ended, reset striker for next person
        sendEvent({ type: 'turn_end' });
      } else if (!isMovingRef.current && isAnythingMoving) {
        isMovingRef.current = true;
      }
    });

    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    return () => {
      Runner.stop(runner);
      if (engineRef.current) {
        World.clear(engineRef.current.world, false);
        Engine.clear(engineRef.current);
      }
      if (sceneRef.current && canvas) {
        sceneRef.current.removeChild(canvas);
      }
    };
  }, []);

  const resetStriker = (isHostTurn: boolean) => {
    if (!strikerRef.current || !engineRef.current) return;
    
    // Remove if it was pocketed, then add back
    if (!Composite.allBodies(engineRef.current.world).includes(strikerRef.current)) {
      World.add(engineRef.current.world, strikerRef.current);
    }
    
    const yPos = isHostTurn ? height - 70 : 70;
    Body.setPosition(strikerRef.current, { x: width/2, y: yPos });
    Body.setVelocity(strikerRef.current, { x: 0, y: 0 });
    Body.setAngularVelocity(strikerRef.current, 0);
  };

  const handleRestartEvent = () => {
    setMyScore(0);
    setOpponentScore(0);
    setWinner(null);
    setIsMyTurn(isHost);
    
    // Reset positions
    if (engineRef.current && strikerRef.current && coinsRef.current) {
      const world = engineRef.current.world;
      
      // Make sure all coins are in the world
      coinsRef.current.forEach(coin => {
        if (!Composite.allBodies(world).includes(coin)) {
          World.add(world, coin);
        }
        Body.setVelocity(coin, { x: 0, y: 0 });
        Body.setAngularVelocity(coin, 0);
      });

      // Reset Queen
      Body.setPosition(coinsRef.current[0], { x: width/2, y: height/2 });
      
      // Reset Whites
      Body.setPosition(coinsRef.current[1], { x: width/2, y: height/2 - 25 });
      Body.setPosition(coinsRef.current[2], { x: width/2, y: height/2 + 25 });
      Body.setPosition(coinsRef.current[3], { x: width/2 - 25, y: height/2 });
      Body.setPosition(coinsRef.current[4], { x: width/2 + 25, y: height/2 });

      // Reset Blacks
      Body.setPosition(coinsRef.current[5], { x: width/2 - 18, y: height/2 - 18 });
      Body.setPosition(coinsRef.current[6], { x: width/2 + 18, y: height/2 - 18 });
      Body.setPosition(coinsRef.current[7], { x: width/2 - 18, y: height/2 + 18 });
      Body.setPosition(coinsRef.current[8], { x: width/2 + 18, y: height/2 + 18 });

      // Reset Striker
      resetStriker(true); // Host goes first on restart
    }
  };

  useEffect(() => {
    if (incomingEvent && incomingEvent.type === "sync") {
      const state = incomingEvent.state;
      if (incomingEvent.isMyTurn !== undefined) setIsMyTurn(incomingEvent.isMyTurn);
      
      if (state.winner) {
        if (state.winner === 'draw') setWinner('Draw!');
        else if (state.winner === (isHost ? 'host' : 'guest')) setWinner('You Won!');
        else setWinner('You Lost!');
      } else {
        setWinner(null);
      }
      
      if (state.scores) {
        setMyScore(isHost ? state.scores.host : state.scores.guest);
        setOpponentScore(isHost ? state.scores.guest : state.scores.host);
      }
      if (state.lastShot && !isMyTurn && strikerRef.current) {
        // Apply remote shot
        Matter.Body.setPosition(strikerRef.current, state.lastShot.position);
        Matter.Body.applyForce(strikerRef.current, strikerRef.current.position, state.lastShot.force);
      }
    }
  }, [incomingEvent, isHost, isMyTurn]);
  // Skip the old useEffect that handled incomingEvent

  // Pointer event handlers for aiming the striker
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isMyTurn || isMovingRef.current || winner || !strikerRef.current) return;
    
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Check if clicked near striker
    const dist = Vector.magnitude(Vector.sub({ x, y }, strikerRef.current.position));
    if (dist < 40) {
      setIsAiming(true);
      setAimStart({ x, y });
      setAimCurrent({ x, y });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isAiming) return;
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    
    setAimCurrent({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isMyTurn || winner || isMovingRef.current) return;
    setIsAiming(false);
    const force = { x: (aimStart.x - aimCurrent.x) * 0.05, y: (aimStart.y - aimCurrent.y) * 0.05 };
    const forceMag = Matter.Vector.magnitude(force);
    if (strikerRef.current && forceMag > 0.01) {
       Matter.Body.applyForce(strikerRef.current, strikerRef.current.position, force);
       sendEvent({ type: "shot", shot: { position: strikerRef.current.position, force } });
    }
  };


  const restart = () => {
    sendEvent({ type: 'rematch' });
    handleRestartEvent();
  };

  return (
    <div className="w-full h-full flex flex-col items-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900 to-[#271505]">
      <div className="w-full max-w-sm flex justify-between items-center mb-6 bg-black/50 backdrop-blur-md text-amber-50 p-4 rounded-xl border border-amber-900/50 shadow-2xl">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-amber-400/80 font-bold mb-1">You ({myColor})</div>
          <div className="text-3xl font-black drop-shadow-md">{myScore}</div>
        </div>
        <div className="text-center flex-1 px-4">
          {winner ? (
            <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 drop-shadow-sm animate-pulse">{winner}</div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${isMyTurn ? 'bg-emerald-400 text-emerald-400' : 'bg-rose-500 text-rose-500'}`} />
              <div className="font-bold text-xs uppercase tracking-wider text-amber-200/90">
                {isMyTurn ? "Your Turn" : "Opponent"}
              </div>
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-amber-400/80 font-bold mb-1">Opponent</div>
          <div className="text-3xl font-black drop-shadow-md">{opponentScore}</div>
        </div>
      </div>

      <div className="relative p-3 sm:p-4 bg-gradient-to-br from-[#3e2723] to-[#1a110a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(255,255,255,0.1)] border border-[#4e342e]">
        <div 
          ref={sceneRef} 
          className="relative overflow-hidden cursor-crosshair touch-none rounded shadow-[inset_0_5px_20px_rgba(0,0,0,0.9)] bg-black"
          style={{ width: '100%', maxWidth: 400, aspectRatio: '1/1' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {isAiming && strikerRef.current && (
            <div 
              className="absolute pointer-events-none rounded-full"
              style={{
                left: strikerRef.current.position.x - 2,
                top: strikerRef.current.position.y,
                width: 4,
                height: Math.min(200, Vector.magnitude(Vector.sub(aimStart, aimCurrent))),
                background: 'linear-gradient(to top, rgba(250,204,21,1), rgba(250,204,21,0))',
                transformOrigin: 'top center',
                transform: `rotate(${Math.atan2(aimStart.y - aimCurrent.y, aimStart.x - aimCurrent.x) - Math.PI/2}rad)`,
                boxShadow: '0 0 10px rgba(250,204,21,0.5)'
              }}
            />
          )}
        </div>
        
        {winner && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
            <button 
              onClick={restart}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white font-black text-xl rounded-full shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all transform hover:scale-105 active:scale-95 border border-yellow-300/50"
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
