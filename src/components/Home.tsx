import React, { useState, useEffect, useRef } from 'react';
import { Target, Shield, Globe, Zap, MessageCircle, Coins, PlaySquare, Heart, BarChart3 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Banner300x250Ad from './ads/Banner300x250Ad';
import NativeBannerAd from './ads/NativeBannerAd';
import SEO from './SEO';

import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';


interface HomeProps {
  onStart: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
}

const readError = (error: unknown): { code: string; message: string } => {
  if (typeof error === "object" && error !== null) {
    const value = error as { code?: unknown; message?: unknown };
    return {
      code: typeof value.code === "string" ? value.code : "unknown",
      message: typeof value.message === "string" ? value.message : "Unknown error"
    };
  }
  return { code: "unknown", message: "Unknown error" };
};

export default function Home({ onStart, onNavigate, currentPage }: HomeProps) {
  const [onlineCount, setOnlineCount] = useState(0);
  const [guestMode, setGuestMode] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [authError, setAuthError] = useState('');

  const [profileData, setProfileData] = useState({
    name: '',
    age: '',
    gender: '',
    interests: [] as string[]
  });
  

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setGuestMode(user.isAnonymous);
        // Check profile
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
                    try {
            setProfileData(prev => ({ ...prev, name: user.displayName || '' }));
          } catch (e) {
            console.error('Failed to init profile', e);
          }
        } else {
          const data = docSnap.data();
          const safeProfile = {
            name: typeof data.name === "string" ? data.name : "",
            age: typeof data.age === "string" ? data.age : "",
            gender: typeof data.gender === "string" ? data.gender : "",
            interests: Array.isArray(data.interests)
              ? data.interests.filter((item): item is string => typeof item === "string").slice(0, 20)
              : []
          };
          setProfileData(safeProfile);
          localStorage.setItem(`umetv_profile_${user.uid}`, JSON.stringify({
            name: safeProfile.name,
            interests: safeProfile.interests
          }));
        }
      } else {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("umetv_profile_")) localStorage.removeItem(key);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const saveProfile = async () => {
    const user = auth.currentUser;

    if (!user) {
      setAuthError('Firebase login session is not ready. Please wait a moment and try again.');
      console.error('[PROFILE] No authenticated Firebase user');
      return;
    }

    const isGuest = user.isAnonymous;
    const name = profileData.name.trim() || `Guest-${user.uid.slice(-6)}`;
    const gender = profileData.gender || (isGuest ? "prefer_not_to_say" : "");

    if ((!isGuest && !name) || !profileData.age || !gender) {
      setAuthError('Please fill in Name, Date of Birth, and Gender.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(profileData.age)) {
      setAuthError('Please enter a valid Date of Birth.');
      return;
    }

    const dob = new Date(`${profileData.age}T00:00:00.000Z`);
    if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== profileData.age) {
      setAuthError('Please enter a valid Date of Birth.');
      return;
    }

    const today = new Date();
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const birthdayPassed =
      today.getUTCMonth() > dob.getUTCMonth() ||
      (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() >= dob.getUTCDate());
    if (!birthdayPassed) age -= 1;

    if (age < 18) {
      setAuthError('You must be at least 18 years old to use UmeTV.');
      return;
    }

    const cleanInterests = Array.from(new Set(
      (Array.isArray(profileData.interests) ? profileData.interests : [])
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim().slice(0, 50))
        .filter(Boolean)
    )).slice(0, 20);

    if (name.length > 100 || profileData.gender.length > 32) {
      setAuthError('Please keep your profile information within the allowed limits.');
      return;
    }

    setAuthError('');

    const profile = {
      name,
      age: profileData.age,
      gender: gender || "prefer_not_to_say",
      interests: cleanInterests
    };

    try {
      console.log('[PROFILE] Saving for UID:', user.uid);

      await setDoc(
        doc(db, 'users', user.uid),
        profile,
        { merge: true }
      );

      const localProfileCache = {
        name: profile.name,
        interests: profile.interests
      };

      localStorage.setItem(
        `umetv_profile_${user.uid}`,
        JSON.stringify(localProfileCache)
      );

      setProfileData(profile);
      setShowProfileSetup(false);

      if (continueAfterProfileRef.current) {
        continueAfterProfileRef.current = false;
        window.setTimeout(() => {
          handleStartChatting();
        }, 0);
      }

      console.log('[PROFILE] SAVE SUCCESS');
    } catch (e) {
      console.error('[PROFILE] SAVE ERROR:', e);
      setAuthError(
        `${e?.code || 'unknown'}: ${e?.message || 'Failed to save profile'}`
      );
    }
  };

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const configuredSocketUrl = typeof import.meta.env.VITE_SOCKET_URL === "string"
          ? import.meta.env.VITE_SOCKET_URL.trim()
          : "";
        const socketUrl = configuredSocketUrl
          || (import.meta.env.DEV ? window.location.origin : "https://umetvchat.onrender.com");
        const res = await fetch(`${socketUrl}/api/online_users`);
        const data = await res.json();
        if (data.count !== undefined) {
          setOnlineCount(data.count); 
        }
      } catch (e) {
        // Silently fail if endpoint is not reachable
      }
    };
    
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const [showInterstitial, setShowInterstitial] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const continueAfterProfileRef = useRef(false);

  const handleStartChatting = async () => {
    if (isStartingChat) return;
    setAuthError('');

    try {
      let user = auth.currentUser;
      if (!user) {
        user = (await signInAnonymously(auth)).user;
      }

      const profileSnap = await getDoc(doc(db, 'users', user.uid));
      if (!profileSnap.exists() || typeof profileSnap.data()?.age !== 'string') {
        setGuestMode(user.isAnonymous);
        setProfileData(prev => ({
          name: prev.name || `Guest-${user.uid.slice(-6)}`,
          age: typeof profileSnap.data()?.age === 'string' ? profileSnap.data()?.age : '',
          gender: prev.gender || 'prefer_not_to_say',
          interests: prev.interests || []
        }));
        continueAfterProfileRef.current = true;
        setShowProfileSetup(true);
        setAuthError('Date of birth is required to confirm you are 18+ before random chat.');
        return;
      }

      setIsStartingChat(true);
      setShowInterstitial(true);
      setTimeout(() => {
        setShowInterstitial(false);
        setIsStartingChat(false);
        onStart();
      }, 1500);
    } catch (error: unknown) {
      const { code, message } = readError(error);
      console.error("[GUEST] session start failed:", code);
      setAuthError(code === "auth/admin-restricted-operation"
        ? "Guest mode is not enabled in Firebase yet. Enable Anonymous Authentication in Firebase Console."
        : message);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-slate-900 flex flex-col relative">
      <SEO url="https://umetvchat.web.app/" />

      {/* Header */}
      <header className="px-4 sm:px-6 py-1.5 sm:py-2 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <h1 className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
          <img src="/icon.png" alt="Ume Tv Logo" width="102" height="72" className="h-10 sm:h-12 w-auto object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) { (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'; } }} />
          <div style={{ display: 'none' }} className="items-center gap-2 text-xl sm:text-2xl font-black tracking-tight text-slate-800">
             <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-sky-500" />
             Ume Tv
          </div>
        </h1>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <button onClick={() => window.location.href = "/stats"} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" title="Stats & leaderboard"><BarChart3 className="w-5 h-5" /></button>
            <button onClick={() => window.location.href = "/favorites"} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" title="Favorites"><Heart className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
            {onlineCount.toLocaleString()} Online
          </div>
        </div>
      </header>

      {/* Interstitial Ad Modal */}
      {showInterstitial && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4">
          <div className="text-white text-lg font-bold mb-6 flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Connecting to a stranger...
          </div>
          <div className="bg-white rounded-xl overflow-hidden w-full max-w-md h-[300px] shadow-2xl relative">
            <Banner300x250Ad />
            <div className="absolute top-2 right-2 text-xs font-bold text-slate-400 bg-white/80 px-2 py-1 rounded">Advertisement</div>
          </div>
        </div>
      )}

      {/* Profile Setup Modal */}
      {showProfileSetup && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xl font-black text-slate-800">
                Quick age confirmation
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                No login or signup is required. Confirm you are 18+ to continue.
              </p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {authError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                  {authError}
                </div>
              )}
              
              <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4 text-sm text-slate-600 font-medium">
                Your chat session is anonymous. We only need your date of birth to confirm that you are 18 or older.
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Date of Birth <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  value={profileData.age}
                  onChange={(e) => setProfileData({...profileData, age: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all" 
                />
              </div>

              <button onClick={saveProfile} className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-lg transition-all shadow-md mt-2">
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}


      <main className="flex-1 flex flex-col items-center">
        {currentPage === 'home' && (
          <>
            {/* Hero Section */}
        <section className="w-full max-w-4xl mx-auto px-4 py-10 sm:py-16 md:py-24 flex flex-col items-center text-center">
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-6 leading-[1.1]">
            Ready to meet <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-500">someone new?</span>
          </h2>
          
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed font-medium px-4">
            Ume Tv makes it easy to chat with strangers in random video or text chats. It's simple, fast, and time to start mingling!
          </p>

          <div className="text-xl sm:text-2xl font-bold text-sky-600 mb-6 flex items-center justify-center gap-3 animate-pulse">
            🎮 Play games With Strangers
          </div>

          <div className="w-full max-w-lg bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6 relative">
            <button
              onClick={handleStartChatting}
              className="w-full py-4 sm:py-5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-lg sm:text-xl transition-all shadow-md shadow-sky-500/20 hover:shadow-lg hover:shadow-sky-500/30 transform hover:-translate-y-0.5 active:translate-y-0 mt-2"
            >
              Start chatting
            </button>

            <div className="text-sm font-semibold text-slate-500 text-center flex items-center justify-center gap-2">
              <span className="text-xl">💬</span>
              Chats are moderated. Please keep it respectful
            </div>
          </div>
          
          <div className="w-full max-w-4xl mx-auto mt-12 bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left mb-2">Advertisement</p>
            <NativeBannerAd />
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full bg-white py-20 sm:py-28 border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-sky-50 text-sky-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-sky-100 transform -rotate-3 hover:rotate-0 transition-transform">
                <Target className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Interest-Based Matching</h3>
              <p className="text-slate-600 font-medium leading-relaxed">Connect with people who share your passions and hobbies instantly.</p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-emerald-100 transform rotate-3 hover:rotate-0 transition-transform">
                <Shield className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Active Moderation</h3>
              <p className="text-slate-600 font-medium leading-relaxed">You can easily report and block inappropriate users to maintain a safe environment.</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-indigo-100 transform -rotate-3 hover:rotate-0 transition-transform">
                <Globe className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Global Community</h3>
              <p className="text-slate-600 font-medium leading-relaxed">Meet fascinating people from all over the world at any time of day.</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-amber-100 transform rotate-3 hover:rotate-0 transition-transform">
                <Zap className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Instant & Anonymous</h3>
              <p className="text-slate-600 font-medium leading-relaxed">No signups required. Jump right into the conversation anonymously.</p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="w-full max-w-3xl mx-auto px-6 py-20 sm:py-28">
          <h2 className="text-3xl sm:text-4xl font-black text-center text-slate-900 mb-12">Frequently Asked Questions</h2>
          <div className="flex flex-col gap-4">
            <FaqItem 
              question="How does interest matching work?" 
              answer="Simply type in a few keywords about things you like. We'll prioritize connecting you with someone who has typed similar interests. If no match is found quickly, we'll connect you with a random friendly stranger."
            />
            <FaqItem 
              question="How does Ume Tv help keep chats safer?" 
              answer="We provide easy in-app reporting tools so you can flag bad actors instantly, keeping the community safe."
            />
            <FaqItem 
              question="Why choose Ume Tv to chat with strangers online?" 
              answer="Ume Tv offers a modern, blazing-fast, and secure platform. Unlike older alternatives, we focus heavily on UI/UX, video quality, and active community moderation to ensure a positive experience."
            />
            <FaqItem 
              question="Can I use Ume Tv on my phone?" 
              answer="Absolutely! Ume Tv is fully responsive and works perfectly on your mobile browser, complete with camera and microphone support."
            />
          </div>
        </section>
        </>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full bg-slate-950 text-slate-400 py-16 px-6 border-t border-slate-900">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="cursor-pointer" onClick={() => { window.open('https://www.effectivecpmnetwork.com/vjz9xam93?key=e92738b1a6e698a33e71bf7b5bf846bf', '_blank'); onNavigate('home'); }}>
              <img src="/icon.png" alt="Ume Tv Logo" width="102" height="72" className="h-20 md:h-24 w-auto object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) { (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'; } }} />
              <div style={{ display: 'none' }} className="items-center gap-2 text-white font-bold text-2xl tracking-tight">
                <MessageCircle className="w-7 h-7 text-sky-500" />
                Ume Tv
              </div>
            </div>
            <div className="text-sm font-medium text-center md:text-left">
              <p>© 2026 umetvchat.web.app</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-semibold">
            <a href="/about" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">About</a>
            <a href="/blog" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Blog</a>
            <a href="/rules" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Rules</a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Terms</a>
            <a href="/privacypolicy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 text-left font-bold text-slate-800 flex justify-between items-center focus:outline-none focus:bg-slate-50"
      >
        <span className="text-lg pr-4">{question}</span>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 transform transition-transform duration-300 ${isOpen ? 'rotate-180 bg-sky-50 text-sky-500' : ''}`}>
          ▼
        </div>
      </button>
      <div 
        className={`px-6 text-slate-600 font-medium leading-relaxed border-t border-slate-100 transition-all duration-300 overflow-hidden ${isOpen ? 'py-5 opacity-100 max-h-96' : 'max-h-0 opacity-0 border-t-0'}`}
      >
        {answer}
      </div>
    </div>
  );
}
