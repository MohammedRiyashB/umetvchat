import React, { useState, useEffect } from 'react';
import { Chess as ChessGame } from 'chess.js';
import { Chessboard, type PieceDropHandlerArgs } from 'react-chessboard';
import type { ChessState, GameAction, GameSyncEvent } from './gameTypes';

interface ChessProps { isHost: boolean; sendEvent: (payload: GameAction) => void; incomingEvent: GameSyncEvent | null; }
export default function Chess({ isHost, sendEvent, incomingEvent }: ChessProps) {
  const [game, setGame] = useState(new ChessGame());
  const [winner, setWinner] = useState<string | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(isHost);
  
  const myColor = isHost ? 'white' : 'black';

  useEffect(() => {
    if (incomingEvent && incomingEvent.type === 'sync') {
      const state = incomingEvent.state as ChessState;
      if (state.fen) {
        setGame(new ChessGame(state.fen));
      }
      if (state.winner !== undefined) {
         setWinner(state.winner);
      }
      if (incomingEvent.isMyTurn !== undefined) {
         setIsMyTurn(incomingEvent.isMyTurn);
      }
    }
  }, [incomingEvent]);

  const onDrop = ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs) => {
    if (!isMyTurn || winner) return false;

    const newGame = new ChessGame(game.fen());
    try {
      const move = newGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: (piece[1] || 'q').toLowerCase(),
      });
      if (move === null) return false;
      
      // Speculative update for snappier UI
      setGame(newGame);
      sendEvent({ type: 'action', move });
      return true;
    } catch (e) {
      return false;
    }
  };

  const restart = () => {
    sendEvent({ type: 'rematch' });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
      <div className="mb-6 text-center z-10 bg-slate-900/60 p-4 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl">
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 mb-2 drop-shadow-sm uppercase tracking-widest">Premium Chess</h2>
        {winner ? (
          <div className="text-2xl font-bold text-emerald-400 drop-shadow-md animate-pulse">
            {winner === 'draw' ? "It's a Draw!" : `${winner === (isHost ? 'host' : 'guest') ? '🏆 You Won!' : '💀 You Lost!'}`}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${isMyTurn ? 'bg-emerald-400 text-emerald-400' : 'bg-rose-500 text-rose-500'}`} />
            <span className="text-xl font-bold text-slate-200 tracking-wide">
              {isMyTurn ? "Your Turn" : "Opponent's Turn"}
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md aspect-square mb-6">
        <div className="absolute -inset-4 sm:-inset-6 bg-gradient-to-br from-[#5d4037] to-[#3e2723] rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.5)] border border-[#795548]" />
        
        <div className="absolute -inset-1 sm:-inset-2 bg-gradient-to-br from-[#27272a] to-[#09090b] rounded shadow-[inset_0_2px_15px_rgba(0,0,0,0.8)] border border-[#3f3f46]" />
        
        <div className="relative w-full h-full shadow-[0_0_20px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden">
          <Chessboard 
             options={{ position: game.fen(), onPieceDrop: onDrop, boardOrientation: myColor as "white" | "black", animationDurationInMs: 300, darkSquareStyle: { backgroundColor: "#4a6b8c" }, lightSquareStyle: { backgroundColor: "#e2e8f0" }, dropSquareStyle: { boxShadow: "inset 0 0 1px 4px rgba(250, 204, 21, 0.8)" }, boardStyle: { borderRadius: "2px", boxShadow: "inset 0 0 10px rgba(0,0,0,0.5)" } }}
          />
        </div>
        
        {winner && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-sm">
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
