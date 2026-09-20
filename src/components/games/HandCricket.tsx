import React, { useState, useEffect } from 'react';
import { RefreshCcw } from 'lucide-react';
import type { GameAction, GameSyncEvent, HandCricketState } from './gameTypes';

interface HandCricketProps { isHost: boolean; sendEvent: (payload: GameAction) => void; incomingEvent: GameSyncEvent | null; }
export default function HandCricket({ isHost, sendEvent, incomingEvent }: HandCricketProps) {
  const [gameState, setGameState] = useState<HandCricketState>({
    inning: 1, p1Role: 'batting', p1Choice: null, p2Choice: null, p1Score: 0, p2Score: 0,
    target: null, gameOver: false, result: null, round: 1
  });
  const [myPendingChoice, setMyPendingChoice] = useState<number | null>(null);

  useEffect(() => {
    if (incomingEvent && incomingEvent.type === 'sync') {
      setGameState(incomingEvent.state as HandCricketState);
      setMyPendingChoice(null);
    }
  }, [incomingEvent]);

  const handleChoice = (choice: number) => {
    setMyPendingChoice(choice);
    sendEvent({ type: 'action', choice, round: gameState.round || 1 });
  };

  const restart = () => {
    sendEvent({ type: 'rematch' });
  };

  const myRole = isHost ? gameState.p1Role : (gameState.p1Role === 'batting' ? 'bowling' : 'batting');
  const myScore = isHost ? gameState.p1Score : gameState.p2Score;
  const opponentScore = isHost ? gameState.p2Score : gameState.p1Score;
  
  const amIWinner = gameState.result === (isHost ? 'host' : 'guest');
  const isDraw = gameState.result === 'draw';

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-6 bg-slate-900 text-white font-sans overflow-hidden">
      <div className="flex-1 flex flex-col max-w-lg w-full mx-auto relative">
        <h2 className="text-2xl font-black text-center mb-6 uppercase tracking-wider text-green-400">Hand Cricket</h2>

        {/* Score Board */}
        <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-xl mb-8">
          <div className="text-center">
            <div className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">You</div>
            <div className="text-3xl font-black">{myScore || 0}</div>
            <div className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${myRole === 'batting' ? 'bg-sky-500/20 text-sky-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {myRole === 'batting' ? 'BATTING' : 'BOWLING'}
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="text-slate-400 font-bold text-sm mb-1">INNING {gameState.inning || 1}</div>
            {gameState.target && (
              <div className="bg-amber-500/20 text-amber-400 text-xs font-black px-3 py-1 rounded-full border border-amber-500/30">
                TARGET: {gameState.target}
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wider">Opponent</div>
            <div className="text-3xl font-black">{opponentScore || 0}</div>
            <div className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${myRole !== 'batting' ? 'bg-sky-500/20 text-sky-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {myRole !== 'batting' ? 'BATTING' : 'BOWLING'}
            </div>
          </div>
        </div>

        {/* Last Action / Output */}
        {(gameState.lastC1 !== undefined) && !gameState.gameOver && (
          <div className="text-center mb-8 bg-slate-800/50 py-4 rounded-xl">
             <div className="text-slate-300 font-bold mb-2">Previous Ball</div>
             <div className="flex justify-center items-center gap-6">
                <span className="text-4xl">{isHost ? gameState.lastC1 : gameState.lastC2}</span>
                <span className="text-xl font-bold text-slate-500">vs</span>
                <span className="text-4xl">{isHost ? gameState.lastC2 : gameState.lastC1}</span>
             </div>
             {gameState.lastC1 === gameState.lastC2 && (
                <div className="text-rose-500 font-black text-xl mt-3 animate-pulse">OUT!</div>
             )}
          </div>
        )}

        {/* Actions */}
        {!gameState.gameOver ? (
          <div className="flex-1 flex flex-col justify-end pb-4">
            <div className="text-center mb-4 font-bold text-slate-300">
              {myPendingChoice !== null ? "Waiting for opponent..." : "Choose your number"}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
              {[1, 2, 3, 4, 5, 6].map(num => (
                <button
                  key={num}
                  disabled={myPendingChoice !== null}
                  onClick={() => handleChoice(num)}
                  className={`aspect-square rounded-2xl flex items-center justify-center text-2xl font-black transition-all transform active:scale-95 ${
                    myPendingChoice === num
                      ? 'bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.5)] scale-105'
                      : myPendingChoice !== null
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 hover:border-sky-500/50 shadow-lg'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-6xl mb-4">{amIWinner ? '🏆' : isDraw ? '🤝' : '💀'}</div>
            <div className={`text-4xl font-black mb-2 ${amIWinner ? 'text-emerald-400' : isDraw ? 'text-amber-400' : 'text-rose-500'}`}>
              {amIWinner ? 'YOU WON!' : isDraw ? "IT'S A DRAW" : 'YOU LOST'}
            </div>
            
            <button
              onClick={restart}
              className="mt-8 px-8 py-3 bg-white text-slate-900 rounded-full font-bold flex items-center gap-2 hover:bg-slate-200 transition-colors"
            >
              <RefreshCcw className="w-5 h-5" /> Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
