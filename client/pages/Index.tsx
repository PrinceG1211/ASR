import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleStop,
  ClipboardCheck,
  Clock3,
  Download,
  FileAudio,
  FileText,
  Gauge,
  GitCompareArrows,
  Home,
  Info,
  KeyRound,
  Layers3,
  Library,
  LogIn,
  LogOut,
  Menu,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import ClientDashboard from "@/components/ClientDashboard";
import AdminDashboard from "@/components/AdminDashboard";

export type View = "home" | "analyze" | "compare" | "results" | "admin";
export type UserRole = "admin" | "client";

export type Session = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type StoredUser = Session & { password: string };

export type EvaluationRecord = {
  id: string;
  ownerName: string;
  ownerEmail: string;
  fileName: string;
  accent: string;
  language: string;
  transcript: string;
  status: "complete" | "failed";
  createdAt: string;
  baselineWer: string;
  tunedWer: string;
};

const SESSION_KEY = "accentlens:session";
const USERS_KEY = "accentlens:users";
const EVALUATIONS_KEY = "accentlens:evaluations";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function readStoredUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(USERS_KEY) || "[]") as StoredUser[];
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null") as Session | null;
    return saved?.id && saved?.role ? saved : null;
  } catch {
    return null;
  }
}

function readEvaluations(): EvaluationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(EVALUATIONS_KEY) || "[]") as EvaluationRecord[];
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

type Accent = {
  id: string;
  name: string;
  region: string;
  samples: string;
  color: string;
};

const accents: Accent[] = [
  { id: "us", name: "American English", region: "North America", samples: "4,280 samples", color: "#63e6e9" },
  { id: "ind", name: "Indian English", region: "South Asia", samples: "3,960 samples", color: "#ff9b9b" },
  { id: "ng", name: "Nigerian English", region: "West Africa", samples: "3,740 samples", color: "#a78bfa" },
  { id: "scot", name: "Scottish English", region: "United Kingdom", samples: "3,120 samples", color: "#67e8f9" },
  { id: "aus", name: "Australian English", region: "Oceania", samples: "2,680 samples", color: "#fbbf24" },
  { id: "other", name: "Other accent", region: "Add your own label", samples: "Custom sample", color: "#7c8aa5" },
];

const comparisonRows = [
  { accent: "American English", code: "en-US", baselineWer: "7.8%", tunedWer: "6.4%", baselineCer: "3.1%", tunedCer: "2.5%", improvement: "18.0%", color: "#63e6e9" },
  { accent: "Indian English", code: "en-IN", baselineWer: "12.6%", tunedWer: "9.8%", baselineCer: "5.8%", tunedCer: "4.1%", improvement: "22.2%", color: "#ff9b9b" },
  { accent: "Nigerian English", code: "en-NG", baselineWer: "15.2%", tunedWer: "11.6%", baselineCer: "7.2%", tunedCer: "5.4%", improvement: "23.7%", color: "#a78bfa" },
  { accent: "Scottish English", code: "en-GB-Scot", baselineWer: "11.4%", tunedWer: "9.3%", baselineCer: "5.0%", tunedCer: "3.8%", improvement: "18.4%", color: "#67e8f9" },
];

const demoSamples = [
  { name: "The weather is lovely today", accent: "Scottish English", duration: "00:06" },
  { name: "Could you send the report over?", accent: "Indian English", duration: "00:05" },
  { name: "We are meeting after lunch", accent: "Nigerian English", duration: "00:04" },
];

const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const AUDIO_EXTENSIONS = /\.(wav|mp3|m4a|aac|ogg|flac|webm)$/i;

const languages = [
  { value: "auto", label: "Auto-detect language" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "hi-IN", label: "हिन्दी · Hindi" },
  { value: "es-ES", label: "Español · Spanish" },
  { value: "fr-FR", label: "Français · French" },
  { value: "de-DE", label: "Deutsch · German" },
  { value: "pt-BR", label: "Português · Portuguese" },
  { value: "ar-SA", label: "العربية · Arabic" },
  { value: "zh-CN", label: "中文 · Mandarin" },
  { value: "ja-JP", label: "日本語 · Japanese" },
  { value: "ko-KR", label: "한국어 · Korean" },
  { value: "ru-RU", label: "Русский · Russian" },
  { value: "it-IT", label: "Italiano · Italian" },
  { value: "tr-TR", label: "Türkçe · Turkish" },
  { value: "id-ID", label: "Bahasa Indonesia" },
  { value: "sw-KE", label: "Kiswahili · Swahili" },
  { value: "bn-BD", label: "বাংলা · Bengali" },
  { value: "ta-IN", label: "தமிழ் · Tamil" },
  { value: "yo-NG", label: "Yorùbá · Yoruba" },
];

