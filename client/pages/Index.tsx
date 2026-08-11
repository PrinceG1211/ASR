import { useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Beaker,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  Download,
  FileAudio,
  FlaskConical,
  Gauge,
  GitBranch,
  Headphones,
  Layers3,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

const accentRows = [
  { name: "US English", code: "en-US", samples: "4,280", wer: "7.8%", cer: "3.1%", change: "−1.4%", color: "#b9e769", width: "84%" },
  { name: "Indian English", code: "en-IN", samples: "3,960", wer: "12.6%", cer: "5.8%", change: "−2.8%", color: "#ffbd8a", width: "63%" },
  { name: "Nigerian English", code: "en-NG", samples: "3,740", wer: "15.2%", cer: "7.2%", change: "−3.6%", color: "#b8a6ff", width: "47%" },
  { name: "Scottish English", code: "en-GB-Scot", samples: "3,120", wer: "11.4%", cer: "5.0%", change: "−2.1%", color: "#7bd9d2", width: "57%" },
];

const experiments = [
  { name: "balanced-v2-adapter", status: "Training", model: "Whisper small", progress: 68, time: "12 min left", dot: "bg-[#b9e769]" },
  { name: "baseline-accent-audit", status: "Complete", model: "Whisper small", progress: 100, time: "Yesterday", dot: "bg-[#7bd9d2]" },
  { name: "wav2vec-comparison", status: "Queued", model: "wav2vec 2.0", progress: 0, time: "—", dot: "bg-[#9087a9]" },
];

function LogoMark() {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#b9e769] text-[#111719] shadow-[0_0_24px_rgba(185,231,105,0.2)]">
      <Activity size={18} strokeWidth={2.7} />
      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#ff9d6c]" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#727982]">{children}</p>;
}

function MetricCard({ label, value, detail, trend, icon: Icon, tone = "lime" }: { label: string; value: string; detail: string; trend: string; icon: typeof Gauge; tone?: "lime" | "orange" | "lavender" }) {
  const toneClass = tone === "orange" ? "text-[#ffbd8a]" : tone === "lavender" ? "text-[#b8a6ff]" : "text-[#b9e769]";
  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-[#171d1f] p-5 transition hover:-translate-y-0.5 hover:border-white/[0.14]">
      <div className="mb-5 flex items-center justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.045] ${toneClass}`}><Icon size={16} /></div>
        <span className="rounded-full bg-[#b9e769]/10 px-2 py-1 text-[10px] font-semibold text-[#b9e769]">{trend}</span>
      </div>
      <p className="text-[11px] font-medium text-[#7d858b]">{label}</p>
      <div className="mt-1 flex items-end gap-2"><p className="text-[27px] font-semibold tracking-[-0.04em] text-[#eef2e8]">{value}</p><p className="mb-1 text-[11px] text-[#70787d]">{detail}</p></div>
    </div>
  );
}

export default function Index() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [model, setModel] = useState("Whisper small");
  const [runState, setRunState] = useState<"idle" | "running" | "saved">("idle");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTitle = useMemo(() => activeNav === "Overview" ? "Accent fairness workspace" : activeNav, [activeNav]);

  const handleFile = (file?: File) => {
    if (file) setFileName(file.name);
  };

  return (
    <div className="min-h-screen bg-[#101516] text-[#eef2e8]">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[246px] shrink-0 flex-col border-r border-white/[0.07] bg-[#13191b] px-4 py-5 transition-transform duration-200 lg:static lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center gap-3 px-3"><LogoMark /><div><p className="text-[14px] font-semibold tracking-[-0.02em]">sonora<span className="text-[#b9e769]">/</span>lab</p><p className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-[#697277]">speech intelligence</p></div><button onClick={() => setIsSidebarOpen(false)} className="ml-auto rounded-lg p-1 text-[#727982] hover:bg-white/[0.06] lg:hidden"><X size={16} /></button></div>
          <div className="mt-9"><SectionLabel>Workspace</SectionLabel><nav className="space-y-1">
            {[{ label: "Overview", icon: BarChart3 }, { label: "Dataset", icon: Database }, { label: "Models", icon: Layers3 }, { label: "Reports", icon: FileAudio }].map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveNav(label); setIsSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium transition ${activeNav === label ? "bg-[#b9e769]/10 text-[#b9e769]" : "text-[#8b9398] hover:bg-white/[0.045] hover:text-[#dbe4dc]"}`}><Icon size={16} strokeWidth={1.8} />{label}{activeNav === label && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#b9e769]" />}</button>)}
          </nav></div>
          <div className="mt-9"><SectionLabel>Experiments</SectionLabel><nav className="space-y-1"><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium text-[#8b9398] transition hover:bg-white/[0.045] hover:text-[#dbe4dc]"><GitBranch size={16} strokeWidth={1.8} />Experiment runs</button><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium text-[#8b9398] transition hover:bg-white/[0.045] hover:text-[#dbe4dc]"><FlaskConical size={16} strokeWidth={1.8} />Evaluation lab</button></nav></div>
          <div className="mt-auto rounded-xl border border-[#b9e769]/15 bg-[#b9e769]/[0.045] p-3.5"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a7c86b]">Compute credits</span><Sparkles size={13} className="text-[#b9e769]" /></div><div className="mb-2 flex items-end justify-between"><span className="text-[20px] font-semibold text-[#edf5dc]">72%</span><span className="text-[10px] text-[#79837d]">of 100 hrs</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#27322b]"><div className="h-full w-[72%] rounded-full bg-[#b9e769]" /></div><button className="mt-3 text-[10px] font-medium text-[#b9e769] hover:underline">Manage usage <ArrowUpRight size={11} className="ml-1 inline" /></button></div>
          <div className="mt-5 flex items-center gap-3 border-t border-white/[0.07] px-2 pt-4"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6d5a80] text-[10px] font-semibold">PG</div><div className="min-w-0"><p className="truncate text-[11px] font-medium text-[#d2d9d2]">Prince Gohel</p><p className="text-[10px] text-[#6f777b]">Researcher</p></div><Settings2 size={14} className="ml-auto text-[#697277]" /></div>
        </aside>
        {isSidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-[#090c0d]/70 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

        <main className="min-w-0 flex-1">
          <header className="flex h-[70px] items-center justify-between border-b border-white/[0.07] px-5 sm:px-8 lg:px-10"><div className="flex items-center gap-3"><button onClick={() => setIsSidebarOpen(true)} className="rounded-lg p-2 text-[#9ba49e] hover:bg-white/[0.06] lg:hidden"><Menu size={19} /></button><div className="hidden h-7 w-px bg-white/[0.08] sm:block" /><div><p className="text-[11px] text-[#777f83]">Workspace / <span className="text-[#c1c8c1]">{currentTitle}</span></p><p className="mt-0.5 text-[11px] text-[#5f686c]">Last synced 4 min ago</p></div></div><div className="flex items-center gap-2 sm:gap-3"><button className="hidden items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] font-medium text-[#a4aca7] transition hover:border-white/[0.17] hover:text-[#e3e8e0] sm:flex"><CircleHelp size={14} />Help center</button><button onClick={() => setRunState("running")} className="flex items-center gap-2 rounded-lg bg-[#b9e769] px-3.5 py-2.5 text-[11px] font-bold text-[#172013] shadow-[0_0_18px_rgba(185,231,105,0.12)] transition hover:bg-[#c9f27d]"><Plus size={15} strokeWidth={2.5} />New experiment</button></div></header>

          <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
            <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#b9e769] shadow-[0_0_9px_#b9e769]" /><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a8c76d]">Live workspace</span></div><h1 className="text-[28px] font-semibold tracking-[-0.045em] text-[#f0f4ec] sm:text-[34px]">Good morning, Prince.</h1><p className="mt-2 max-w-xl text-[13px] leading-6 text-[#818b8c]">Measure, adapt, and understand speech recognition across the accents that matter.</p></div><div className="flex items-center gap-2 text-[11px] text-[#7c8585]"><span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#b9e769]" />Pipeline healthy</span><button className="rounded-lg border border-white/[0.08] p-2 text-[#7d8787] hover:text-[#dfe6de]"><MoreHorizontal size={16} /></button></div></div>

            <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Overall word error rate" value="11.8%" detail="baseline" trend="↓ 2.4%" icon={Gauge} /><MetricCard label="Accent gap" value="7.4pp" detail="best → worst" trend="↓ 1.9pp" icon={Activity} tone="orange" /><MetricCard label="Samples evaluated" value="15.1k" detail="across 4 accents" trend="+ 18.6%" icon={Headphones} tone="lavender" /><MetricCard label="Dataset balance" value="96/100" detail="balance score" trend="Healthy" icon={Users} /></section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.85fr)]">
              <section className="rounded-2xl border border-white/[0.07] bg-[#171d1f] p-5 sm:p-6"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="mb-2 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b9e769]/10 text-[#b9e769]"><BarChart3 size={15} /></div><h2 className="text-[14px] font-semibold text-[#edf2ea]">Performance by accent</h2></div><p className="text-[11px] text-[#737d80]">Baseline vs. adapted model · Common Voice v17</p></div><div className="flex items-center gap-1 rounded-lg border border-white/[0.08] p-1"><button className="rounded-md bg-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-[#dce5d9]">WER</button><button className="px-2.5 py-1.5 text-[10px] font-medium text-[#727d7f]">CER</button></div></div><div className="mb-5 flex items-center gap-5 text-[10px] text-[#727b7d]"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-[#5b6769]" />Baseline</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-[#b9e769]" />Adapted</span><span className="ml-auto hidden items-center gap-1 text-[#a5afb0] sm:flex"><ArrowDownRight size={12} className="text-[#b9e769]" /> lower is better</span></div><div className="space-y-5">{accentRows.map((row) => <div key={row.code} className="grid grid-cols-[minmax(130px,1fr)_minmax(160px,2.1fr)_70px] items-center gap-4 sm:grid-cols-[155px_minmax(220px,1fr)_80px_66px]"><div><p className="text-[11px] font-medium text-[#d7dfd9]">{row.name}</p><p className="mt-1 font-mono text-[9px] text-[#687275]">{row.code} · {row.samples}</p></div><div className="space-y-1.5"><div className="relative h-2 overflow-hidden rounded-full bg-[#283033]"><div className="absolute inset-y-0 left-0 rounded-full bg-[#596466]" style={{ width: `${Math.min(100, Number.parseFloat(row.wer) * 5.2)}%` }} /><div className="absolute inset-y-0 left-0 rounded-full" style={{ width: row.width, backgroundColor: row.color, opacity: 0.9 }} /></div><div className="flex justify-between text-[9px] text-[#687275]"><span>base {row.wer}</span><span className="font-medium text-[#c6dba7]">adapted {row.change.replace("−", "")}</span></div></div><p className="text-right text-[12px] font-semibold text-[#e5ece2]">{row.wer}</p><div className="hidden text-right sm:block"><span className="rounded bg-[#b9e769]/10 px-1.5 py-1 text-[10px] font-medium text-[#b9e769]">{row.change}</span></div></div>)}</div><div className="mt-7 flex items-center justify-between border-t border-white/[0.06] pt-4"><p className="text-[10px] text-[#687274]">WER measured on held-out test split · n = 15,100 utterances</p><button className="flex items-center gap-1 text-[10px] font-semibold text-[#b9e769] hover:underline">View full analysis <ArrowUpRight size={12} /></button></div></section>

              <div className="space-y-5"><section className="rounded-2xl border border-white/[0.07] bg-[#171d1f] p-5 sm:p-6"><div className="mb-5 flex items-start justify-between"><div><div className="mb-2 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffbd8a]/10 text-[#ffbd8a]"><Database size={15} /></div><h2 className="text-[14px] font-semibold text-[#edf2ea]">Dataset balance</h2></div><p className="text-[11px] text-[#737d80]">Common Voice v17 · selected subset</p></div><button className="text-[#697477] hover:text-[#dbe2dc]"><MoreHorizontal size={17} /></button></div><div className="flex items-center gap-5"><div className="relative flex h-[108px] w-[108px] shrink-0 items-center justify-center rounded-full" style={{ background: "conic-gradient(#b9e769 0 31%, #ffbd8a 31% 58%, #b8a6ff 58% 83%, #7bd9d2 83% 100%)" }}><div className="flex h-[82px] w-[82px] flex-col items-center justify-center rounded-full bg-[#171d1f]"><span className="text-[21px] font-semibold text-[#edf2ea]">15.1k</span><span className="text-[9px] text-[#707a7b]">utterances</span></div></div><div className="min-w-0 flex-1 space-y-3">{accentRows.map((row) => <div key={row.code} className="flex items-center justify-between gap-2 text-[10px]"><span className="flex items-center gap-2 truncate text-[#aeb8b0]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />{row.name}</span><span className="font-mono text-[#e1e8df]">{row.samples}</span></div>)}</div></div><div className="mt-5 rounded-lg border border-[#b9e769]/10 bg-[#b9e769]/[0.04] px-3 py-2.5 text-[10px] leading-4 text-[#a4b38f]"><Check size={12} className="mr-1 inline text-[#b9e769]" />Balanced within a 10% variance threshold.</div></section>

              <section className="rounded-2xl border border-white/[0.07] bg-[#171d1f] p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b8a6ff]/10 text-[#b8a6ff]"><GitBranch size={15} /></div><h2 className="text-[14px] font-semibold text-[#edf2ea]">Active runs</h2></div><span className="text-[10px] text-[#6f797c]">3 experiments</span></div><div className="space-y-3">{experiments.map((experiment) => <div key={experiment.name} className="rounded-lg border border-white/[0.06] bg-[#1b2224] p-3"><div className="flex items-center justify-between gap-3"><p className="truncate font-mono text-[10px] text-[#d3dbd4]">{experiment.name}</p><span className="flex shrink-0 items-center gap-1.5 text-[9px] text-[#7d8789]"><span className={`h-1.5 w-1.5 rounded-full ${experiment.dot}`} />{experiment.status}</span></div><div className="mt-2 flex items-center justify-between text-[9px] text-[#6d777a]"><span>{experiment.model}</span><span className="flex items-center gap-1"><Clock3 size={10} />{experiment.time}</span></div>{experiment.progress > 0 && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#303839]"><div className="h-full rounded-full bg-[#b9e769]" style={{ width: `${experiment.progress}%` }} /></div>}</div>)}</div><button onClick={() => setActiveNav("Reports")} className="mt-4 text-[10px] font-semibold text-[#b9e769] hover:underline">Open experiment manager <ArrowUpRight size={11} className="ml-1 inline" /></button></section></div>
            </div>

            <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#171d1f]"><div className="flex flex-col justify-between gap-4 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:px-6"><div><div className="mb-2 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7bd9d2]/10 text-[#7bd9d2]"><Beaker size={15} /></div><h2 className="text-[14px] font-semibold text-[#edf2ea]">Create an evaluation run</h2></div><p className="text-[11px] text-[#737d80]">Configure your baseline or adaptation experiment</p></div><div className="flex items-center gap-2 text-[10px] text-[#74807d]"><span className="h-1.5 w-1.5 rounded-full bg-[#7bd9d2]" />Ready to configure</div></div><div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1fr_1.15fr_auto] lg:items-end"><div><label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#788284]">Base model</label><div className="relative"><select value={model} onChange={(e) => setModel(e.target.value)} className="w-full appearance-none rounded-lg border border-white/[0.09] bg-[#1c2425] px-3 py-2.5 text-[11px] text-[#dce5dc] outline-none focus:border-[#b9e769]/60"><option>Whisper small</option><option>Whisper medium</option><option>wav2vec 2.0</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-[#6f7a7c]" /></div></div><div><label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#788284]">Dataset</label><button className="flex w-full items-center justify-between rounded-lg border border-white/[0.09] bg-[#1c2425] px-3 py-2.5 text-left text-[11px] text-[#dce5dc]"><span className="flex items-center gap-2"><Database size={13} className="text-[#ffbd8a]" />Common Voice v17</span><ChevronDown size={14} className="text-[#6f7a7c]" /></button></div><div><label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#788284]">Audio samples</label><button onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.15] bg-[#1c2425] px-3 py-2.5 text-left text-[11px] text-[#aeb9b2] transition hover:border-[#b9e769]/50 hover:text-[#e5eee2]"><UploadCloud size={14} className="text-[#b9e769]" />{fileName || "Upload a manifest or audio folder"}</button><input ref={fileInputRef} type="file" className="hidden" accept=".csv,.json,.zip,audio/*" onChange={(e) => handleFile(e.target.files?.[0])} /></div><button onClick={() => setRunState("saved")} className="flex h-[38px] items-center justify-center gap-2 rounded-lg bg-[#b9e769] px-4 text-[11px] font-bold text-[#172013] transition hover:bg-[#c9f27d] lg:min-w-[130px]"><Play size={13} fill="currentColor" />{runState === "saved" ? "Run queued" : runState === "running" ? "Configuring…" : "Start run"}</button></div></section>

            <footer className="flex flex-col justify-between gap-2 py-6 text-[10px] text-[#606b6e] sm:flex-row"><span>sonora/lab · ASR fairness research workspace</span><span className="flex items-center gap-4"><button className="hover:text-[#a8b3ad]">Documentation</button><button className="hover:text-[#a8b3ad]">API status <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#b9e769]" /></button></span></footer>
          </div>
        </main>
      </div>
    </div>
  );
}
