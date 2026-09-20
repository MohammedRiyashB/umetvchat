import React, { useEffect, useState } from "react";
import { Trophy, Target, Flame, Star, ArrowLeft, Medal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SEO from "./SEO";
import { apiFetch } from "../lib/api";
import { auth } from "../lib/firebase";

type StatsResponse = {
  stats: { played: number; wins: number; losses: number; draws: number; points: number; winStreak: number; bestWinStreak: number };
  achievements: string[];
};

type LeaderboardRow = {
  uid: string;
  name: string;
  points: number;
  wins: number;
  played: number;
  bestWinStreak: number;
};

const achievementLabels: Record<string, string> = {
  first_game: "First Game",
  first_win: "First Win",
  ten_wins: "10 Wins",
  twenty_five_wins: "25 Wins",
  five_win_streak: "5-Win Streak",
};

export default function Stats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!auth.currentUser) {
          setError("Start a guest session from the home page to view your stats.");
          return;
        }
        const [mine, leaderboard] = await Promise.all([
          apiFetch<StatsResponse>("/api/me/stats"),
          apiFetch<{ leaderboard: LeaderboardRow[] }>("/api/leaderboard"),
        ]);
        if (!active) return;
        setStats(mine);
        setLeaders(leaderboard.leaderboard);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load stats");
      }
    };
    load();
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white">
      <SEO title="UmeTV Stats & Leaderboard" description="UmeTV game statistics, achievements and leaderboard." url="https://umetvchat.web.app/stats" />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur px-4 py-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-300 hover:text-white font-bold">
          <ArrowLeft className="w-5 h-5" /> Home
        </button>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
        <section>
          <h1 className="text-3xl sm:text-4xl font-black">Stats & Achievements</h1>
          <p className="mt-2 text-slate-400">Game results are recorded server-side for authenticated and guest sessions.</p>
        </section>

        {error && <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-200">{error}</div>}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Played", stats.stats.played, Target],
              ["Wins", stats.stats.wins, Trophy],
              ["Points", stats.stats.points, Star],
              ["Best Streak", stats.stats.bestWinStreak, Flame],
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                {React.createElement(Icon as React.ElementType, { className: "w-6 h-6 text-sky-400 mb-3" })}
                <div className="text-2xl font-black">{value as number}</div>
                <div className="text-sm text-slate-400">{label}</div>
              </div>
            ))}
          </div>
        )}

        {stats && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-black flex items-center gap-2"><Medal className="w-5 h-5 text-yellow-400" /> Achievements</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {stats.achievements.length ? stats.achievements.map((id) => (
                <span key={id} className="rounded-full bg-sky-400/10 border border-sky-400/20 px-3 py-2 text-sm font-bold text-sky-200">{achievementLabels[id] || id}</span>
              )) : <span className="text-sm text-slate-400">Play a game to unlock achievements.</span>}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h2 className="text-xl font-black flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" /> Leaderboard</h2>
          </div>
          <div className="divide-y divide-white/10">
            {leaders.map((row, index) => (
              <div key={row.uid} className="grid grid-cols-[40px_1fr_auto] gap-3 items-center px-5 py-4">
                <div className="text-slate-500 font-black">#{index + 1}</div>
                <div>
                  <div className="font-bold">{row.name}</div>
                  <div className="text-xs text-slate-500">{row.wins} wins · {row.played} played · best streak {row.bestWinStreak}</div>
                </div>
                <div className="text-right font-black text-sky-300">{row.points} pts</div>
              </div>
            ))}
            {!leaders.length && <div className="p-6 text-center text-slate-500">No ranked game results yet.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