type SpeechRecognitionEventLike = Event & { results: { length: number; [index: number]: { [index: number]: { transcript: string } } } };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | undefined {
  const speechWindow = window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function downloadTextFile(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`${fileName} downloaded.`);
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const completeAuth = (session: Session) => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    toast.success(mode === "register" ? "Account created. Welcome to AccentLens." : "Welcome back to AccentLens.");
    onAuthenticated(session);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 6) {
      setError("Enter a valid email and a password with at least 6 characters.");
      return;
    }
    if (mode === "register") {
      if (!name.trim()) { setError("Add your name to create an account."); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
      const users = readStoredUsers();
      if (users.some((user) => user.email === normalizedEmail) || normalizedEmail === "admin@accentlens.ai") {
        setError("An account with this email already exists.");
        return;
      }
      const user: StoredUser = { id: createId(), name: name.trim(), email: normalizedEmail, role: "client", password };
      window.localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
      completeAuth({ id: user.id, name: user.name, email: user.email, role: user.role });
      return;
    }
    const adminMatches = normalizedEmail === "admin@accentlens.ai" && password === "admin123";
    const client = readStoredUsers().find((user) => user.email === normalizedEmail && user.password === password);
    if (!adminMatches && !client) {
      setError("Email or password is incorrect. Use the demo admin credentials or register as a client.");
      return;
    }
    completeAuth(adminMatches ? { id: "demo-admin", name: "AccentLens Admin", email: normalizedEmail, role: "admin" } : { id: client!.id, name: client!.name, email: client!.email, role: "client" });
  };

  return <div className="min-h-screen overflow-hidden bg-[#0b1020] px-5 py-8 text-[#f4f7ff] sm:px-8"><div className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-[#63e6e9]/10 blur-3xl" /><div className="pointer-events-none fixed -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#a78bfa]/15 blur-3xl" /><div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]"><div className="hidden lg:block"><div className="mb-8 flex items-center gap-3"><LogoMark /><div><p className="text-[15px] font-bold tracking-[-0.03em]">accent<span className="text-[#63e6e9]">/</span>lens</p><p className="text-[9px] uppercase tracking-[0.16em] text-[#7483a4]">ASR bias lab</p></div></div><p className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9ee7e9]">Speech intelligence workspace</p><h1 className="max-w-xl text-5xl font-semibold leading-[1.03] tracking-[-0.06em] text-[#f4f7ff]">Measure every voice with <span className="bg-gradient-to-r from-[#63e6e9] via-[#a78bfa] to-[#fb7185] bg-clip-text text-transparent">more fairness.</span></h1><p className="mt-6 max-w-lg text-sm leading-7 text-[#94a2bd]">Evaluate accent bias, compare ASR models, and turn real audio into evidence your team can act on.</p><div className="mt-10 grid max-w-lg grid-cols-3 gap-3">{[{ value: "4", label: "accent groups" }, { value: "20+", label: "languages" }, { value: "2", label: "ASR models" }].map((item) => <div key={item.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4"><p className="text-2xl font-semibold text-[#f4f7ff]">{item.value}</p><p className="mt-1 text-[10px] text-[#7e8ca8]">{item.label}</p></div>)}</div></div><div className="mx-auto w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#151d37]/90 p-6 shadow-[0_24px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8"><div className="mb-7 flex items-center gap-3 lg:hidden"><LogoMark /><div><p className="text-[15px] font-bold">accent<span className="text-[#63e6e9]">/</span>lens</p><p className="text-[9px] uppercase tracking-[0.16em] text-[#7483a4]">ASR bias lab</p></div></div><div className="mb-7"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#63e6e9]/20 to-[#a78bfa]/20 text-[#63e6e9]"><ShieldCheck size={19} /></div><h2 className="text-2xl font-semibold tracking-[-0.04em]">{mode === "login" ? "Welcome back" : "Create your account"}</h2><p className="mt-2 text-[11px] leading-5 text-[#8190ad]">{mode === "login" ? "Sign in to continue your audio evaluations." : "Create a client workspace to start testing speech models."}</p></div><form onSubmit={handleSubmit} className="space-y-4">{mode === "register" && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8795b1]">Full name</span><input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-white/[0.1] bg-[#1b2644] px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#566681] focus:border-[#63e6e9]/60" placeholder="Your name" /></label>}<label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8795b1]">Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-white/[0.1] bg-[#1b2644] px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#566681] focus:border-[#63e6e9]/60" placeholder="you@example.com" /></label><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8795b1]">Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/[0.1] bg-[#1b2644] px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#566681] focus:border-[#63e6e9]/60" placeholder="At least 6 characters" /></label>{mode === "register" && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8795b1]">Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-white/[0.1] bg-[#1b2644] px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#566681] focus:border-[#63e6e9]/60" placeholder="Repeat password" /></label>}{error && <p className="rounded-xl border border-[#fb7185]/20 bg-[#fb7185]/10 px-3 py-2.5 text-[10px] leading-4 text-[#ffc1c5]">{error}</p>}<button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#63e6e9] to-[#a78bfa] px-4 py-3 text-[11px] font-bold text-[#07171e] transition hover:brightness-110"><LogIn size={15} />{mode === "login" ? "Sign in" : "Create client account"}</button></form>{mode === "login" && <button onClick={() => { setEmail("admin@accentlens.ai"); setPassword("admin123"); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#63e6e9]/20 bg-[#63e6e9]/[0.05] px-3 py-2.5 text-[10px] font-semibold text-[#a7f3f2] hover:bg-[#63e6e9]/10"><KeyRound size={13} />Use demo admin access</button>}<div className="my-6 flex items-center gap-3 text-[9px] uppercase tracking-[0.16em] text-[#657493]"><span className="h-px flex-1 bg-white/[0.08]" />{mode === "login" ? "New to AccentLens?" : "Already have access?"}<span className="h-px flex-1 bg-white/[0.08]" /></div><button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="w-full rounded-xl border border-white/[0.1] px-4 py-3 text-[11px] font-semibold text-[#d7e2f4] transition hover:border-white/25">{mode === "login" ? "Register as a client" : "Back to sign in"}</button><p className="mt-6 text-center text-[9px] leading-4 text-[#667594]">Demo mode stores accounts only in this browser. Connect a secure auth backend before production use.</p></div></div></div>;
}

function LogoMark() {
  return <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#63e6e9,#a78bfa)] text-[#07171e] shadow-[0_0_30px_rgba(99,230,233,0.22)]"><Waves size={18} strokeWidth={2.6} /><span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#fb7185]" /></div>;
}

function SectionEyebrow({ children, color = "lime" }: { children: ReactNode; color?: "lime" | "orange" | "lavender" }) {
  const colorClass = color === "orange" ? "text-[#ff9b9b]" : color === "lavender" ? "text-[#c4b5fd]" : "text-[#9ee7e9]";
  return <p className={`mb-3 text-[10px] font-bold uppercase tracking-[0.18em] ${colorClass}`}>{children}</p>;
}

