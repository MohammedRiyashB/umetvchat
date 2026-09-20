import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from './SEO';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center">
      <SEO 
        title="Terms of Service - UmeTV" 
        description="Read the Terms of Service for using UmeTV." 
        url="https://umetvchat.web.app/terms" 
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
          <h2 className="text-4xl font-black text-slate-900 mb-8 border-b border-slate-200 pb-4">Terms of Service</h2>
          <div className="prose prose-slate max-w-none text-slate-700 font-medium leading-relaxed space-y-6">
            <p><strong>Effective Date:</strong> September 20, 2026</p>
            <p>
              Welcome to Ume Tv, operated by BMR inc. By accessing or using our website and services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
            
            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">1. Acceptance of Terms</h3>
            <p>UmeTV is intended only for users aged 18 years or older. Users may start in guest mode without creating an email/password or Google login, but the service still requires a valid date of birth and the server checks the declared age before matchmaking. Users remain responsible for providing truthful information.</p>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">2. User Conduct</h3>
            <p>You agree to use Ume Tv strictly in accordance with our Community Rules. You are solely responsible for your conduct and any data, text, information, usernames, graphics, photos, profiles, audio and video clips, links that you submit, post, and display on Ume Tv.</p>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">3. Moderation and Enforcement</h3>
            <p>We provide reporting, blocking, favorites, automated abuse protections, rate limits, and moderator controls. We may warn, restrict, suspend, or terminate access for violations, abuse, fraud, spam, or attempts to circumvent safety controls.</p>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">4. Privacy and Data</h3>
            <p>Our collection and use of guest-session, profile, safety, favorites, game-statistics, and technical information are described in the Privacy Policy. UmeTV does not intentionally record video or audio conversations.</p>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">5. Disclaimers</h3>
            <p>The service is provided "as is" and "as available". BMR inc. makes no warranties, expressed or implied, regarding the continuous availability or reliability of the service.</p>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">6. Limitation of Liability</h3>
            <p>In no event shall BMR inc. or its founder be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.</p>
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
