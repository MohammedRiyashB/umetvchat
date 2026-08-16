import React from 'react';
import { Shield, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from './SEO';

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center">
      <SEO 
        title="About UmeTV - Our Mission & Vision" 
        description="Learn more about UmeTV, the premier destination for spontaneous and meaningful connections." 
        url="https://umetvchat.web.app/about" 
      />
      <header className="w-full bg-slate-950 shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <MessageCircle className="w-7 h-7 text-sky-500" />
          <span className="text-2xl font-bold text-white tracking-tight">
            Ume Tv
          </span>
        </div>
      </header>

      <main className="w-full max-w-4xl px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12 prose prose-slate max-w-none">
          <h2 className="text-4xl font-black text-slate-900 mb-8 border-b border-slate-200 pb-4">About Ume Tv</h2>
          <div className="prose prose-slate max-w-none text-slate-700 font-medium leading-relaxed space-y-6 text-lg">
            <p>
              Welcome to Ume Tv, the premier destination for spontaneous and meaningful connections. Our mission is to bridge the gap between cultures, continents, and communities by providing a safe, lightning-fast, and highly intuitive platform for random video and text chatting. Whether you are looking to practice a new language, make a lifelong friend, or simply pass the time with engaging conversations, Ume Tv is designed to bring the world closer to you.
            </p>
            <p>
              Unlike older chat platforms that suffer from poor video quality and lack of moderation, Ume Tv leverages cutting-edge WebRTC technology and user-driven moderation features to ensure that your experience is not only seamless but also safe. We believe that the internet should be a place of discovery and joy, and we are committed to maintaining a positive environment for all our users.
            </p>
            
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 shadow-sm mt-12">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Company Information</h3>
              <ul className="space-y-4 list-none p-0">
                <li className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                  <strong className="text-slate-900 min-w-[120px]">Company:</strong> BMR inc.
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                  <strong className="text-slate-900 min-w-[120px]">Founder:</strong> Mohammed Riyash B
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                  <strong className="text-slate-900 min-w-[120px]">Established:</strong> 2026
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 flex justify-center">
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </main>
      <footer className="w-full bg-slate-950 text-slate-400 py-12 px-6 border-t border-slate-900 text-center mt-auto">
        <p>© 2026 umetvchat.web.app</p>
      </footer>
    </div>
  );
}