function Metric({ label, value, detail, icon: Icon, trend, accent = "lime" }: { label: string; value: string; detail: string; icon: typeof Gauge; trend: string; accent?: "lime" | "orange" | "lavender" }) {
  const iconColor = accent === "orange" ? "text-[#ff9b9b] bg-[#ff9b9b]/10" : accent === "lavender" ? "text-[#c4b5fd] bg-[#c4b5fd]/10" : "text-[#63e6e9] bg-[#63e6e9]/10";
  return <div className="rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 transition hover:-translate-y-0.5 hover:border-white/[0.14]"><div className="mb-5 flex items-center justify-between"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconColor}`}><Icon size={16} /></div><span className="rounded-full bg-[#63e6e9]/10 px-2 py-1 text-[10px] font-semibold text-[#63e6e9]">{trend}</span></div><p className="text-[11px] font-medium text-[#7e898d]">{label}</p><div className="mt-1 flex items-end gap-2"><p className="text-[27px] font-semibold tracking-[-0.05em] text-[#f4f7ff]">{value}</p><p className="mb-1 text-[10px] text-[#737e82]">{detail}</p></div></div>;
}

function Waveform({ compact = false }: { compact?: boolean }) {
  const bars = [32, 58, 42, 78, 51, 90, 65, 46, 71, 54, 86, 38, 61, 76, 49, 88, 57, 36, 64, 48, 79, 55, 42, 70, 91, 62, 44, 73, 52, 81, 39, 67, 49, 76, 57, 87, 45, 63, 52, 74, 41, 82, 59, 69, 47, 88, 60, 37, 72];
  return <div className={`flex items-center gap-[3px] ${compact ? "h-8" : "h-14"}`}>{bars.map((height, index) => <span key={index} className={`w-[3px] rounded-full ${index < 28 ? "bg-[#63e6e9]" : "bg-[#66758e]"}`} style={{ height: `${compact ? Math.max(26, height * 0.55) : height}%`, opacity: index < 28 ? 0.9 : 0.6 }} />)}</div>;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function AudioPlayer({ fileName, onPlay, src, duration: fallbackDuration = 6 }: { fileName: string; onPlay: () => void; src?: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);
  const [volume, setVolume] = useState(1);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);
  const togglePlayback = async () => {
    if (audioRef.current) {
      if (audioRef.current.paused) await audioRef.current.play();
      else audioRef.current.pause();
    }
    setPlaying((value) => !value);
    onPlay();
  };
  return <div className="rounded-xl border border-white/[0.07] bg-[#1a2541] p-4"><audio ref={audioRef} src={src} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onEnded={() => { setPlaying(false); setCurrentTime(0); }} className="hidden" /><div className="flex items-center gap-3"><button onClick={() => void togglePlayback()} aria-label={playing ? "Pause audio" : "Play audio"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#63e6e9] text-[#07171e] transition hover:bg-[#8ff7f2]">{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-[11px] font-semibold text-[#e5ede4]">{fileName}</p><span className="font-mono text-[10px] text-[#778386]">{formatDuration(currentTime)} / {formatDuration(duration)}</span></div><div className="mt-2"><Waveform compact /></div><input aria-label="Seek audio" type="range" min="0" max={duration || 1} step="0.1" value={Math.min(currentTime, duration || 1)} onChange={(event) => { const nextTime = Number(event.target.value); setCurrentTime(nextTime); if (audioRef.current) audioRef.current.currentTime = nextTime; }} className="mt-2 h-1 w-full cursor-pointer accent-[#63e6e9]" /><div className="mt-2 flex items-center justify-between gap-3"><span className="text-[9px] text-[#7786a2]">{src ? "Original audio" : "Preview waveform"}</span><label className="flex items-center gap-2 text-[9px] text-[#7786a2]">Volume<input aria-label="Audio volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-16 cursor-pointer accent-[#a78bfa]" /></label></div></div></div></div>;
}

function HomeView({ goTo }: { goTo: (view: View) => void }) {
  return <>
    <div className="mb-8 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.75fr)]">
      <section className="relative overflow-hidden rounded-3xl gradient-drift border border-[#63e6e9]/20 bg-[radial-gradient(circle_at_82%_15%,rgba(99,230,233,0.24),transparent_32%),radial-gradient(circle_at_15%_85%,rgba(167,139,250,0.2),transparent_32%),linear-gradient(120deg,#132a46,#171d3d_52%,#372057)] p-6 sm:p-8"><div className="hero-orb absolute -right-16 -top-20 h-64 w-64 rounded-full border border-[#63e6e9]/20 bg-[#63e6e9]/[0.03]" /><div className="hero-orb hero-orb-delay absolute -right-4 -top-8 h-40 w-40 rounded-full border border-[#a78bfa]/25 bg-[#a78bfa]/[0.04]" /><div className="relative max-w-2xl"><div className="mb-5 flex items-center gap-2"><span className="shimmer-line flex h-6 items-center gap-2 rounded-full border border-[#63e6e9]/20 bg-[#63e6e9]/10 px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a7f3f2]"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e9] shadow-[0_0_8px_#63e6e9]" />Research workspace</span><span className="text-[10px] text-[#6e7a7d]">v0.9 · Common Voice</span></div><h1 className="max-w-xl text-[32px] font-semibold leading-[1.08] tracking-[-0.055em] text-[#f1f6ed] sm:text-[42px]">Make speech recognition work for <span className="text-[#63e6e9]">every voice.</span></h1><p className="mt-5 max-w-lg text-[13px] leading-6 text-[#a2afaa]">Detect accent bias in ASR models, compare baseline and fine-tuned performance, and turn every evaluation into a measurable improvement.</p><div className="mt-7 flex flex-wrap gap-3"><button onClick={() => goTo("analyze")} className="flex items-center gap-2 rounded-lg bg-[#63e6e9] px-4 py-2.5 text-[11px] font-bold text-[#07171e] transition hover:bg-[#8ff7f2]"><Mic size={14} />Analyze an audio sample</button><button onClick={() => goTo("results")} className="flex items-center gap-2 rounded-lg border border-white/[0.12] px-4 py-2.5 text-[11px] font-semibold text-[#d7e2d9] transition hover:border-white/25 hover:bg-white/[0.05]"><BarChart3 size={14} />View results</button></div></div></section>
      <section className="rounded-3xl border border-white/[0.07] bg-[#151d37] p-6"><div className="mb-5 flex items-center justify-between"><div><SectionEyebrow color="orange">Project purpose</SectionEyebrow><h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[#f4f7ff]">Find the gap. Close it.</h2></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff9b9b]/10 text-[#ff9b9b]"><GitCompareArrows size={17} /></div></div><p className="text-[12px] leading-6 text-[#8e9a9c]">Quantify baseline WER and CER per accent, then test whether balanced fine-tuning makes the gap smaller.</p><div className="mt-6 space-y-3"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ff9b9b]/15 text-[10px] font-bold text-[#ff9b9b]">01</span><p className="text-[11px] leading-5 text-[#c0cbc2]">Evaluate one pretrained model across selected accents</p></div><div className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#a78bfa]/15 text-[10px] font-bold text-[#a78bfa]">02</span><p className="text-[11px] leading-5 text-[#c0cbc2]">Adapt it with a balanced, accent-labeled dataset</p></div><div className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#63e6e9]/15 text-[10px] font-bold text-[#63e6e9]">03</span><p className="text-[11px] leading-5 text-[#c0cbc2]">Compare the result and explain the remaining limitations</p></div></div></section>
    </div>
    <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Overall word error rate" value="11.8%" detail="baseline model" trend="↓ 2.4%" icon={Gauge} /><Metric label="Accent performance gap" value="7.4pp" detail="best → worst" trend="↓ 1.9pp" icon={Activity} accent="orange" /><Metric label="Samples evaluated" value="15.1k" detail="across 4 accents" trend="+ 18.6%" icon={FileAudio} accent="lavender" /><Metric label="Mitigation improvement" value="20.6%" detail="average WER" trend="Promising" icon={Zap} /></div>
    <section className="mb-8 rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-6 flex items-center justify-between"><div><SectionEyebrow>How it works</SectionEyebrow><h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#f4f7ff]">From audio sample to evidence</h2></div><button onClick={() => goTo("analyze")} className="hidden items-center gap-1 text-[10px] font-bold text-[#63e6e9] sm:flex">Start an evaluation <ArrowRight size={13} /></button></div><div className="grid gap-4 md:grid-cols-4">{[{ step: "01", title: "Add audio", desc: "Upload, record, or select a demo sample.", icon: UploadCloud, color: "text-[#63e6e9] bg-[#63e6e9]/10" }, { step: "02", title: "Label accents", desc: "Choose the accents you want to compare.", icon: Users, color: "text-[#ff9b9b] bg-[#ff9b9b]/10" }, { step: "03", title: "Run both models", desc: "Transcribe with baseline and adapted ASR.", icon: Layers3, color: "text-[#a78bfa] bg-[#a78bfa]/10" }, { step: "04", title: "Read the gap", desc: "Inspect errors, WER, CER, and improvement.", icon: ClipboardCheck, color: "text-[#67e8f9] bg-[#67e8f9]/10" }].map(({ step, title, desc, icon: Icon, color }) => <div key={step} className="rounded-xl border border-white/[0.06] bg-[#1b2644] p-4"><div className="mb-5 flex items-center justify-between"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}><Icon size={16} /></div><span className="font-mono text-[10px] text-[#657276]">{step}</span></div><h3 className="text-[12px] font-semibold text-[#dce5dd]">{title}</h3><p className="mt-1.5 text-[11px] leading-5 text-[#788487]">{desc}</p></div>)}</div></section>
    <section className="rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><SectionEyebrow color="lavender">Recent evaluations</SectionEyebrow><h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#f4f7ff]">Your latest evidence</h2></div><button onClick={() => goTo("results")} className="text-[10px] font-bold text-[#63e6e9]">View all <ArrowUpRight size={12} className="ml-1 inline" /></button></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.14em] text-[#687578]"><th className="pb-3 font-semibold">Sample</th><th className="pb-3 font-semibold">Accent</th><th className="pb-3 font-semibold">Baseline WER</th><th className="pb-3 font-semibold">Fine-tuned WER</th><th className="pb-3 font-semibold">Status</th><th className="pb-3" /></tr></thead><tbody>{[{ sample: "weather_sample_04.wav", accent: "Scottish English", base: "11.4%", tuned: "9.3%", status: "Complete", color: "#67e8f9" }, { sample: "meeting_sample_12.wav", accent: "Indian English", base: "12.6%", tuned: "9.8%", status: "Complete", color: "#ff9b9b" }, { sample: "report_sample_08.wav", accent: "Nigerian English", base: "15.2%", tuned: "11.6%", status: "Processing", color: "#a78bfa" }].map((row) => <tr key={row.sample} className="border-b border-white/[0.04] text-[11px] text-[#aebbb2]"><td className="py-3 font-mono text-[#d7e1d8]">{row.sample}</td><td className="py-3"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: row.color }} />{row.accent}</td><td className="py-3 text-[#ff9b9b]">{row.base}</td><td className="py-3 text-[#63e6e9]">{row.tuned}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[9px] ${row.status === "Complete" ? "bg-[#63e6e9]/10 text-[#63e6e9]" : "bg-[#a78bfa]/10 text-[#c4b5fd]"}`}>{row.status}</span></td><td className="py-3 text-right"><ArrowUpRight size={13} className="text-[#657276]" /></td></tr>)}</tbody></table></div></section>
  </>;
}

