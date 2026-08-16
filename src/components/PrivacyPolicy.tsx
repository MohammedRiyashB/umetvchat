import React from 'react';
import { Shield, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from './SEO';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center">
      <SEO 
        title="Privacy Policy - UmeTV" 
        description="Read the Privacy Policy for UmeTV to understand how we protect your data." 
        url="https://umetvchat.web.app/privacypolicy" 
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
          <h2 className="text-4xl font-black text-slate-900 mb-8 border-b border-slate-200 pb-4">Privacy Policy</h2>
          <div className="prose prose-slate max-w-none text-slate-700 font-medium leading-relaxed space-y-6">
            <p><strong>Effective Date:</strong> August 2026</p>
            <p>
              At Ume Tv (operated by BMR inc.), your privacy is of the utmost importance to us. This Privacy Policy outlines the types of information we collect, how it is used, and the steps we take to protect your personal data.
            </p>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">1. Information We Collect</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Automatically Collected Information:</strong> We may log standard technical information, such as your browser type and operating system, to facilitate the connection between users.</li>
              <li><strong>Voluntary Information:</strong> If you create a profile, we store your name, age, gender, region, and optional interests in our secure database to facilitate matchmaking and personalize your experience. This data is linked to your account if you choose to sign in.</li>
              <li><strong>Camera and Microphone Data:</strong> We require access to your camera and microphone to enable video chatting. <strong>We do not record, store, or intercept your video or audio streams.</strong> Connections are established via WebRTC, meaning data is transmitted peer-to-peer whenever possible.</li>
            </ul>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">2. How We Use Information</h3>
            <p>The information collected is used solely for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide, maintain, and improve the Ume Tv service.</li>
              <li>To enforce our Community Rules by implementing account-level blocking and reporting mechanisms to maintain a safe environment.</li>
              <li>To monitor general usage statistics (e.g., active user counts) without identifying individual users.</li>
            </ul>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">3. Data Security</h3>
            <p>We implement industry-standard security measures to protect against unauthorized access to or unauthorized alteration, disclosure, or destruction of data. However, no internet transmission is completely secure, and we cannot guarantee absolute security.</p>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">4. Third-Party Services</h3>
            <p>We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties. This does not include trusted third parties who assist us in operating our website, conducting our business, or servicing you, so long as those parties agree to keep this information confidential.</p>

            <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">5. Contact Us</h3>
            <p>If you have any questions regarding this Privacy Policy, please contact us at support@umetvchat.web.app.</p>
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
