import React, { useEffect, useState } from "react";
import { ArrowLeft, Heart, UserRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SEO from "./SEO";
import { apiFetch } from "../lib/api";
import { auth } from "../lib/firebase";

type Favorite = { uid: string; name: string };

export default function Favorites() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!auth.currentUser) {
          setError("Start a guest session from the home page to use favorites.");
          return;
        }
        const data = await apiFetch<{ favorites: Favorite[] }>("/api/me/favorites");
        if (active) setFavorites(data.favorites);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load favorites");
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const removeFavorite = async (uid: string) => {
    try {
      await apiFetch("/api/me/favorites/" + encodeURIComponent(uid), { method: "DELETE" });
      setFavorites(prev => prev.filter(item => item.uid !== uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove favorite");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <SEO title="UmeTV Favorites" description="Your saved UmeTV chat connections." url="https://umetvchat.web.app/favorites" />
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold">
          <ArrowLeft className="w-5 h-5" /> Home
        </button>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-black">Favorites</h1>
        <p className="mt-2 text-slate-500">People you saved while chatting.</p>
        {error && <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700">{error}</div>}
        <div className="mt-6 space-y-3">
          {favorites.map((favorite) => (
            <div key={favorite.uid} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center"><UserRound className="w-6 h-6" /></div>
              <div className="flex-1"><div className="font-black">{favorite.name}</div><div className="text-xs text-slate-400">Saved connection</div></div>
              <button onClick={() => void removeFavorite(favorite.uid)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-red-500" title="Remove favorite">
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
          {!favorites.length && !error && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No favorites yet. Star a stranger during a chat to save them.</div>}
        </div>
      </main>
    </div>
  );
}