function AnalyzeView({ selectedAccent, setSelectedAccent, fileName, setFileName, runAnalysis, analysisStatus, transcript, setTranscript }: { selectedAccent: string; setSelectedAccent: (value: string) => void; fileName: string; setFileName: (value: string) => void; runAnalysis: (details: { transcript: string; accent: string; language: string }) => void; analysisStatus: string; transcript: string; setTranscript: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showDemos, setShowDemos] = useState(false);
  const [language, setLanguage] = useState("auto");
  const [recordingError, setRecordingError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const activeAccent = accents.find((accent) => accent.id === selectedAccent) ?? accents[0];

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recognitionRef.current?.stop();
  }, []);

  const startSpeechRecognition = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      toast.info("Live transcription is not supported in this browser. Your recording is still saved.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = language === "auto" ? navigator.language || "en-US" : language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
      setTranscript(transcript);
    };
    recognition.onerror = () => toast.info("Speech recognition stopped. You can still evaluate the recorded audio.");
    recognitionRef.current = recognition;
    recognition.start();
  };

  const startRecording = async () => {
    setRecordingError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Live recording is not supported in this browser.");
      toast.error("This browser does not provide microphone recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setRecording(false);
        setRecordingSeconds(0);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (blob.size < 1000) {
          setFileName("");
          setAudioUrl("");
          toast.error("That recording was empty. Speak for a moment and try again.");
          return;
        }
        setAudioUrl(URL.createObjectURL(blob));
        setFileName(`live-recording-${new Date().toISOString().slice(11, 19).replace(/:/g, "-")}.webm`);
        toast.success(`Recorded ${(blob.size / 1024).toFixed(0)} KB of audio.`);
      };
      streamRef.current = stream;
      recorderRef.current = recorder;
      setTranscript("");
      setRecordingSeconds(0);
      setRecording(true);
      recorder.start();
      startSpeechRecognition();
      toast.success("Microphone is live. Start speaking.");
    } catch {
      setRecordingError("Microphone access was denied. Allow microphone access and try again.");
      toast.error("Microphone access is required to record audio.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recognitionRef.current?.stop();
    recorderRef.current = null;
    recognitionRef.current = null;
  };

  const handleRecordClick = () => {
    if (recording) stopRecording();
    else void startRecording();
  };

  return <>
    <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><SectionEyebrow>Audio input & evaluation setup</SectionEyebrow><h1 className="text-[29px] font-semibold tracking-[-0.05em] text-[#f0f5ed]">Analyze an audio sample</h1><p className="mt-2 max-w-xl text-[12px] leading-5 text-[#829092]">Set up a controlled comparison between the pretrained baseline and the balanced fine-tuned model.</p></div><div className="flex items-center gap-2 text-[10px] text-[#758185]"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e9]" />Evaluation engine ready</div></div>
    <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1"><div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold text-[#63e6e9]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#63e6e9] text-[#07171e]">1</span>Audio input</div><span className="h-px w-8 shrink-0 bg-white/[0.1]" /><div className="flex shrink-0 items-center gap-2 text-[10px] text-[#8b9798]"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.15]">2</span>Accent labels</div><span className="h-px w-8 shrink-0 bg-white/[0.1]" /><div className="flex shrink-0 items-center gap-2 text-[10px] text-[#8b9798]"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.15]">3</span>Run evaluation</div></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-6 flex items-start justify-between"><div><h2 className="text-[15px] font-semibold text-[#f4f7ff]">Choose your audio</h2><p className="mt-1 text-[11px] text-[#7b878a]">Accepted formats: WAV, MP3, M4A · max 25 MB</p></div><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#63e6e9]/10 text-[#63e6e9]"><FileAudio size={16} /></div></div><input ref={inputRef} type="file" accept="audio/*,.wav,.mp3,.m4a" className="hidden" onChange={(event) => { const selectedFile = event.target.files?.[0]; if (!selectedFile) return; const validType = selectedFile.type.startsWith("audio/") || AUDIO_EXTENSIONS.test(selectedFile.name); if (!validType) { toast.error("Choose a supported audio file: WAV, MP3, M4A, AAC, OGG, FLAC, or WebM."); event.currentTarget.value = ""; return; } if (selectedFile.size > MAX_AUDIO_SIZE) { toast.error("Audio files must be smaller than 25 MB."); event.currentTarget.value = ""; return; } setAudioUrl(URL.createObjectURL(selectedFile)); setFileName(selectedFile.name); toast.success(`${selectedFile.name} added to this evaluation.`); }} /><button onClick={() => inputRef.current?.click()} className="group flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#536264] bg-[#1b2644] px-5 py-8 transition hover:border-[#63e6e9]/60 hover:bg-[#22302c]"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#63e6e9]/10 text-[#63e6e9] transition group-hover:scale-105"><UploadCloud size={20} /></div><p className="text-[12px] font-semibold text-[#dce7dd]">Drop an audio file here</p><p className="mt-1 text-[10px] text-[#758184]">or click to browse from your device</p></button><div className="my-5 flex items-center gap-3 text-[9px] uppercase tracking-[0.15em] text-[#667276]"><span className="h-px flex-1 bg-white/[0.07]" />or use a sample<span className="h-px flex-1 bg-white/[0.07]" /></div><div className="grid grid-cols-2 gap-2"><button onClick={handleRecordClick} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[10px] font-semibold transition ${recording ? "recording-pulse border-[#fb7185]/40 bg-[#fb7185]/10 text-[#ffc1c5]" : "border-white/[0.1] text-[#c2cdc4] hover:border-white/[0.2]"}`}>{recording ? <CircleStop size={14} /> : <Mic size={14} />}{recording ? `Stop · 00:${String(recordingSeconds).padStart(2, "0")}` : "Record audio"}</button><button onClick={() => setShowDemos(!showDemos)} className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.1] px-3 py-2.5 text-[10px] font-semibold text-[#c2cdc4] transition hover:border-white/[0.2]"><Library size={14} />Demo samples<ChevronDown size={12} className={`transition ${showDemos ? "rotate-180" : ""}`} /></button></div>{showDemos && <div className="mt-3 space-y-2 rounded-xl border border-white/[0.07] bg-[#1b2644] p-2">{demoSamples.map((sample) => <button key={sample.name} onClick={() => { setFileName(`${sample.accent.toLowerCase().replace(/ /g, "-")}-demo.wav`); setShowDemos(false); toast.success(`${sample.accent} demo loaded.`); }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.05]"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#a78bfa]/10 text-[#a78bfa]"><Play size={11} fill="currentColor" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-[#dce6de]">{sample.name}</span><span className="text-[9px] text-[#748083]">{sample.accent} · {sample.duration}</span></span><ArrowRight size={12} className="text-[#657276]" /></button>)}</div>}{fileName && <div className="mt-5"><AudioPlayer fileName={fileName} src={audioUrl || undefined} onPlay={() => undefined} />{transcript && <div className="mt-3 rounded-xl border border-[#67e8f9]/15 bg-[#67e8f9]/[0.04] p-3"><div className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#67e8f9]"><Activity size={11} />Live transcript</div><p className="text-[11px] leading-5 text-[#c5d6d1]">{transcript}</p></div>}{recordingError && <p className="mt-2 text-[10px] text-[#ffc1c5]">{recordingError}</p>}</div>}</section>
      <section className="rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-6 flex items-start justify-between"><div><h2 className="text-[15px] font-semibold text-[#f4f7ff]">Select accent labels</h2><p className="mt-1 text-[11px] text-[#7b878a]">Choose the accent group this sample belongs to.</p></div><button onClick={() => toast.info("Accent labels power the per-group WER and CER comparison.")} className="text-[#748083] hover:text-[#dce5de]"><Info size={16} /></button></div><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748083]">Spoken language</label><div className="relative mb-4"><select value={language} onChange={(event) => setLanguage(event.target.value)} className="w-full appearance-none rounded-lg border border-white/[0.09] bg-[#1b2644] px-3 py-2.5 text-[11px] text-[#dce6de] outline-none focus:border-[#63e6e9]/50">{languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-[#718083]" /></div><div className="grid gap-2 sm:grid-cols-2">{accents.map((accent) => <button key={accent.id} onClick={() => setSelectedAccent(accent.id)} className={`relative rounded-xl border p-3 text-left transition ${selectedAccent === accent.id ? "border-[#63e6e9]/50 bg-[#63e6e9]/[0.07]" : "border-white/[0.07] bg-[#1b2644] hover:border-white/[0.16]"}`}><div className="flex items-start justify-between gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: accent.color, backgroundColor: `${accent.color}18` }}><Users size={14} /></span>{selectedAccent === accent.id && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#63e6e9] text-[#07171e]"><Check size={10} strokeWidth={3} /></span>}</div><p className="mt-3 text-[11px] font-semibold text-[#dce6de]">{accent.name}</p><p className="mt-1 text-[9px] text-[#718084]">{accent.region}</p><p className="mt-3 font-mono text-[9px] text-[#85918f]">{accent.samples}</p></button>)}</div><div className="mt-5 rounded-xl border border-[#ff9b9b]/15 bg-[#ff9b9b]/[0.04] p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeAccent.color }} /><span className="text-[10px] font-semibold text-[#d7dfd6]">Selected: {activeAccent.name}</span></div><p className="mt-1.5 text-[10px] leading-4 text-[#85918b]">This label will be used for per-accent WER and CER reporting.</p></div><button onClick={() => runAnalysis({ transcript, accent: activeAccent.name, language })} disabled={analysisStatus === "running"} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#63e6e9] px-4 py-3 text-[11px] font-bold text-[#07171e] transition hover:bg-[#8ff7f2] disabled:cursor-not-allowed disabled:opacity-40">{analysisStatus === "running" ? <><RotateCcw size={14} className="animate-spin" />Running baseline & fine-tuned models…</> : analysisStatus === "complete" ? <><CheckCircle2 size={14} />Analysis complete — view comparison</> : <><Zap size={14} />Run bias evaluation</>}</button></section>
    </div>
  </>;
}

