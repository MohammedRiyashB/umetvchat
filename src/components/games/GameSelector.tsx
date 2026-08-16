import React from 'react';
import { X, PlayCircle } from 'lucide-react';

interface GameSelectorProps {
  onSelect: (game: string) => void;
  onClose: () => void;
}

const games = [
  { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '❌⭕' },
  { id: 'chess', name: 'Chess', emoji: '♟️' },
  { id: 'carrom', name: 'Carrom', emoji: '🎱' },
  { id: 'handcricket', name: 'Hand Cricket', emoji: '🏏' },
];

export default function GameSelector({ onSelect, onClose }: GameSelectorProps) {
  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <span className="text-2xl">🎮</span> Select a Game
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto">
          {games.map(game => (
            <button
              key={game.id}
              onClick={() => onSelect(game.id)}
              className="flex flex-col items-center justify-center gap-3 p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-sky-500 hover:shadow-md hover:-translate-y-1 transition-all active:translate-y-0 group"
            >
              <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-3xl shadow-inner group-hover:bg-sky-50 transition-colors">
                {game.emoji}
              </div>
              <span className="font-bold text-slate-700 text-sm">{game.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
