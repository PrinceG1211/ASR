import { useState } from "react";
import { ArrowUpRight, BarChart3, CheckCircle2, ClipboardCheck, Download, FileAudio, FileText, Gauge, GitCompareArrows, LogOut, Menu as MenuIcon, Settings2, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import type { ExperimentStage, ExperimentSummary, RuntimeCapability, RuntimeStatusResponse } from "@shared/experiment";
import type { EvaluationRecord, View } from "@/pages/Index";

type AdminDashboardProps = {
  evaluations: EvaluationRecord[];
  experiment: ExperimentSummary | null;
  runtimeStatus: RuntimeStatusResponse | null;
  checkRuntime: () => Promise<void>;
  installRuntime: () => Promise<void>;
  runtimeInstallRequest: boolean;
  goTo: (view: View) => void;
  logout: () => void;
  runStage: (stage: ExperimentStage) => void;
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

function downloadReport(experiment: ExperimentSummary | null) {
  if (!experiment) {
    toast.info("No experiment results are available to export.");
    return;
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(experiment, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `experiment-${experiment.id}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  toast.success("Experiment report downloaded.");
}

function percent(value: number | undefined) {
  return value == null ? "—" : `${(value * 100).toFixed(2)}%`;
}

function RuntimeCapabilityRow({ label, capability }: { label: string; capability: RuntimeCapability }) {
  const colors = capability.status === "available" ? "text-[#56d2aa]" : capability.status === "configuring" ? "text-[#e8c76b]" : "text-[#f1a0a6]";
  const marker = capability.status === "available" ? "●" : capability.status === "configuring" ? "●" : "●";
  return <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0"><div><p className="text-[10px] font-semibold text-[#c7cfdd]">{label}</p><p className="mt-0.5 text-[9px] leading-4 text-[#737d91]">{capability.detail}</p></div><span className={`shrink-0 text-[9px] font-bold uppercase ${colors}`}><span className="mr-1">{marker}</span>{capability.status}</span></div>;
}

export default function AdminDashboard({ evaluations, experiment, runtimeStatus, checkRuntime, installRuntime, runtimeInstallRequest, goTo, logout, runStage }: AdminDashboardProps) {
  const [activeMenu, setActiveMenu] = useState<AdminMenuId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const dataset = experiment?.dataset;
  const baseline = experiment?.baseline;
  const currentLabel = menu.find((item) => item.id === activeMenu)?.label ?? "Overview";
  const metrics = [
    { label: "Dataset samples", value: dataset ? String(dataset.samples) : "—", icon: FileAudio },
    { label: "Speakers", value: dataset ? String(dataset.speakers) : "—", icon: Users },
    { label: "Mean WER", value: percent(baseline?.meanWer), icon: Gauge },
    { label: "Accent gap", value: percent(baseline?.gap), icon: BarChart3 },
  ];
  const rows = baseline?.accents ?? [];
  const stageState = experiment?.status === "running" ? `Running ${experiment.stage ?? "experiment"}` : experiment?.status === "failed" ? "Stage failed" : experiment?.status === "complete" ? `Completed ${experiment.stage ?? "stage"}` : "No experiment";
  const selectMenu = (item: typeof menu[number]) => {
    setActiveMenu(item.id);
    setMobileOpen(false);
    window.setTimeout(() => document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const triggerStage = (stage: ExperimentStage) => {
    if (stage === "dataset" || experiment) runStage(stage);
    else toast.info("Load the Common Voice dataset before starting this stage.");
  };

  return <div className="min-h-screen bg-[#101217] text-[#e9edf6]"><div className="flex min-h-screen">
    {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[206px] shrink-0 flex-col border-r border-white/[0.06] bg-[#15171d] p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}><div className="mb-8 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#493879] to-[#8b5bc4] text-[13px] font-black text-white">∿</div><div><p className="text-[11px] font-bold">Admin console</p><p className="text-[8px] uppercase tracking-[0.14em] text-[#697184]">Operations</p></div></div><button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-[#697184] hover:bg-white/[0.05] lg:hidden"><X size={15} /></button></div><p className="mb-2 px-2 text-[8px] font-bold uppercase tracking-[0.16em] text-[#697184]">Main menu</p><nav className="space-y-1">{menu.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => selectMenu(item)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[9px] font-semibold transition ${activeMenu === item.id ? "bg-[#6f49b9]/25 text-[#d0c3ff]" : "text-[#8c95a7] hover:bg-white/[0.04] hover:text-[#e9edf6]"}`}><Icon size={13} />{item.label}</button>; })}</nav><div className="mt-auto space-y-1"><button onClick={() => setSettingsOpen((value) => !value)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[9px] font-semibold text-[#8c95a7] hover:bg-white/[0.04]"><Settings2 size={13} />System settings</button><button onClick={logout} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[9px] font-semibold text-[#8c95a7] hover:bg-white/[0.04] hover:text-[#f1a0a6]"><LogOut size={13} />Logout</button></div></aside>
    <main className="min-w-0 flex-1"><header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#13151b] px-5 sm:px-8"><div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-[#aeb7c9] hover:bg-white/[0.06] lg:hidden"><MenuIcon size={17} /></button><p className="text-[10px] text-[#747d90]">Admin / <span className="text-[#e9edf6]">{currentLabel}</span></p></div><div className="flex items-center gap-3"><span className="hidden text-[9px] text-[#7e8799] sm:block">Experiment state · <span className={experiment?.status === "failed" ? "text-[#f1a0a6]" : "text-[#56d2aa]"}>{stageState}</span></span><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6e4ea6] text-[9px] font-bold">AD</div></div></header>
      <div className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">{settingsOpen && <section className="mb-5 rounded-lg border border-[#8b5bc4]/30 bg-[#1b1825] p-4"><label className="flex items-center gap-2 text-[10px] text-[#c4ccda]"><input type="checkbox" checked={liveUpdates} onChange={(event) => setLiveUpdates(event.target.checked)} className="accent-[#a78bfa]" />Refresh experiment state automatically</label></section>}
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#a78bfa]">Admin overview</p><h1 className="mt-1 text-[22px] font-semibold tracking-[-0.04em]">Research experiment console</h1><p className="mt-2 text-[10px] text-[#717b8f]">Actual Common Voice and Whisper state only. No synthetic metrics are shown.</p></div><span className="flex items-center gap-1.5 text-[9px] text-[#697184]"><ShieldCheck size={12} className="text-[#56d2aa]" />{stageState}</span></div>
        <section className="mb-5 rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#a78bfa]">ML runtime status</p><h2 className="mt-1 text-[13px] font-bold">Python / Whisper execution readiness</h2></div><div className="flex gap-2"><button onClick={() => void checkRuntime()} className="rounded-md border border-[#8b5bc4]/50 px-3 py-2 text-[9px] font-bold text-[#c4b5fd] hover:bg-[#8b5bc4]/10">Check ML runtime</button>{runtimeStatus?.whisper.status !== "available" && <button disabled={runtimeInstallRequest} onClick={() => void installRuntime()} className="rounded-md bg-[#8b5bc4] px-3 py-2 text-[9px] font-bold text-white hover:bg-[#9d6ed3] disabled:cursor-not-allowed disabled:opacity-50">{runtimeInstallRequest ? "Installing…" : "Install ML dependencies"}</button>}</div></div>{runtimeStatus ? <div className="grid gap-x-5 md:grid-cols-2"><RuntimeCapabilityRow label="ML runtime" capability={runtimeStatus.runtime} /><RuntimeCapabilityRow label="Whisper" capability={runtimeStatus.whisper} /><RuntimeCapabilityRow label="Dataset service" capability={runtimeStatus.dataset} /><RuntimeCapabilityRow label="Evaluation service" capability={runtimeStatus.evaluation} /><RuntimeCapabilityRow label="Fine-tuning service" capability={runtimeStatus.fineTuning} /></div> : <p className="text-[10px] text-[#7e8799]">Runtime has not been checked in this session.</p>}</section>
        <section className="mb-5 rounded-lg border border-[#8b5bc4]/25 bg-[linear-gradient(120deg,#1b1825,#181b23)] p-4"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#a78bfa]">Research workflow</p><h2 className="mt-1 text-[14px] font-bold">Dataset → baseline → mitigation → comparison</h2><p className="mt-1 text-[9px] text-[#858fa2]">Run each stage against persisted experiment state.</p></div><div className="flex flex-wrap gap-2">{[{ stage: "dataset" as ExperimentStage, label: "Load dataset" }, { stage: "baseline" as ExperimentStage, label: "Run baseline" }, { stage: "finetune" as ExperimentStage, label: "Start fine-tuning" }, { stage: "evaluate" as ExperimentStage, label: "Evaluate tuned" }].map((item) => <button key={item.stage} disabled={experiment?.status === "running"} onClick={() => triggerStage(item.stage)} className="rounded-md bg-[#8b5bc4] px-3 py-2 text-[9px] font-bold text-white transition hover:bg-[#9d6ed3] disabled:cursor-not-allowed disabled:opacity-50">{item.label}</button>)}</div></div>{experiment?.error && <p className="mt-3 rounded-md bg-[#f1a0a6]/10 px-3 py-2 text-[9px] text-[#f1a0a6]">{experiment.error}</p>}</section>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-lg border border-white/[0.06] bg-[#181b23] p-3"><div className="flex items-center justify-between"><span className="text-[9px] text-[#7e8799]">{label}</span><Icon size={13} className="text-[#8f78cb]" /></div><div className="mt-3 text-[19px] font-semibold">{value}</div></div>)}</div>
        <section id="admin-submissions" className="scroll-mt-5 rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-[11px] font-bold">Accent distribution and split</h2><p className="mt-1 text-[9px] text-[#717b8f]">Actual groups found in the Common Voice manifest</p></div><button onClick={() => goTo("results")} className="text-[9px] text-[#a78bfa]">View results <ArrowUpRight size={11} className="ml-1 inline" /></button></div><div id="admin-transcriptions" className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[9px]"><thead className="border-b border-white/[0.06] text-[8px] uppercase tracking-[0.12em] text-[#697184]"><tr><th className="pb-2">Accent</th><th className="pb-2">Speakers</th><th className="pb-2">Samples</th><th className="pb-2">Train</th><th className="pb-2">Validation</th><th className="pb-2">Test</th></tr></thead><tbody>{dataset?.accents.map((row) => <tr key={row.accent} className="border-b border-white/[0.04] text-[#b6bfce]"><td className="py-3">{row.label}</td><td className="py-3">{row.speakers}</td><td className="py-3">{row.samples}</td><td className="py-3">{row.trainSamples}</td><td className="py-3">{row.validationSamples}</td><td className="py-3">{row.testSamples}</td></tr>)}</tbody></table>{!dataset && <p className="py-5 text-[10px] text-[#7e8799]">No dataset inspection has completed.</p>}</div></section>
        <div id="admin-analytics" className="mt-3 grid scroll-mt-5 gap-3 lg:grid-cols-2"><section id="admin-accent-analysis" className="rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><h2 className="text-[11px] font-bold">WER by accent</h2>{baseline ? <div className="mt-4 space-y-3">{baseline.accents.map((row) => <div key={row.accent} className="flex items-center justify-between text-[9px] text-[#b6bfce]"><span>{row.label}</span><span className="text-[#f1a0a6]">{percent(row.baselineWer)}</span></div>)}</div> : <p className="mt-4 text-[10px] text-[#7e8799]">No baseline WER/CER available.</p>}</section><section className="rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><h2 className="text-[11px] font-bold">Top errors</h2><p className="mt-4 text-[10px] text-[#7e8799]">Sample-level errors appear after Whisper inference completes.</p></section></div>
        <section id="admin-users" className="mt-3 scroll-mt-5 rounded-lg border border-white/[0.06] bg-[#181b23] p-4"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[11px] font-bold">Experiment history</h2><p className="mt-1 text-[9px] text-[#717b8f]">Persisted experiment identifier and status</p></div><span className="rounded bg-[#8b5bc4]/15 px-2 py-1 text-[8px] font-semibold text-[#c4b5fd]">{experiment?.id ?? "No run"}</span></div><div className="text-[10px] text-[#aeb8c9]">{experiment ? `${experiment.status} · ${experiment.stage ?? "not started"} · ${experiment.createdAt}` : "No experimental results available."}</div></section>
        <section id="admin-reports" className="mt-3 scroll-mt-5 rounded-lg border border-[#8b5bc4]/20 bg-[linear-gradient(120deg,#1b1825,#181b23)] p-4"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#a78bfa]">Reports</p><h2 className="mt-1 text-[13px] font-bold">Export experiment data</h2><p className="mt-1 text-[9px] text-[#858fa2]">Export only persisted experiment metadata and measured results.</p></div><button onClick={() => downloadReport(experiment)} className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#8b5bc4] px-3 py-2 text-[9px] font-bold text-white transition hover:bg-[#9d6ed3]"><Download size={12} />Download report</button></div></section>
      </div>
    </main></div></div>;
}