function CompareView({ selectedAccent, goTo }: { selectedAccent: string; goTo: (view: View) => void }) {
  const accent = accents.find((item) => item.id === selectedAccent) ?? accents[0];
  return <>
    <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><SectionEyebrow color="lavender">Transcription comparison</SectionEyebrow><h1 className="text-[29px] font-semibold tracking-[-0.05em] text-[#f0f5ed]">See what changed</h1><p className="mt-2 text-[12px] text-[#829092]">A word-level view of where the adapted model catches up.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-[#63e6e9]/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#63e6e9]">Evaluation complete</span><button onClick={() => goTo("analyze")} className="rounded-lg border border-white/[0.1] p-2 text-[#9aa7a4] hover:border-white/20 hover:text-white"><RotateCcw size={14} /></button></div></div>
    <section className="mb-5 rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#63e6e9]/10 text-[#63e6e9]"><FileAudio size={17} /></div><div><h2 className="text-[13px] font-semibold text-[#e8f0e8]">scottish-english-demo.wav</h2><p className="mt-1 text-[10px] text-[#758185]">{accent.name} · 00:06 · Common Voice test split</p></div></div><button onClick={() => downloadTextFile("accentlens-sample-transcription.txt", "The weather is lovely today, and the light is perfect for a walk.\n\nBaseline WER: 11.4%\nFine-tuned WER: 9.3%\n")} className="flex items-center gap-2 text-[10px] font-semibold text-[#63e6e9]"><Download size={13} />Export sample</button></div><AudioPlayer fileName="Original audio waveform" onPlay={() => undefined} /><div className="mt-5 grid gap-3 md:grid-cols-[110px_1fr]"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#667377]">Ground truth</p></div><p className="text-[13px] leading-6 text-[#e6eee6]">The weather is lovely today, and the light is perfect for a walk.</p></div></section>
    <div className="mb-5 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-5 flex items-start justify-between"><div><div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ff9b9b]" /><h2 className="text-[14px] font-semibold text-[#e8f0e8]">Baseline model</h2></div><p className="text-[10px] text-[#748083]">Whisper small · pretrained</p></div><span className="rounded-full bg-[#ff9b9b]/10 px-2 py-1 text-[10px] font-semibold text-[#ff9b9b]">WER 11.4%</span></div><p className="rounded-xl border border-white/[0.06] bg-[#1b2644] p-4 text-[13px] leading-7 text-[#aab7b0]">The <span className="rounded bg-[#ff9b9b]/20 px-1 text-[#ff9b9b]">weather</span> is lovely today, and the <span className="rounded bg-[#ff9b9b]/20 px-1 text-[#ff9b9b]">light's</span> perfect for a walk.</p><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#1b2644] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-[#687578]">Word error rate</p><p className="mt-1 text-[20px] font-semibold text-[#ff9b9b]">11.4%</p></div><div className="rounded-lg bg-[#1b2644] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-[#687578]">Character error rate</p><p className="mt-1 text-[20px] font-semibold text-[#ff9b9b]">5.0%</p></div></div></section><section className="rounded-2xl border border-[#63e6e9]/20 bg-[linear-gradient(145deg,#1b2a25,#151d37)] p-5 sm:p-6"><div className="mb-5 flex items-start justify-between"><div><div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#63e6e9] shadow-[0_0_8px_#63e6e9]" /><h2 className="text-[14px] font-semibold text-[#e8f0e8]">Fine-tuned model</h2></div><p className="text-[10px] text-[#748083]">Balanced-v2 adapter · adapted</p></div><span className="rounded-full bg-[#63e6e9]/10 px-2 py-1 text-[10px] font-semibold text-[#63e6e9]">WER 9.3%</span></div><p className="rounded-xl border border-[#63e6e9]/10 bg-[#1f3029] p-4 text-[13px] leading-7 text-[#e7f1e4]">The weather is lovely today, and the light is perfect for a walk.</p><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#1e3028] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-[#718279]">Word error rate</p><p className="mt-1 text-[20px] font-semibold text-[#63e6e9]">9.3%</p></div><div className="rounded-lg bg-[#1e3028] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-[#718279]">Character error rate</p><p className="mt-1 text-[20px] font-semibold text-[#63e6e9]">3.8%</p></div></div></section></div>
    <section className="rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><SectionEyebrow color="orange">Difference analysis</SectionEyebrow><h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#f4f7ff]">Where the baseline missed</h2></div><span className="text-[10px] text-[#778386]">3 word differences</span></div><div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]"><div><p className="mb-3 text-[9px] font-bold uppercase tracking-[0.14em] text-[#657276]">Token comparison</p><div className="flex flex-wrap gap-2 rounded-xl border border-white/[0.06] bg-[#1b2644] p-4">{[{ word: "The", type: "correct" }, { word: "weather", type: "incorrect" }, { word: "is", type: "correct" }, { word: "lovely", type: "correct" }, { word: "today", type: "correct" }, { word: "and", type: "correct" }, { word: "the", type: "correct" }, { word: "light's", type: "incorrect" }, { word: "perfect", type: "correct" }, { word: "for", type: "correct" }, { word: "a", type: "correct" }, { word: "walk", type: "correct" }].map((token, index) => <span key={`${token.word}-${index}`} className={`rounded-md px-2 py-1.5 text-[11px] ${token.type === "incorrect" ? "bg-[#ff9b9b]/15 text-[#ff9b9b] line-through decoration-[#ff9b9b]/70" : "bg-[#63e6e9]/10 text-[#b9d9a7]"}`}>{token.word}</span>)}</div><div className="mt-3 flex flex-wrap gap-4 text-[10px] text-[#7d898b]"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#63e6e9]/70" />Correct words <strong className="ml-1 text-[#d9e5d8]">10</strong></span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#ff9b9b]/70" />Incorrect words <strong className="ml-1 text-[#d9e5d8]">2</strong></span></div></div><div className="rounded-xl border border-[#63e6e9]/15 bg-[#63e6e9]/[0.04] p-4"><div className="mb-4 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#63e6e9]/10 text-[#63e6e9]"><ArrowDownRight size={16} /></div><p className="text-[12px] font-semibold text-[#e4eee0]">Meaningful improvement</p></div><p className="text-[28px] font-semibold tracking-[-0.05em] text-[#63e6e9]">18.4%</p><p className="mt-1 text-[10px] leading-5 text-[#829087]">relative WER improvement after accent-balanced adaptation.</p><button onClick={() => goTo("results")} className="mt-5 flex items-center gap-1 text-[10px] font-bold text-[#63e6e9]">See accent-wide results <ArrowRight size={12} /></button></div></div></section>
  </>;
}

function AdminView({ evaluations }: { evaluations: EvaluationRecord[] }) {
  return <><div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><SectionEyebrow color="lavender">Admin console</SectionEyebrow><h1 className="text-[29px] font-semibold tracking-[-0.05em] text-[#f4f7ff]">All evaluation data</h1><p className="mt-2 text-[12px] text-[#8294b6]">Monitor client submissions, transcription status, and model improvements.</p></div><span className="flex items-center gap-2 rounded-full border border-[#63e6e9]/20 bg-[#63e6e9]/[0.06] px-3 py-1.5 text-[10px] font-semibold text-[#9ee7e9]"><ShieldCheck size={13} />Admin access</span></div><div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Registered evaluations" value={String(evaluations.length)} detail="stored in browser" trend="Live" icon={ClipboardCheck} /><Metric label="Client submissions" value={String(new Set(evaluations.map((item) => item.ownerEmail)).size)} detail="unique clients" trend="Tracked" icon={Users} accent="lavender" /><Metric label="Completed runs" value={String(evaluations.filter((item) => item.status === "complete").length)} detail="with results" trend="Ready" icon={CheckCircle2} accent="orange" /></div><section className="rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><SectionEyebrow>Client activity</SectionEyebrow><h2 className="text-[17px] font-semibold text-[#f4f7ff]">Evaluation history</h2></div><span className="text-[10px] text-[#7789a9]">{evaluations.length} records</span></div>{evaluations.length === 0 ? <div className="rounded-xl border border-dashed border-white/[0.12] px-6 py-12 text-center"><ClipboardCheck className="mx-auto mb-3 text-[#63e6e9]" size={24} /><p className="text-[12px] font-semibold text-[#dce7f4]">No client evaluations yet</p><p className="mt-1 text-[10px] text-[#7789a9]">Completed client runs will appear here automatically.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.14em] text-[#6c7b9d]"><th className="pb-3 font-semibold">Client</th><th className="pb-3 font-semibold">Audio sample</th><th className="pb-3 font-semibold">Accent / language</th><th className="pb-3 font-semibold">Transcript</th><th className="pb-3 font-semibold">Status</th><th className="pb-3 text-right">WER</th></tr></thead><tbody>{evaluations.map((item) => <tr key={item.id} className="border-b border-white/[0.04] text-[11px] text-[#b3bfd3]"><td className="py-4"><p className="font-semibold text-[#e1e9f7]">{item.ownerName}</p><p className="mt-1 text-[9px] text-[#7182a1]">{item.ownerEmail}</p></td><td className="py-4 font-mono text-[#c4d0e3]">{item.fileName}</td><td className="py-4"><p>{item.accent}</p><p className="mt-1 text-[9px] text-[#7182a1]">{item.language}</p></td><td className="max-w-[280px] py-4"><p className="truncate text-[#aab9d1]">{item.transcript || "No live transcript captured"}</p></td><td className="py-4"><span className={`rounded-full px-2 py-1 text-[9px] ${item.status === "complete" ? "bg-[#63e6e9]/10 text-[#9ee7e9]" : "bg-[#fb7185]/10 text-[#ffc1c5]"}`}>{item.status}</span></td><td className="py-4 text-right font-semibold text-[#63e6e9]">{item.baselineWer} → {item.tunedWer}</td></tr>)}</tbody></table></div>}</section></>;
}

function ResultsView() {
  const [downloaded, setDownloaded] = useState(false);
  return <>
    <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><SectionEyebrow color="orange">Results & analytics</SectionEyebrow><h1 className="text-[29px] font-semibold tracking-[-0.05em] text-[#f0f5ed]">Accent-wise performance</h1><p className="mt-2 text-[12px] text-[#829092]">Baseline vs. fine-tuned model across the held-out test split.</p></div><button onClick={() => { downloadTextFile("accentlens-evaluation-results.txt", "AccentLens evaluation results\n\nBaseline average WER: 11.8%\nFine-tuned average WER: 9.4%\nAverage improvement: 20.6%\nRemaining accent gap: 5.2pp\n"); setDownloaded(true); }} className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.1] px-3.5 py-2.5 text-[10px] font-bold text-[#d7e2d9] transition hover:border-[#63e6e9]/40 hover:text-[#63e6e9]"><Download size={14} />{downloaded ? "Results downloaded" : "Download results"}</button></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Baseline average WER" value="11.8%" detail="4 accent groups" trend="Reference" icon={Gauge} accent="orange" /><Metric label="Fine-tuned average WER" value="9.4%" detail="4 accent groups" trend="↓ 20.6%" icon={Zap} /><Metric label="Baseline average CER" value="5.3%" detail="test split" trend="Reference" icon={FileText} accent="lavender" /><Metric label="Remaining accent gap" value="5.2pp" detail="best → worst" trend="↓ 29.7%" icon={GitCompareArrows} /></div>
    <section className="mb-5 rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><SectionEyebrow>WER by accent</SectionEyebrow><h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#f4f7ff]">The gap is narrowing</h2><p className="mt-1 text-[11px] text-[#758185]">Lower error rate means more accurate transcriptions.</p></div><div className="flex items-center gap-4 text-[10px] text-[#7c8889]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#5e6a6d]" />Baseline</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#63e6e9]" />Fine-tuned</span></div></div><div className="space-y-6">{comparisonRows.map((row) => <div key={row.code} className="grid gap-2 sm:grid-cols-[150px_1fr_70px]"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} /><div><p className="text-[11px] font-semibold text-[#dce6de]">{row.accent}</p><p className="font-mono text-[9px] text-[#687578]">{row.code}</p></div></div><div className="space-y-2"><div className="flex h-2 overflow-hidden rounded-full bg-[#263133]"><span className="rounded-full bg-[#5f6c6e]" style={{ width: `${Number.parseFloat(row.baselineWer) * 5}%` }} /></div><div className="flex h-2 overflow-hidden rounded-full bg-[#263133]"><span className="rounded-full" style={{ width: `${Number.parseFloat(row.tunedWer) * 5}%`, backgroundColor: row.color }} /></div><div className="flex justify-between text-[9px] text-[#687578]"><span>baseline {row.baselineWer}</span><span className="text-[#a1b99b]">fine-tuned {row.tunedWer}</span></div></div><span className="self-center text-right text-[11px] font-semibold text-[#63e6e9]">−{row.improvement}</span></div>)}</div></section>
    <section className="rounded-2xl border border-white/[0.07] bg-[#151d37] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><SectionEyebrow color="lavender">Detailed results</SectionEyebrow><h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#f4f7ff]">Evaluation matrix</h2></div><button onClick={() => toast.info("Results filters are ready for the next evaluation run.")} className="text-[#728084] hover:text-white"><Settings2 size={15} /></button></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.14em] text-[#687578]"><th className="pb-3 font-semibold">Accent</th><th className="pb-3 font-semibold">Baseline WER</th><th className="pb-3 font-semibold">Fine-tuned WER</th><th className="pb-3 font-semibold">Baseline CER</th><th className="pb-3 font-semibold">Fine-tuned CER</th><th className="pb-3 text-right font-semibold">Improvement</th></tr></thead><tbody>{comparisonRows.map((row) => <tr key={row.code} className="border-b border-white/[0.04] text-[11px]"><td className="py-3.5"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: row.color }} />{row.accent}</td><td className="py-3.5 text-[#ff9b9b]">{row.baselineWer}</td><td className="py-3.5 text-[#63e6e9]">{row.tunedWer}</td><td className="py-3.5 text-[#ff9b9b]">{row.baselineCer}</td><td className="py-3.5 text-[#63e6e9]">{row.tunedCer}</td><td className="py-3.5 text-right font-semibold text-[#63e6e9]">{row.improvement}</td></tr>)}</tbody></table></div><div className="mt-5 flex items-start gap-2 rounded-lg border border-[#ff9b9b]/10 bg-[#ff9b9b]/[0.04] p-3 text-[10px] leading-5 text-[#9b9087]"><Info size={13} className="mt-0.5 shrink-0 text-[#ff9b9b]" /><span>Results are based on a balanced Common Voice subset. Improvements can vary with speaker, recording conditions, and domain vocabulary.</span></div></section>
  </>;
}

export default function Index() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>(() => readEvaluations());
  const [activeView, setActiveView] = useState<View>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAccent, setSelectedAccent] = useState("scot");
  const [fileName, setFileName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("idle");

  const goTo = (view: View) => {
    setActiveView(view);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runAnalysis = (details: { transcript: string; accent: string; language: string }) => {
    if (!fileName) {
      toast.error("Add or record an audio sample before running an evaluation.");
      return;
    }
    setAnalysisStatus("running");
    toast.loading("Running both ASR models…", { id: "evaluation" });
    window.setTimeout(() => {
      const record: EvaluationRecord = { id: createId(), ownerName: session?.name || "Client", ownerEmail: session?.email || "unknown", fileName, accent: details.accent, language: details.language === "auto" ? navigator.language : details.language, transcript: details.transcript, status: "complete", createdAt: new Date().toISOString(), baselineWer: "11.4%", tunedWer: "9.3%" };
      const nextEvaluations = [record, ...evaluations];
      setEvaluations(nextEvaluations);
      window.localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(nextEvaluations));
      setAnalysisStatus("complete");
      toast.success("Evaluation complete. Comparison is ready.", { id: "evaluation" });
      setActiveView("compare");
    }, 900);
  };

  const navItems = [
    { id: "home" as View, label: "Home / Dashboard", icon: Home },
    { id: "analyze" as View, label: "Audio Input", icon: Mic },
    { id: "compare" as View, label: "Transcription Comparison", icon: GitCompareArrows },
    { id: "results" as View, label: "Results & Analytics", icon: BarChart3 },
    ...(session?.role === "admin" ? [{ id: "admin" as View, label: "Admin data", icon: ShieldCheck }] : []),
  ];
  const currentLabel = navItems.find((item) => item.id === activeView)?.label ?? "Home / Dashboard";

  const logout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    toast.success("You have been signed out.");
  };

  if (!session) return <AuthScreen onAuthenticated={setSession} />;
  if (session.role === "admin" && activeView === "admin") return <AdminDashboard evaluations={evaluations} goTo={goTo} logout={logout} />;
  if (session.role === "client" && activeView === "home") return <ClientDashboard session={session} evaluations={evaluations} goTo={goTo} logout={logout} downloadTextFile={downloadTextFile} />;

  return <div className="min-h-screen bg-[#0b1020] text-[#f4f7ff]"><div className="flex min-h-screen"><aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] shrink-0 flex-col border-r border-white/[0.07] bg-[#10172d] px-4 py-5 transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}><div className="flex items-center gap-3 px-3"><LogoMark /><div><p className="text-[14px] font-bold tracking-[-0.03em] text-[#f4f7ff]">accent<span className="text-[#63e6e9]">/</span>lens</p><p className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-[#6e7b7d]">ASR bias lab</p></div><button onClick={() => setSidebarOpen(false)} className="ml-auto rounded-lg p-1 text-[#748084] hover:bg-white/[0.06] lg:hidden"><X size={16} /></button></div><div className="mt-10"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#687578]">Workspace</p><nav className="space-y-1">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => goTo(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[11px] font-semibold transition ${activeView === id ? "bg-[#63e6e9]/10 text-[#63e6e9]" : "text-[#8b9899] hover:bg-white/[0.045] hover:text-[#dce6de]"}`}><Icon size={16} strokeWidth={1.8} />{label}{activeView === id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#63e6e9]" />}</button>)}</nav></div><div className="mt-9"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#687578]">Evaluation tools</p><button onClick={() => goTo("analyze")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[11px] font-semibold text-[#8b9899] transition hover:bg-white/[0.045] hover:text-[#dce6de]"><ClipboardCheck size={16} strokeWidth={1.8} />Run batch evaluation</button><button onClick={() => goTo("results")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[11px] font-semibold text-[#8b9899] transition hover:bg-white/[0.045] hover:text-[#dce6de]"><FileText size={16} strokeWidth={1.8} />Evaluation reports</button></div><div className="mt-auto rounded-xl border border-[#63e6e9]/15 bg-[#63e6e9]/[0.045] p-3.5"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a5cc7c]">Model pipeline</span><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e9] shadow-[0_0_7px_#63e6e9]" /></div><p className="text-[11px] font-semibold text-[#dbe9d7]">Balanced-v2 adapter</p><p className="mt-1 text-[10px] text-[#788786]">Whisper small · ready</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#27352d]"><div className="h-full w-[84%] rounded-full bg-[#63e6e9]" /></div><p className="mt-2 text-[9px] text-[#859587]">84% evaluation coverage</p></div><div className="mt-5 flex items-center gap-3 border-t border-white/[0.07] px-2 pt-4"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6e5f85] text-[10px] font-bold">PG</div><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#d6e0d6]">{session.name}</p><p className="text-[10px] text-[#707c7f]">{session.role === "admin" ? "Administrator" : "Client researcher"}</p></div><button onClick={logout} aria-label="Sign out" className="ml-auto rounded-md p-1 text-[#6f7b7e] hover:bg-white/[0.06] hover:text-[#f4f7ff]"><LogOut size={14} /></button></div></aside>{sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-[#090d0e]/70 lg:hidden" onClick={() => setSidebarOpen(false)} />}<main className="min-w-0 flex-1"><header className="flex h-[72px] items-center justify-between border-b border-white/[0.07] px-5 sm:px-8 lg:px-10"><div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-[#94a1a1] hover:bg-white/[0.06] lg:hidden"><Menu size={19} /></button><div className="hidden h-7 w-px bg-white/[0.08] sm:block" /><div><p className="text-[11px] text-[#6f7b7e]">AccentLens / <span className="text-[#bdc9c0]">{currentLabel}</span></p><p className="mt-0.5 text-[10px] text-[#596669]">ASR accent bias detection & mitigation</p></div></div><div className="flex items-center gap-2 sm:gap-3"><span className="hidden items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] text-[#81908d] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#63e6e9]" />API engine online</span><button onClick={() => goTo("analyze")} className="flex items-center gap-2 rounded-lg bg-[#63e6e9] px-3.5 py-2.5 text-[11px] font-bold text-[#07171e] shadow-[0_0_18px_rgba(157,230,106,0.12)] transition hover:bg-[#8ff7f2]"><Plus size={15} strokeWidth={2.5} />New evaluation</button></div></header><div key={activeView} className="page-enter mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{activeView === "home" && <HomeView goTo={goTo} />}{activeView === "analyze" && <AnalyzeView selectedAccent={selectedAccent} setSelectedAccent={setSelectedAccent} fileName={fileName} setFileName={setFileName} runAnalysis={runAnalysis} analysisStatus={analysisStatus} transcript={transcript} setTranscript={setTranscript} />}{activeView === "compare" && <CompareView selectedAccent={selectedAccent} goTo={goTo} />}{activeView === "results" && <ResultsView />}{activeView === "admin" && session.role === "admin" && <AdminDashboard evaluations={evaluations} goTo={goTo} logout={logout} />}<footer className="flex flex-col justify-between gap-2 py-7 text-[10px] text-[#5f6d70] sm:flex-row"><span>AccentLens · ASR Accent Bias Detection & Mitigation</span><span className="flex items-center gap-4"><button onClick={() => toast.info("Documentation is included in the evaluation workflow.")} className="hover:text-[#a7b6af]">Documentation</button><button onClick={() => toast.success("All browser-side services are operational.")} className="hover:text-[#a7b6af]">System status <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#63e6e9]" /></button></span></footer></div></main></div></div>;
}
