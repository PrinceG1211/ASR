import { ArrowRight, ArrowUpRight, BarChart3, CheckCircle2, Download, FileAudio, FileText, Mic, Sparkles, UploadCloud } from "lucide-react";
import type { ExperimentSummary } from "@shared/experiment";
import type { Session, EvaluationRecord, View } from "@/pages/Index";

type ClientDashboardProps = {
  session: Session;
  evaluations: EvaluationRecord[];
  goTo: (view: View) => void;
  logout: () => void;
  downloadTextFile: (fileName: string, content: string) => void;
  experiment: ExperimentSummary | null;
};

function UserMark({ name }: { name: string }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#396fe8] to-[#8b5cf6] text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(70,91,190,0.22)]">{initials || "U"}</div>;
}

export default function ClientDashboard({ session, evaluations, goTo, logout, downloadTextFile, experiment }: ClientDashboardProps) {
  const latest = evaluations[0];
  const firstName = session.name.trim().split(/\s+/)[0] || "there";
  const latestTranscript = latest?.transcript || "No transcript available.";
  const baseline = experiment?.baseline;
  const quickStats = [
    { label: "Average WER", value: baseline?.meanWer == null ? "—" : `${(baseline.meanWer * 100).toFixed(2)}%`, detail: baseline ? "Actual held-out test" : "No experimental results", color: "#356ee8" },
    { label: "Model improvement", value: experiment?.fineTuned ? `${(((baseline?.meanWer ?? 0) - experiment.fineTuned.meanWer) * 100).toFixed(2)}pp` : "—", detail: experiment?.fineTuned ? "Baseline vs fine-tuned" : "Fine-tuning not completed", color: "#8b5cf6" },
    { label: "Samples checked", value: baseline ? String(baseline.accents.reduce((sum, row) => sum + row.samples, 0)) : "—", detail: baseline ? "Held-out test samples" : "No experimental results", color: "#ef8b47" },
  ];
  const accentBars = baseline?.accents.filter((row) => row.baselineWer != null).map((row, index) => ({ label: row.label, value: (row.baselineWer ?? 0) * 100, color: ["#396fe8", "#ee6872", "#8b5cf6", "#2caeaa"][index % 4] })) ?? [];

  return <div className="min-h-screen bg-[#f7f9fc] text-[#17243d]">
    <header className="border-b border-[#e2e8f1] bg-white/95 px-5 py-4 shadow-[0_4px_18px_rgba(31,52,91,0.04)] backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserMark name={session.name} />
          <div>
            <p className="text-[12px] font-bold tracking-[-0.03em] text-[#17243d]">{session.name}</p>
            <p className="text-[9px] uppercase tracking-[0.16em] text-[#8190a8]">Personal dashboard</p>
          </div>
        </div>
        <nav className="hidden items-center gap-7 text-[10px] font-semibold text-[#71809a] md:flex">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-[#3568c1]">Overview</button>
          <button onClick={() => goTo("results")} className="transition hover:text-[#3568c1]">My results</button>
          <button onClick={() => document.getElementById("client-how")?.scrollIntoView({ behavior: "smooth" })} className="transition hover:text-[#3568c1]">How it works</button>
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-[#f0f4fa] px-3 py-1.5 text-[9px] font-semibold text-[#61718c] sm:block">Client account</span>
          <button onClick={logout} className="rounded-lg bg-[#17243d] px-3.5 py-2 text-[9px] font-bold text-white transition hover:bg-[#2c3c5b]">Log out</button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-[1240px] px-5 py-7 sm:px-8 sm:py-9">
      <section className="relative mb-6 overflow-hidden rounded-[28px] bg-[linear-gradient(118deg,#182d58,#325cc1_54%,#7551c6)] p-6 text-white shadow-[0_22px_55px_rgba(42,68,139,0.2)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/15 bg-white/[0.06]" />
        <div className="pointer-events-none absolute -bottom-24 right-32 h-44 w-44 rounded-full bg-[#79e3e2]/15 blur-2xl" />
        <div className="relative max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#b9f2ee]"><Sparkles size={12} /> Your speech overview</div>
          <h1 className="text-[30px] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[40px]">Good to see you, {firstName}.</h1>
          <p className="mt-4 max-w-xl text-[12px] leading-6 text-[#d7e2ff]">Bring in a voice sample, add a little context, and get a clear view of how the transcription performs.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => goTo("analyze")} className="rounded-xl bg-white px-4 py-2.5 text-[10px] font-bold text-[#2855a8] shadow-sm transition hover:bg-[#edf7ff]"><Mic size={13} className="mr-1.5 inline" />Start a new check</button>
            <button onClick={() => goTo("results")} className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-white/15">View saved results <ArrowRight size={13} className="ml-1.5 inline" /></button>
          </div>
        </div>
        <div className="relative mt-8 grid max-w-xl grid-cols-3 gap-2 sm:absolute sm:bottom-8 sm:right-8 sm:mt-0 sm:w-[360px]">
          {[{ value: "01", label: "Add audio" }, { value: "02", label: "Add context" }, { value: "03", label: "Read results" }].map((step) => <div key={step.value} className="rounded-xl border border-white/15 bg-white/[0.1] p-3 backdrop-blur-sm"><p className="font-mono text-[10px] text-[#b9f2ee]">{step.value}</p><p className="mt-2 text-[9px] font-semibold text-white">{step.label}</p></div>)}
        </div>
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        {quickStats.map((stat) => <div key={stat.label} className="rounded-2xl border border-[#e1e7f0] bg-white p-4 shadow-[0_8px_28px_rgba(40,66,111,0.05)]"><div className="mb-5 h-1 w-10 rounded-full" style={{ backgroundColor: stat.color }} /><p className="text-[10px] font-semibold text-[#75839b]">{stat.label}</p><p className="mt-1 text-[25px] font-bold tracking-[-0.05em] text-[#1b2b49]">{stat.value}</p><p className="mt-1 text-[9px] text-[#96a2b5]">{stat.detail}</p></div>)}
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] border border-[#dfe6f0] bg-white p-5 shadow-[0_10px_32px_rgba(40,66,111,0.06)] sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#5278c2]">Start here</p><h2 className="text-[18px] font-bold tracking-[-0.04em] text-[#1b2b49]">Check a new voice sample</h2><p className="mt-1.5 max-w-md text-[11px] leading-5 text-[#7b89a1]">Use a recording or an existing audio file. You can choose the speaker context inside the evaluation workspace.</p></div><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf4ff] text-[#396fe8]"><FileAudio size={18} /></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => goTo("analyze")} className="group rounded-2xl border border-[#dbe6f7] bg-[#f7faff] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#9dbced] hover:shadow-[0_8px_22px_rgba(57,111,232,0.1)]"><div className="mb-8 flex h-9 w-9 items-center justify-center rounded-xl bg-[#396fe8] text-white"><Mic size={16} /></div><p className="text-[11px] font-bold text-[#263b61]">Record live</p><p className="mt-1 text-[9px] leading-4 text-[#7e8da5]">Speak directly from your microphone.</p><ArrowUpRight size={14} className="mt-4 text-[#396fe8] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
            <button onClick={() => goTo("analyze")} className="group rounded-2xl border border-[#e6ddfa] bg-[#fbf9ff] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#c3aeea] hover:shadow-[0_8px_22px_rgba(139,92,246,0.1)]"><div className="mb-8 flex h-9 w-9 items-center justify-center rounded-xl bg-[#8b5cf6] text-white"><UploadCloud size={16} /></div><p className="text-[11px] font-bold text-[#263b61]">Upload a file</p><p className="mt-1 text-[9px] leading-4 text-[#7e8da5]">Add WAV, MP3, M4A, or other audio.</p><ArrowUpRight size={14} className="mt-4 text-[#8b5cf6] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#dfe6f0] bg-white p-5 shadow-[0_10px_32px_rgba(40,66,111,0.06)] sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#8a62cc]">Latest activity</p><h2 className="text-[18px] font-bold tracking-[-0.04em] text-[#1b2b49]">Your last check</h2></div><CheckCircle2 size={19} className="text-[#35a783]" /></div>
          {latest ? <div><div className="rounded-2xl bg-[#f6f8fc] p-4"><div className="flex items-center justify-between gap-3"><p className="truncate text-[11px] font-bold text-[#2a3d60]">{latest.fileName}</p><span className="rounded-full bg-[#e7f8f1] px-2 py-1 text-[8px] font-bold text-[#268365]">Complete</span></div><p className="mt-3 text-[10px] leading-5 text-[#647692]">{latest.transcript || "Transcript ready for review."}</p><div className="mt-4 grid grid-cols-2 gap-2"><div><p className="text-[8px] uppercase tracking-[0.12em] text-[#91a0b5]">Baseline WER</p><p className="mt-1 text-[15px] font-bold text-[#e16b70]">{latest.baselineWer}</p></div><div><p className="text-[8px] uppercase tracking-[0.12em] text-[#91a0b5]">Fine-tuned WER</p><p className="mt-1 text-[15px] font-bold text-[#35a783]">{latest.tunedWer}</p></div></div></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => goTo("compare")} className="rounded-lg bg-[#edf4ff] px-3 py-2 text-[9px] font-bold text-[#3568c1]">Compare models</button><button onClick={() => downloadTextFile("transcript.txt", latestTranscript)} className="rounded-lg border border-[#dce4ef] px-3 py-2 text-[9px] font-bold text-[#5f708d]"><Download size={11} className="mr-1 inline" />Download</button></div></div> : <div className="rounded-2xl border border-dashed border-[#d8e1ed] bg-[#fafcff] p-5"><FileText size={19} className="text-[#9aa9bf]" /><p className="mt-3 text-[11px] font-bold text-[#3b4e70]">No checks yet</p><p className="mt-1 text-[10px] leading-5 text-[#8190a8]">Your first transcription comparison will appear here.</p><button onClick={() => goTo("analyze")} className="mt-4 text-[9px] font-bold text-[#396fe8]">Create your first check <ArrowRight size={12} className="ml-1 inline" /></button></div>}
        </div>
      </section>

      <section className="mb-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[24px] border border-[#dfe6f0] bg-white p-5 shadow-[0_10px_32px_rgba(40,66,111,0.06)] sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#5278c2]">Research snapshot</p><h2 className="text-[18px] font-bold tracking-[-0.04em] text-[#1b2b49]">Performance by accent</h2></div><BarChart3 size={18} className="text-[#5278c2]" /></div><div className="flex h-44 items-end justify-around gap-3 rounded-2xl bg-[#f8faff] px-4 pb-4 pt-5 sm:px-8">{accentBars.map((bar) => <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[9px] font-bold text-[#637390]">{bar.value.toFixed(1)}%</span><div className="w-full max-w-12 rounded-t-lg" style={{ height: `${bar.value * 4.2}%`, background: `linear-gradient(180deg,${bar.color},${bar.color}99)` }} /><span className="text-center text-[8px] text-[#7788a4]">{bar.label}</span></div>)}</div></div>
        <div id="client-how" className="rounded-[24px] border border-[#dfe6f0] bg-[linear-gradient(145deg,#eef6ff,#f7f2ff)] p-5 sm:p-6"><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#5278c2]">Simple workflow</p><h2 className="text-[18px] font-bold tracking-[-0.04em] text-[#1b2b49]">From voice to insight</h2><div className="mt-5 space-y-4">{[{ step: "01", title: "Add audio", desc: "Record live or upload a sample." }, { step: "02", title: "Add context", desc: "Choose language and speaker details." }, { step: "03", title: "Review evidence", desc: "Compare WER, CER, and transcripts." }].map((item) => <div key={item.step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[8px] font-bold text-[#5278c2] shadow-sm">{item.step}</span><div><p className="text-[10px] font-bold text-[#304467]">{item.title}</p><p className="mt-0.5 text-[9px] leading-4 text-[#71809b]">{item.desc}</p></div></div>)}</div></div>
      </section>

      <section className="rounded-[20px] border border-[#dfe6f0] bg-white px-5 py-4 shadow-[0_8px_28px_rgba(40,66,111,0.04)]"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-[10px] font-bold text-[#2d4265]">Need a closer look?</p><p className="mt-1 text-[9px] text-[#8290a7]">Open the detailed comparison to inspect word-level differences and model improvement.</p></div><button onClick={() => goTo("compare")} className="shrink-0 rounded-lg bg-[#17243d] px-3.5 py-2 text-[9px] font-bold text-white transition hover:bg-[#2d3e5d]">Open comparison <ArrowRight size={12} className="ml-1 inline" /></button></div></section>
    </main>
  </div>;
}
