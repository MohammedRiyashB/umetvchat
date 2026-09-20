import React, { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck, Ban, AlertTriangle, Clock3, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { apiFetch } from "../lib/api";
import SEO from "./SEO";

type Report = { id: string; reporterId: string; reportedUserId: string; category: string; status: string; createdAt: string | null };
type AdminStats = { onlineUsers: number; queueLength: number; activeGames: number; connectedSockets: number };

export default function Admin() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (!auth.currentUser) await signInWithPopup(auth, googleProvider);
      const [reportData, statsData] = await Promise.all([
        apiFetch<{ reports: Report[] }>("/api/admin/reports"),
        apiFetch<AdminStats>("/api/admin/stats"),
      ]);
      setReports(reportData.reports);
      setStats(statsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Moderator access was denied.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const resolveReport = async (id: string, status: "resolved" | "dismissed") => {
    try {
      await apiFetch("/api/admin/reports/" + encodeURIComponent(id), {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update report");
    }
  };

  const moderate = async (uid: string, action: "warn" | "suspend" | "ban" | "unban") => {
    const reason = window.prompt("Reason for moderation action:", "Community rules");
    if (reason === null) return;
    const duration = action === "suspend" ? Number(window.prompt("Suspension length in minutes:", "60") || "60") : undefined;
    try {
      await apiFetch("/api/admin/users/" + encodeURIComponent(uid) + "/action", {
        method: "POST",
        body: JSON.stringify({ action, reason, durationMinutes: duration }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white">
      <SEO title="UmeTV Moderator Console" description="UmeTV safety and moderation console." url="https://umetvchat.web.app/admin" />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur px-4 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-300 hover:text-white font-bold"><ArrowLeft className="w-5 h-5" /> Home</button>
        <button onClick={() => void load()} className="p-2 rounded-xl hover:bg-white/10" title="Refresh"><RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /></button>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
        <section className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300"><ShieldCheck className="w-7 h-7" /></div>
          <div><h1 className="text-3xl font-black">Moderator Console</h1><p className="text-slate-400 mt-1">Review reports and apply safety actions. Access is restricted by Firebase custom claims or ADMIN_UIDS.</p></div>
        </section>
        {stats && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[
          ["Online", stats.onlineUsers], ["Queue", stats.queueLength], ["Games", stats.activeGames], ["Sockets", stats.connectedSockets]
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-2xl font-black">{value}</div><div className="text-sm text-slate-500">{label}</div></div>)}</div>}
        {error && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</div>}
        <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/10"><h2 className="text-xl font-black">Open Reports</h2></div>
          <div className="divide-y divide-white/10">
            {reports.map((report) => (
              <div key={report.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-red-500/10 text-red-300 px-3 py-1 font-bold">{report.category}</span>
                  <span className="text-slate-500">{report.createdAt ? new Date(report.createdAt).toLocaleString() : "Unknown time"}</span>
                </div>
                <div className="text-xs text-slate-500 break-all">Reported user: {report.reportedUserId}<br />Reporter: {report.reporterId}</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void moderate(report.reportedUserId, "warn")} className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-200 font-bold text-sm flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Warn</button>
                  <button onClick={() => void moderate(report.reportedUserId, "suspend")} className="px-3 py-2 rounded-xl bg-sky-500/10 text-sky-200 font-bold text-sm flex items-center gap-1"><Clock3 className="w-4 h-4" /> Suspend</button>
                  <button onClick={() => void moderate(report.reportedUserId, "ban")} className="px-3 py-2 rounded-xl bg-red-500/10 text-red-200 font-bold text-sm flex items-center gap-1"><Ban className="w-4 h-4" /> Ban</button>
                  <button onClick={() => void moderate(report.reportedUserId, "unban")} className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-200 font-bold text-sm">Unban</button>
                  <button onClick={() => void resolveReport(report.id, "resolved")} className="px-3 py-2 rounded-xl bg-white/10 text-white font-bold text-sm">Resolve</button>
                  <button onClick={() => void resolveReport(report.id, "dismissed")} className="px-3 py-2 rounded-xl bg-white/5 text-slate-300 font-bold text-sm">Dismiss</button>
                </div>
              </div>
            ))}
            {!reports.length && <div className="p-10 text-center text-slate-500">No reports available.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
