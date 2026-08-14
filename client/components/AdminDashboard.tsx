import { useState } from "react";
import { ArrowUpRight, BarChart3, ClipboardCheck, Clock3, Download, FileAudio, FileText, Gauge, GitCompareArrows, LogOut, Menu as MenuIcon, Play, Settings2, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import type { EvaluationRecord, View } from "@/pages/Index";

type AdminDashboardProps = {
  evaluations: EvaluationRecord[];
  goTo: (view: View) => void;
  logout: () => void;
};

type AdminMenuId = "users" | "submissions" | "transcriptions" | "analytics" | "accent" | "reports";

const menu = [
  { id: "users" as AdminMenuId, label: "Users", icon: Users, target: "admin-users" },
  { id: "submissions" as AdminMenuId, label: "Audio submissions", icon: FileAudio, target: "admin-submissions" },
  { id: "transcriptions" as AdminMenuId, label: "Transcriptions", icon: FileText, target: "admin-transcriptions" },
  { id: "analytics" as AdminMenuId, label: "Analytics", icon: BarChart3, target: "admin-analytics" },
  { id: "accent" as AdminMenuId, label: "Accent analysis", icon: GitCompareArrows, target: "admin-accent-analysis" },
  { id: "reports" as AdminMenuId, label: "Reports", icon: ClipboardCheck, target: "admin-reports" },
];

const demoUsers = [
  { name: "user123", email: "user123@example.com", status: "Active", samples: 32 },
  { name: "user124", email: "user124@example.com", status: "Active", samples: 24 },
  { name: "user125", email: "user125@example.com", status: "Review", samples: 18 },
];

const audioFiles = [
  { name: "audio_001.wav", accent: "Indian English", duration: "00:04" },
  { name: "audio_002.wav", accent: "British English", duration: "00:05" },
  { name: "audio_003.wav", accent: "American English", duration: "00:06" },
  { name: "audio_004.wav", accent: "Nigerian English", duration: "00:08" },
];

function BrandMark() {
  return <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#493879] to-[#8b5bc4] text-white shadow-sm"><span className="text-[13px] font-black">∿</span></div>;
}

function downloadReport(evaluations: EvaluationRecord[]) {
  const header = "User,Email,File,Accent,Language,Baseline WER,Fine-tuned WER,Status,Created at";
  const lines = evaluations.map((item) => [item.ownerName, item.ownerEmail, item.fileName, item.accent, item.language, item.baselineWer, item.tunedWer, item.status, item.createdAt].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
  const url = URL.createObjectURL(new Blob([[header, ...lines].join("\n")], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "admin-evaluation-report.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  toast.success("Admin report downloaded.");
}

export default function AdminDashboard({ evaluations, goTo, logout }: AdminDashboardProps) {
  const [activeMenu, setActiveMenu] = useState<AdminMenuId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const rows = evaluations.length ? evaluations.slice(0, 4) : [
    { id: "a", ownerName: "user123", ownerEmail: "user123@example.com", accent: "Indian English", baselineWer: "14.20%", tunedWer: "10.80%", status: "complete" as const, fileName: "weather_sample.wav", language: "en-IN", transcript: "The weather is lovely today", createdAt: "Today" },
    { id: "b", ownerName: "user124", ownerEmail: "user124@example.com", accent: "British English", baselineWer: "8.10%", tunedWer: "6.90%", status: "complete" as const, fileName: "meeting_sample.wav", language: "en-GB", transcript: "Could you send the report over?", createdAt: "Yesterday" },
    { id: "c", ownerName: "user125", ownerEmail: "user125@example.com", accent: "American English", baselineWer: "7.90%", tunedWer: "6.40%", status: "complete" as const, fileName: "report_sample.wav", language: "en-US", transcript: "We are meeting after lunch", createdAt: "Yesterday" },
  ];
  const metrics = [
    { label: "Total users", value: String(new Set(evaluations.map((item) => item.ownerEmail)).size + 12), trend: "+13%", icon: Users },
    { label: "Total submissions", value: String(evaluations.length + 156), trend: "+18%", icon: FileAudio },
    { label: "Avg WER", value: "13.24%", trend: "−2.1%", icon: Gauge },
    { label: "Avg processing time", value: "2.45 sec", trend: "−3%", icon: Clock3 },
  ];
  const errors = ["the weather is quiet beautiful today", "available", "comfortable", "tomorrow", "available"];
  const currentLabel = menu.find((item) => item.id === activeMenu)?.label ?? "Overview";

  const selectMenu = (item: typeof menu[number]) => {
    setActiveMenu(item.id);
    setMobileOpen(false);
    window.setTimeout(() => document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return <div className="min-h-screen bg-[#101217] text-[#e9edf6]"><div className="flex min-h-screen">
    {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[206px] shrink-0 flex-col border-r border-white/[0.06] bg-[#15171d] p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="mb-8 flex items-center gap-2"><BrandMark /><div><p className="text-[11px] font-bold">Admin console</p><p className="text-[8px] uppercase tracking-[0.14em] text-[#697184]">Operations</p></div><button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="ml-auto rounded-md p-1 text-[#697184] hover:bg-white/[0.05] lg:hidden"><X size={15} /></button></div>
      <p className="mb-2 px-2 text-[8px] font-bold uppercase tracking-[0.16em] text-[#697184]">Main menu</p>
      <nav className="space-y-1">{menu.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => selectMenu(item)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[9px] font-semibold transition ${activeMenu === item.id ? "bg-[#6f49b9]/25 text-[#d0c3ff] shadow-[0_6px_18px_rgba(111,73,185,0.15)]" : "text-[#8c95a7] hover:bg-white/[0.04] hover:text-[#e9edf6]"}`}><Icon size={13} />{item.label}</button>; })}</nav>
      <div className="mt-auto space-y-1"><button onClick={() => setSettingsOpen((open) => !open)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[9px] font-semibold transition ${settingsOpen ? "bg-white/[0.06] text-[#e9edf6]" : "text-[#8c95a7] hover:bg-white/[0.04]"}`}><Settings2 size={13} />System settings</button><button onClick={logout} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[9px] font-semibold text-[#8c95a7] transition hover:bg-white/[0.04] hover:text-[#f1a0a6]"><LogOut size={13} />Logout</button></div>
    </aside>

    <main className="min-w-0 flex-1"><header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#13151b] px-5 sm:px-8"><div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-[#aeb7c9] hover:bg-white/[0.06] lg:hidden"><MenuIcon size={17} /></button><p className="text-[10px] text-[#747d90]">Admin / <span className="text-[#e9edf6]">{currentLabel}</span></p></div><div className="flex items-center gap-3"><span className="hidden text-[9px] text-[#7e8799] sm:block">Live system · <span className="text-[#56d2aa]">Online</span></span><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6e4ea6] text-[9px] font-bold">AD</div></div></header>
      <div className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">
        {settingsOpen && <section className="mb-5 rounded-lg border border-[#8b5bc4]/30 bg-[#1b1825] p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-[11px] font-bold">System settings</p><p className="mt-1 text-[9px] text-[#8b95a8]">Choose how the admin console should refresh data.</p></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-[9px] text-[#c4ccda]"><input type="checkbox" checked={liveUpdates} onChange={(event) => { setLiveUpdates(event.target.checked); toast.success(event.target.checked ? "Live updates enabled." : "Live updates paused."); }} className="accent-[#a78bfa]" />Live updates</label><button onClick={() => setSettingsOpen(false)} className="rounded-md border border-white/10 px-2.5 py-1.5 text-[9px] font-semibold text-[#aeb7c9] hover:bg-white/[0.05]">Done</button></div></div></section>}
        <div className="mb-5 flex items-end justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#a78bfa]">Admin overview</p><h1 className="mt-1 text-[22px] font-semibold tracking-[-0.04em]">System dashboard</h1></div><span className="flex items-center gap-1.5 text-[9px] text-[#697184]"><ShieldCheck size={12} className="text-[#56d2aa]" />{liveUpdates ? "Updated just now" : "Updates paused"}</span></div>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, trend, icon: Icon }) => <div key={label} className="rounded-lg border border-white/[0.06] bg-[#181b23] p-3"><div className="flex items-center justify-between"><span className="text-[9px] text-[#7e8799]">{label}</span><Icon size={13} className="text-[#8f78cb]" /></div><div className="mt-3 flex items-end justify-between"><span className="text-[19px] font-semibold">{value}</span><span className="text-[8px] font-semibold text-[#56d2aa]">{trend}</span></div></div>)}</div>

        <div className="grid gap-3 xl:grid-cols-[1.35fr_0.65fr]"><section id="admin-submissions" className="scroll-mt-5 rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-[11px] font-bold">Recent submissions</h2><p className="mt-1 text-[9px] text-[#717b8f]">Latest audio evaluated by clients</p></div><button onClick={() => goTo("results")} className="text-[9px] text-[#a78bfa] transition hover:text-[#d0c3ff]">View all <ArrowUpRight size={11} className="ml-1 inline" /></button></div><div id="admin-transcriptions" className="scroll-mt-5 overflow-x-auto"><table className="w-full min-w-[590px] text-left"><thead><tr className="border-b border-white/[0.06] text-[8px] uppercase tracking-[0.12em] text-[#697184]"><th className="pb-2">User</th><th className="pb-2">Accent</th><th className="pb-2">Duration</th><th className="pb-2">WER</th><th className="pb-2">Status</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="border-b border-white/[0.04] text-[9px] text-[#b6bfce]"><td className="py-3">{item.ownerName}</td><td className="py-3">{item.accent}</td><td className="py-3">00:06</td><td className="py-3 text-[#f1a0a6]">{item.baselineWer}</td><td className="py-3"><span className="rounded bg-[#56d2aa]/10 px-1.5 py-1 text-[8px] text-[#56d2aa]">Completed</span></td></tr>)}</tbody></table></div></section><section id="admin-accent-analysis" className="scroll-mt-5 rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><h2 className="text-[11px] font-bold">WER by accent</h2><div className="mx-auto my-4 flex h-28 w-28 items-center justify-center rounded-full" style={{ background: "conic-gradient(#f07b83 0 30%, #8c6bc2 30% 56%, #4c82d5 56% 76%, #d4a34a 76% 100%)" }}><div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#181b23] text-center"><span className="text-[12px] font-bold">13.24%<small className="block text-[7px] font-normal text-[#727d90]">avg WER</small></span></div></div><div className="space-y-2 text-[8px] text-[#aeb8c9]"><div className="flex justify-between"><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#f07b83]" />Indian</span><span>30%</span></div><div className="flex justify-between"><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#8c6bc2]" />Nigerian</span><span>26%</span></div><div className="flex justify-between"><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#4c82d5]" />Scottish</span><span>20%</span></div></div></section></div>

        <div id="admin-analytics" className="mt-3 grid scroll-mt-5 gap-3 lg:grid-cols-2"><section className="rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-[11px] font-bold">WER over time</h2><span className="text-[8px] text-[#697184]">Last 7 days</span></div><div className="flex h-28 items-end justify-around gap-2 border-b border-l border-white/[0.08] px-3 pb-2">{[42, 58, 46, 31, 34, 48, 38].map((height, index) => <div key={index} className="group flex h-full flex-1 flex-col items-center justify-end"><span className="mb-1 hidden text-[8px] text-[#a78bfa] group-hover:block">{(8 + index * 0.7).toFixed(1)}%</span><div className="w-1.5 rounded-t-full bg-gradient-to-t from-[#4c82d5] to-[#a78bfa]" style={{ height: `${height}%` }} /></div>)}</div></section><section className="rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-[11px] font-bold">Top errors</h2><span className="text-[8px] text-[#697184]">Count</span></div><div className="space-y-3">{errors.map((word, index) => <div key={`${word}-${index}`} className="flex items-center justify-between gap-3 text-[9px] text-[#aeb8c9]"><span className="truncate">{word}</span><span className="font-semibold text-[#e2e7f0]">{23 - index * 3}</span></div>)}</div></section></div>

        <section id="admin-users" className="mt-3 scroll-mt-5 rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[11px] font-bold">Users</h2><p className="mt-1 text-[9px] text-[#717b8f]">Client accounts and their evaluation activity</p></div><span className="rounded bg-[#8b5bc4]/15 px-2 py-1 text-[8px] font-semibold text-[#c4b5fd]">{metrics[0].value} total</span></div><div className="grid gap-2 md:grid-cols-3">{demoUsers.map((user) => <div key={user.email} className="rounded-md border border-white/[0.06] bg-[#1d2029] p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-[#d1d8e5]">{user.name}</span><span className={`text-[8px] ${user.status === "Active" ? "text-[#56d2aa]" : "text-[#f1c27d]"}`}>{user.status}</span></div><p className="mt-1 truncate text-[8px] text-[#727d90]">{user.email}</p><p className="mt-3 text-[9px] text-[#aeb8c9]">{user.samples} samples evaluated</p></div>)}</div></section>

        <section className="mt-3 rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[11px] font-bold">Audio submissions</h2><p className="mt-1 text-[9px] text-[#717b8f]">Review the latest client audio files</p></div><button onClick={() => document.getElementById("admin-submissions")?.scrollIntoView({ behavior: "smooth" })} aria-label="Jump to submissions" className="text-[#a78bfa] transition hover:text-[#d0c3ff]"><ArrowUpRight size={14} /></button></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{audioFiles.map((file) => <div key={file.name} className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-[#1d2029] p-2"><button onClick={() => toast.info(`${file.name} is ready for playback in the audio workspace.`)} aria-label={`Play ${file.name}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-[#a78bfa]/10 text-[#c4b5fd] transition hover:bg-[#a78bfa]/20"><Play size={10} fill="currentColor" /></button><span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold text-[#cbd4e2]">{file.name}</span><span className="text-[8px] text-[#6f7a8f]">{file.accent} · {file.duration}</span></span><button onClick={() => downloadReport(evaluations)} aria-label={`Download report for ${file.name}`} className="rounded p-1 text-[#747e91] transition hover:bg-white/[0.06] hover:text-[#d5dcef]"><Download size={11} /></button></div>)}</div></section>

        <section id="admin-reports" className="mt-3 scroll-mt-5 rounded-lg border border-[#8b5bc4]/20 bg-[linear-gradient(120deg,#1b1825,#181b23)] p-4"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#a78bfa]">Reports</p><h2 className="mt-1 text-[13px] font-bold">Export evaluation activity</h2><p className="mt-1 text-[9px] text-[#858fa2]">Download a CSV containing client, audio, language, WER, and status details.</p></div><button onClick={() => downloadReport(evaluations)} className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#8b5bc4] px-3 py-2 text-[9px] font-bold text-white transition hover:bg-[#9d6ed3]"><Download size={12} />Download CSV report</button></div></section>
      </div>
    </main>
  </div></div>;
}
