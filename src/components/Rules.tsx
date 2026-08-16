import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from './SEO';

export default function Rules() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center">
      <SEO 
        title="Community Rules - UmeTV" 
        description="Read the community rules for UmeTV to ensure a safe and enjoyable experience for everyone." 
        url="https://umetvchat.web.app/rules" 
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
          <h2 className="text-4xl font-black text-slate-900 mb-8 border-b border-slate-200 pb-4">Community Rules</h2>
          <div className="prose prose-slate max-w-none text-slate-700 font-medium leading-relaxed space-y-6 text-lg">
            <p>
              To ensure that Ume Tv remains a welcoming, safe, and enjoyable platform for users worldwide, we strictly enforce the following community rules. Violations will result in temporary or permanent bans.
            </p>
            
            <div className="space-y-8 mt-8">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2 mt-0">
                  <span className="text-2xl">🤝</span> 1. Be Respectful
                </h3>
                <p className="text-slate-600 mb-0">Treat everyone with kindness. Harassment, bullying, hate speech, racism, and discrimination of any kind are strictly prohibited and will result in an immediate ban.</p>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2 mt-0">
                  <span className="text-2xl">🔞</span> 2. No Nudity or Explicit Content
                </h3>
                <p className="text-slate-600 mb-0">Ume Tv is a clean platform. Nudity, sexually explicit acts, or broadcasting inappropriate content on your camera is forbidden. If explicit content is encountered, please use the report button to block the user immediately.</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2 mt-0">
                  <span className="text-2xl">🔒</span> 3. Protect Personal Information
                </h3>
                <p className="text-slate-600 mb-0">Do not share sensitive personal information (such as your home address, phone number, financial details, or social security numbers). Do not ask others for their private information.</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2 mt-0">
                  <span className="text-2xl">🚫</span> 4. No Spam or Advertising
                </h3>
                <p className="text-slate-600 mb-0">Using Ume Tv to advertise products, services, other websites, or to spam users with repetitive messages is not allowed.</p>
              </div>
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
