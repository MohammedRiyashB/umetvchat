import React, { useState, useEffect } from 'react';
import { RefreshCcw } from 'lucide-react';
import type { GameAction, GameSyncEvent, TicTacToeState } from './gameTypes';

interface TicTacToeProps { isHost: boolean; sendEvent: (payload: GameAction) => void; incomingEvent: GameSyncEvent | null; }
export default function TicTacToe({ isHost, sendEvent, incomingEvent }: TicTacToeProps) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [winner, setWinner] = useState<string | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(isHost);

  useEffect(() => {
    if (incomingEvent && incomingEvent.type === 'sync') {
      const state = incomingEvent.state as TicTacToeState;
      setBoard(state.board || Array(9).fill(null));
      setWinner(state.winner || null);
      
      setIsMyTurn(incomingEvent.isMyTurn);
      // incomingEvent.turn gives the socket.id. But how do we know if it's our socket id?
      // Wait, Chat.tsx passed incomingEvent with `turn: incomingEvent.turn === socketRef.current.id`?
      // Ah! I passed `turn` as the raw socketId from server! Let me fix Chat.tsx to pass boolean `isMyTurn`.
    }
  }, [incomingEvent]);

  const handleClick = (index: number) => {
    if (!isMyTurn || board[index] || winner) return;
    sendEvent({ type: 'action', index });
  };

  const restart = () => {
    sendEvent({ type: 'rematch' });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 font-sans p-4">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500 mb-2">TIC TAC TOE</h2>
        {winner ? (
          <div className={`text-2xl font-bold ${winner === 'draw' ? 'text-amber-400' : (winner === (isHost ? 'host' : 'guest') ? 'text-emerald-400' : 'text-rose-500')}`}>
            {winner === 'draw' ? "It's a Draw!" : (winner === (isHost ? 'host' : 'guest') ? 'You Won!' : 'You Lost!')}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isMyTurn ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-xl font-bold text-slate-200">
              {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-slate-800 p-3 rounded-2xl shadow-2xl border border-slate-700">
        {board.map((cell, index) => (
          <button
            key={index}
            disabled={!isMyTurn || cell !== null || winner !== null}
            onClick={() => handleClick(index)}
            className={`w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center text-5xl font-black rounded-xl transition-all
              ${!cell && isMyTurn && !winner ? 'hover:bg-slate-700 active:scale-95 cursor-pointer' : 'cursor-default'}
              ${cell ? 'bg-slate-700 shadow-inner' : 'bg-slate-800/50 shadow-md'}
              ${cell === 'X' ? 'text-sky-400' : 'text-rose-400'}
            `}
          >
            {cell}
          </button>
        ))}
      </div>

      {winner && (
        <button
          onClick={restart}
          className="mt-8 px-8 py-3 bg-white text-slate-900 rounded-full font-bold flex items-center gap-2 hover:bg-slate-200 transition-colors shadow-lg active:scale-95"
        >
          <RefreshCcw className="w-5 h-5" /> Play Again
        </button>
      )}
    </div>
  );
}
