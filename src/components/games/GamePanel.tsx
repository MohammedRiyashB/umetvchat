import React from 'react';
import { X } from 'lucide-react';
const TicTacToe = React.lazy(() => import('./TicTacToe'));
const Chess = React.lazy(() => import('./Chess'));
const HandCricket = React.lazy(() => import('./HandCricket'));
const Carrom = React.lazy(() => import('./Carrom'));

interface GamePanelProps {
  game: string;
  isHost: boolean;
  onExit: () => void;
  sendEvent: (payload: any) => void;
  incomingEvent: any | null;
}

export default function GamePanel({ game, isHost, onExit, sendEvent, incomingEvent }: GamePanelProps) {
  const getGameName = () => {
    if (game === 'tictactoe') return 'Tic-Tac-Toe';
    if (game === 'chess') return 'Chess';
    if (game === 'carrom') return 'Carrom';
    if (game === 'handcricket') return 'Hand Cricket';
    return 'Game';
  };

  return (
    <div className="absolute inset-0 bg-slate-50 z-30 flex flex-col">
      {/* Game Header */}
      <div className="bg-white border-b border-slate-200 p-3 flex items-center justify-between shadow-sm">
        <button 
          onClick={onExit}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 font-semibold text-sm transition-colors"
        >
          <X className="w-4 h-4" /> Exit
        </button>
        <h3 className="font-bold text-slate-800 flex items-center gap-2 pr-2">
          <span>🎮</span> {getGameName()}
        </h3>
      </div>

      {/* Game Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div></div>}>
        {game === 'tictactoe' && <TicTacToe isHost={isHost} sendEvent={sendEvent} incomingEvent={incomingEvent} />}
        {game === 'chess' && <Chess isHost={isHost} sendEvent={sendEvent} incomingEvent={incomingEvent} />}
        {game === 'carrom' && <Carrom isHost={isHost} sendEvent={sendEvent} incomingEvent={incomingEvent} />}
        {game === 'handcricket' && <HandCricket isHost={isHost} sendEvent={sendEvent} incomingEvent={incomingEvent} />}
        </React.Suspense>
      </div>
    </div>
  );
}
