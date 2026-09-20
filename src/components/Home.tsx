import React, { useState, useEffect } from 'react';
import { Target, Shield, Globe, Zap, MessageCircle, Coins, X, PlaySquare, LogOut } from 'lucide-react';
import { auth, googleProvider, db } from '../lib/firebase';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import Banner300x250Ad from './ads/Banner300x250Ad';
import NativeBannerAd from './ads/NativeBannerAd';
import SEO from './SEO';

import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';


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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [authError, setAuthError] = useState('');

  const [profileData, setProfileData] = useState({
    name: '',
    age: '',
    gender: '',
    interests: [] as string[]
  });
  
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        // Check profile
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
                    try {
            setProfileData(prev => ({ ...prev, name: user.displayName || '' }));
          } catch (e) {
            console.error('Failed to init profile', e);
          }
          setShowProfileSetup(true);
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
        setIsLoggedIn(false);
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("umetv_profile_")) localStorage.removeItem(key);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const isGoogle = auth.currentUser && !auth.currentUser.isAnonymous;

  const saveProfile = async () => {
    const user = auth.currentUser;

    if (!user) {
      setAuthError('Firebase login session is not ready. Please wait a moment and try again.');
      console.error('[PROFILE] No authenticated Firebase user');
      return;
    }

    const name = profileData.name.trim();

    if (!name || !profileData.age || !profileData.gender) {
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
      gender: profileData.gender,
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

      console.log('[PROFILE] SAVE SUCCESS');
    } catch (e) {
      console.error('[PROFILE] SAVE ERROR:', e);
      setAuthError(
        `${e?.code || 'unknown'}: ${e?.message || 'Failed to save profile'}`
      );
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      setResetMessage("Please enter your email.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage("Password reset email sent! Check your inbox.");
    } catch (error: unknown) {
      setResetMessage(readError(error).message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthError('');
      await signInWithPopup(auth, googleProvider);
      setShowAuth(false);
    } catch (error: unknown) {
      const { code, message } = readError(error);
      console.error("[AUTH] sign-in failed:", code);
      setAuthError(message);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setAuthError('');
      await signInAnonymously(auth);
      setShowAuth(false);
    } catch (error: unknown) {
      const { code, message } = readError(error);
      console.error("[AUTH] anonymous sign-in failed:", code);
      setAuthError(code + ": " + message);
    }
  };

  const handleEmailAuth = async () => {
    try {
      setAuthError('');
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (e: unknown) {
        const { code } = readError(e);
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
          try {
            await createUserWithEmailAndPassword(auth, email, password);
          } catch (createErr: unknown) {
            if (readError(createErr).code === 'auth/email-already-in-use') {
              throw new Error("Invalid password for this account.");
            }
            throw createErr;
          }
        } else {
          throw e;
        }
      }
      setShowAuth(false);
    } catch (error: unknown) {
      const { code, message } = readError(error);
      console.error("[AUTH] email auth failed:", code);
      setAuthError(code + ": " + message);
    }
  };

  const handleLogout = async () => {
    const uid = auth.currentUser?.uid;
    await signOut(auth);
    if (uid) localStorage.removeItem(`umetv_profile_${uid}`);
  }

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const confirmed = window.confirm(
      "Delete your UmeTV account and profile? This permanently removes your profile data. Moderation reports may be retained for safety/legal purposes."
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "users", user.uid));
      try {
        await deleteDoc(doc(db, "blocks", user.uid));
      } catch {
        // Block documents may be protected by server-side/admin rules.
      }
      localStorage.removeItem(`umetv_profile_${user.uid}`);
      await deleteUser(user);
      setShowProfile(false);
      setProfileData({ name: "", age: "", gender: "", interests: [] });
      setIsLoggedIn(false);
    } catch (error: unknown) {
      const { code } = readError(error);
      console.error("[ACCOUNT] Delete failed:", code);
      setAuthError(
        code === "auth/requires-recent-login"
          ? "For security, please sign in again before deleting your account."
          : "We could not delete your account. Please try again."
      );
    }
  }

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SOCKET_URL || ''}/api/online_users`);
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

  const handleStartChatting = () => {
    if (isStartingChat) return;
    
    setIsStartingChat(true);
    // Show interstitial ad before starting chat
    setShowInterstitial(true);
    setTimeout(() => {
      setShowInterstitial(false);
      setIsStartingChat(false);
      onStart();
    }, 3000);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-slate-900 flex flex-col relative">
      <SEO url="https://umetvchat.web.app/" />

      {/* Header */}
      <header className="px-4 sm:px-6 py-1.5 sm:py-2 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <h1 className="flex items-center gap-2 cursor-pointer" onClick={() => { window.open('https://www.effectivecpmnetwork.com/vjz9xam93?key=e92738b1a6e698a33e71bf7b5bf846bf', '_blank'); onNavigate('home'); }}>
          <img src="/icon.png" alt="Ume Tv Logo" width="102" height="72" className="h-10 sm:h-12 w-auto object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) { (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'; } }} />
          <div style={{ display: 'none' }} className="items-center gap-2 text-xl sm:text-2xl font-black tracking-tight text-slate-800">
             <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-sky-500" />
             Ume Tv
          </div>
        </h1>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 transition-colors"
              >
                {auth.currentUser?.photoURL ? (
                  <img src={auth.currentUser.photoURL} alt="Profile" width="24" height="24" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold">
                    {profileData.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="text-sm font-bold text-slate-700 hidden sm:block">{profileData.name || 'Profile'}</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="text-sm font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 px-4 py-2 rounded-full border border-sky-200 transition-colors"
            >
              Login / Signup
            </button>
          )}
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

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-800">
                Welcome to Ume Tv
              </h3>
              <button 
                onClick={() => setShowAuth(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {authError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                  {authError}
                </div>
              )}
              
              <button onClick={handleGoogleLogin} className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              
              <button onClick={handleGuestLogin} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">
                Continue as Guest
              </button>
              
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-slate-200"></div>
                <div className="text-sm font-semibold text-slate-400">OR</div>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              <div className="flex flex-col gap-3">
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all" 
                />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all" 
                />
                
                <div className="flex justify-end">
                  <button onClick={() => setShowForgotPassword(true)} className="text-sm font-bold text-sky-500 hover:text-sky-600 transition-colors">
                    Forgot password? Reset
                  </button>
                </div>

                <button onClick={handleEmailAuth} className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-lg transition-all shadow-md mt-2">
                  Login or Signup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-800">
                Reset Password
              </h3>
              <button 
                onClick={() => { setShowForgotPassword(false); setResetMessage(""); }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {resetMessage && (
                <div className={`p-3 text-sm font-medium rounded-lg border ${resetMessage.includes("sent") ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                  {resetMessage}
                </div>
              )}
              <input 
                type="email" 
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Enter your email" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all" 
              />
              <button onClick={handlePasswordReset} className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-lg transition-all shadow-md mt-2">
                Send Reset Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Setup Modal */}
      {showProfileSetup && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xl font-black text-slate-800">
                Complete Your Profile
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Tell us a bit about yourself</p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {authError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                  {authError}
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={profileData.name}
                  onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                  
                  placeholder="Your Name" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all" 
                />
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

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Gender <span className="text-red-500">*</span></label>
                <select
                  value={profileData.gender}
                  onChange={(e) => setProfileData({...profileData, gender: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5em 1.5em' }}
                >
                  <option value="" disabled>Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Interests (Tags)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {['Music', 'Gaming', 'Football', 'Anime', 'Technology', 'Movies', 'Sports'].map(tag => (
                    <button 
                      key={tag}
                      onClick={() => {
                        if (profileData.interests.includes(tag)) {
                          setProfileData(prev => ({ ...prev, interests: prev.interests.filter(t => t !== tag) }));
                        } else {
                          setProfileData(prev => ({ ...prev, interests: [...prev.interests, tag] }));
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${profileData.interests.includes(tag) ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={saveProfile} className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-lg transition-all shadow-md mt-2">
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfile && !showProfileSetup && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col relative">
            <button 
                onClick={() => {
                  setShowProfile(false);
                  handleLogout();
                }}
                className="absolute top-4 left-4 bg-white/50 hover:bg-red-50 rounded-full p-2 transition-colors z-10 group"
              >
                <LogOut className="w-5 h-5 text-red-500 group-hover:text-red-600" />
            </button>
            <button 
                onClick={() => setShowProfile(false)}
                className="absolute top-4 right-4 bg-white/50 hover:bg-slate-100 rounded-full p-2 transition-colors z-10"
              >
                <X className="w-5 h-5 text-slate-600" />
            </button>
            <div className="p-8 pb-6 flex flex-col items-center bg-gradient-to-b from-sky-50 to-white">
               {auth.currentUser?.photoURL ? (
                 <img src={auth.currentUser.photoURL} alt="Profile" width="96" height="96" className="w-24 h-24 rounded-full border-4 border-white shadow-lg mb-4" />
               ) : (
                 <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-sky-100 text-sky-600 flex items-center justify-center text-4xl font-black mb-4">
                   {profileData.name?.[0]?.toUpperCase() || 'U'}
                 </div>
               )}
               <h3 className="text-2xl font-black text-slate-800">{profileData.name || 'Anonymous User'}</h3>
               
            </div>
            
            <div className="px-8 pb-8 pt-2 flex flex-col gap-4">
               <div className="flex justify-between items-center py-3 border-b border-slate-100">
                 <span className="text-sm font-bold text-slate-400">Gender</span>
                 <span className="text-sm font-bold text-slate-700 capitalize">{profileData.gender || '-'}</span>
               </div>
               <div className="flex justify-between items-center py-3 border-b border-slate-100">
                 <span className="text-sm font-bold text-slate-400">Date of Birth</span>
                 <span className="text-sm font-bold text-slate-700">{profileData.age || '-'}</span>
               </div>
               
               <div className="flex flex-col gap-2 py-3">
                 <span className="text-sm font-bold text-slate-400">Interests</span>
                 <div className="flex flex-wrap gap-2">
                   {profileData.interests && profileData.interests.length > 0 ? profileData.interests.map(tag => (
                     <span key={tag} className="bg-sky-50 text-sky-600 border border-sky-100 px-3 py-1 rounded-full text-xs font-bold">{tag}</span>
                   )) : <span className="text-sm font-medium text-slate-500">No interests selected</span>}
                 </div>
               </div>
               
               <button 
                 onClick={() => { setShowProfile(false); setShowProfileSetup(true); }}
                 className="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
               >
                 Edit Profile
               </button>
               <button
                 onClick={handleDeleteAccount}
                 className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold transition-colors"
               >
                 Delete Account
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
