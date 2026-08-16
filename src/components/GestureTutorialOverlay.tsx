import React, { useState, useEffect } from 'react';

export default function GestureTutorialOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenGestureTutorial');
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenGestureTutorial', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
        >
          ✕
        </button>

        <div className="w-16 h-16 bg-sky-100 text-sky-500 rounded-full flex items-center justify-center mb-6">
          <span className="text-3xl">👋</span>
        </div>

        <h2 className="text-2xl font-black text-slate-900 mb-2">New! Gesture Controls</h2>
        <p className="text-slate-600 font-medium mb-8">
          Skip to the next chat without touching your device! Just hold your hand up and swipe horizontally in front of your camera.
        </p>

        {/* Animation Container */}
        <div className="w-full aspect-video bg-slate-900 rounded-2xl mb-8 relative overflow-hidden flex items-center justify-center shadow-inner">
          
          {/* Fake user */}
          <div className="absolute inset-0 opacity-20 bg-gradient-to-tr from-sky-900 to-slate-900" />
          
          {/* Animated Hand */}
          <div className="text-6xl absolute transition-transform ease-in-out origin-bottom duration-[1500ms] animate-[swipe_3s_ease-in-out_infinite]">
            🖐️
          </div>

          <div className="absolute top-4 bg-sky-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-md uppercase tracking-wider animate-[appear_3s_ease-in-out_infinite]">
            👋 NEXT
          </div>
        </div>

        <button
          onClick={handleClose}
          className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-lg transition-all shadow-md shadow-sky-500/20 active:scale-95"
        >
          Got it!
        </button>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes swipe {
          0% { transform: translateX(0px) rotate(0deg) scale(0.8); opacity: 0; }
          20% { transform: translateX(0px) rotate(0deg) scale(1); opacity: 1; }
          40% { transform: translateX(0px) rotate(0deg) scale(1); opacity: 1; }
          60% { transform: translateX(-80px) rotate(-15deg) scale(1); opacity: 1; }
          70% { transform: translateX(-80px) rotate(-15deg) scale(1); opacity: 0; }
          100% { transform: translateX(0px) rotate(0deg) scale(0.8); opacity: 0; }
        }
        @keyframes appear {
          0%, 55% { opacity: 0; transform: translateY(10px); }
          60%, 80% { opacity: 1; transform: translateY(0); }
          85%, 100% { opacity: 0; transform: translateY(-10px); }
        }
      `}} />
    </div>
  );
}
