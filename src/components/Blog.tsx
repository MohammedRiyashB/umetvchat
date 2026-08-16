import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from './SEO';

export default function Blog() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center">
      <SEO 
        title="UmeTV Blog - News & Updates" 
        description="Read the latest news, updates, and safety tips from the UmeTV team." 
        url="https://umetvchat.web.app/blog" 
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
          <h2 className="text-4xl font-black text-slate-900 mb-8 border-b border-slate-200 pb-4">Ume Tv Blog</h2>
          <div className="space-y-12">
            <article className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm">
              <span className="text-sm font-bold text-sky-500 uppercase tracking-wider mb-2 block">August 2026</span>
              <h3 className="text-2xl font-bold text-slate-900 mb-4 mt-0">Welcome to the New Era of Random Chat</h3>
              <p className="text-slate-600 font-medium leading-relaxed mb-6">
                We are thrilled to announce the official launch of Ume Tv under the umbrella of BMR inc. Our team has worked tirelessly to build a platform that prioritizes user safety, high-definition video quality, and instant connectivity. Read about our journey and what we have planned for the future...
              </p>
              <button className="text-sky-500 font-bold hover:text-sky-600 transition-colors">Read full article →</button>
            </article>
            <article className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm">
              <span className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-2 block">July 2026</span>
              <h3 className="text-2xl font-bold text-slate-900 mb-4 mt-0">Staying Safe While Chatting Online</h3>
              <p className="text-slate-600 font-medium leading-relaxed mb-6">
                Your safety is our top priority. In this post, we break down our community-driven moderation tools, such as our report and block features, and provide five essential tips to ensure you have a secure and enjoyable experience while meeting strangers online.
              </p>
              <button className="text-sky-500 font-bold hover:text-sky-600 transition-colors">Read full article →</button>
            </article>
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
