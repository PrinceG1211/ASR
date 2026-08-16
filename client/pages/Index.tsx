import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ExperimentStage, ExperimentSummary } from "@shared/experiment";
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
  Globe2,
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
import { ExperimentComparisonView, ExperimentResultsView } from "@/components/ExperimentViews";

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
  { value: "nl-NL", label: "Nederlands · Dutch" },
  { value: "pl-PL", label: "Polski · Polish" },
  { value: "uk-UA", label: "Українська · Ukrainian" },
  { value: "vi-VN", label: "Tiếng Việt · Vietnamese" },
  { value: "th-TH", label: "ไทย · Thai" },
  { value: "fa-IR", label: "فارسی · Persian" },
  { value: "ur-PK", label: "اردو · Urdu" },
  { value: "gu-IN", label: "ગુજરાતી · Gujarati" },
  { value: "te-IN", label: "తెలుగు · Telugu" },
  { value: "mr-IN", label: "मराठी · Marathi" },
  { value: "pa-IN", label: "ਪੰਜਾਬੀ · Punjabi" },
  { value: "am-ET", label: "አማርኛ · Amharic" },
  { value: "ha-NG", label: "Hausa" },
  { value: "zu-ZA", label: "isiZulu · Zulu" },
  { value: "fil-PH", label: "Filipino" },
];

const translationSamples: Record<string, string> = {
  "en-US": "The weather is lovely today, and the light is perfect for a walk.",
  "es-ES": "El tiempo es encantador hoy y la luz es perfecta para dar un paseo.",
  "fr-FR": "Il fait très beau aujourd’hui et la lumière est parfaite pour une promenade.",
  "de-DE": "Das Wetter ist heute wunderschön und das Licht ist perfekt für einen Spaziergang.",
  "hi-IN": "आज मौसम बहुत सुहावना है और टहलने के लिए रोशनी बिल्कुल सही है।",
  "pt-BR": "O tempo está lindo hoje e a luz está perfeita para uma caminhada.",
  "ar-SA": "الطقس جميل اليوم والضوء مثالي للتنزه.",
  "zh-CN": "今天天气很好，光线非常适合散步。",
  "ja-JP": "今日は天気が良く、散歩にぴったりの光です。",
  "ko-KR": "오늘은 날씨가 좋고 산책하기에 빛이 완벽합니다.",
  "ru-RU": "Сегодня прекрасная погода, и свет идеально подходит для прогулки.",
  "bn-BD": "আজ আবহাওয়া চমৎকার এবং হাঁটার জন্য আলো একদম নিখুঁত।",
  "ta-IN": "இன்று வானிலை அழகாகவும் நடைப்பயணத்திற்கு வெளிச்சம் சரியாகவும் உள்ளது.",
  "te-IN": "ఈరోజు వాతావరణం అందంగా ఉంది, నడకకు వెలుతురు సరైనది.",
  "ur-PK": "آج موسم بہت خوبصورت ہے اور سیر کے لیے روشنی بہترین ہے۔",
};

function detectSpokenLanguage(text: string) {
  if (!text.trim()) return { value: "unknown", label: "Waiting for speech" };
  if (/[\u0900-\u097F]/.test(text)) return { value: "hi-IN", label: "Hindi · Devanagari script" };
  if (/[\u0600-\u06FF]/.test(text)) return { value: "ar-SA", label: "Arabic · Arabic script" };
  if (/[\u4E00-\u9FFF]/.test(text)) return { value: "zh-CN", label: "Mandarin · Han script" };
  if (/[\u3040-\u30FF]/.test(text)) return { value: "ja-JP", label: "Japanese · Kana script" };
  if (/[\uAC00-\uD7AF]/.test(text)) return { value: "ko-KR", label: "Korean · Hangul script" };
  const normalized = text.toLowerCase();
  if (/\b(el|la|los|una|hoy|tiempo)\b/.test(normalized)) return { value: "es-ES", label: "Spanish · Latin script" };
  if (/\b(le|les|une|aujourd'hui|lumière)\b/.test(normalized)) return { value: "fr-FR", label: "French · Latin script" };
  if (/\b(der|die|das|heute|wetter)\b/.test(normalized)) return { value: "de-DE", label: "German · Latin script" };
  return { value: "en-US", label: "English · Latin script" };
}

const nameTranslations: Record<string, string> = {
  "hi-IN": "मेरा नाम $1 है",
  "es-ES": "Me llamo $1",
  "fr-FR": "Je m'appelle $1",
  "de-DE": "Ich heiße $1",
  "pt-BR": "Meu nome é $1",
  "ar-SA": "اسمي $1",
  "zh-CN": "我的名字是$1",
  "ja-JP": "私の名前は$1です",
  "ko-KR": "제 이름은 $1입니다",
  "ru-RU": "Меня зовут $1",
  "it-IT": "Mi chiamo $1",
  "tr-TR": "Benim adım $1",
  "id-ID": "Nama saya $1",
  "en-GB": "My name is $1",
  "sw-KE": "Jina langu ni $1",
  "bn-BD": "আমার নাম $1",
  "ta-IN": "என் பெயர் $1",
  "yo-NG": "Orúkọ mi ni $1",
  "nl-NL": "Mijn naam is $1",
  "pl-PL": "Mam na imię $1",
  "uk-UA": "Мене звати $1",
  "vi-VN": "Tên tôi là $1",
  "th-TH": "ฉันชื่อ $1",
  "fa-IR": "نام من $1 است",
  "ur-PK": "میرا نام $1 ہے",
  "gu-IN": "મારું નામ $1 છે",
  "te-IN": "నా పేరు $1",
  "mr-IN": "माझे नाव $1 आहे",
  "pa-IN": "ਮੇਰਾ ਨਾਮ $1 ਹੈ",
  "am-ET": "ስሜ $1 ነው",
  "ha-NG": "Sunana $1",
  "zu-ZA": "Igama lami ngu-$1",
  "fil-PH": "Ang pangalan ko ay $1",
};

function translateTranscript(text: string, targetLanguage: string) {
  const trimmedText = text.trim();
  if (!trimmedText) return "Waiting for a transcript…";
  if (targetLanguage === "en-US" || targetLanguage === "en-GB") return text;

  const normalizedText = trimmedText.toLowerCase().replace(/\s+/g, " ");
  const weatherSample = "the weather is lovely today, and the light is perfect for a walk.";
  if (normalizedText === weatherSample && translationSamples[targetLanguage]) return translationSamples[targetLanguage];

  const nameTranslation = nameTranslations[targetLanguage];
  if (nameTranslation) {
    const translatedName = text.replace(/\bmy name is\s+([a-z][a-z'-]*)\b/gi, nameTranslation);
    if (translatedName !== text) return translatedName;
  }

  const targetLabel = languages.find((language) => language.value === targetLanguage)?.label ?? targetLanguage;
  return `[${targetLabel} preview] ${text}`;
}

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
    toast.success(mode === "register" ? "Account created. Welcome to your workspace." : "Welcome back.");
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
    completeAuth(adminMatches ? { id: "demo-admin", name: "Administrator", email: normalizedEmail, role: "admin" } : { id: client!.id, name: client!.name, email: client!.email, role: "client" });
  };

  return <div className="min-h-screen overflow-hidden bg-[#0b1020] px-5 py-8 text-[#f4f7ff] sm:px-8"><div className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-[#63e6e9]/10 blur-3xl" /><div className="pointer-events-none fixed -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#a78bfa]/15 blur-3xl" /><div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]"><div className="hidden lg:block"><div className="mb-8 flex items-center gap-3"><LogoMark /><div><p className="text-[15px] font-bold tracking-[-0.03em]">Speech workspace</p><p className="text-[9px] uppercase tracking-[0.16em] text-[#7483a4]">Private access</p></div></div><p className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9ee7e9]">Speech intelligence workspace</p><h1 className="max-w-xl text-5xl font-semibold leading-[1.03] tracking-[-0.06em] text-[#f4f7ff]">Measure every voice with <span className="bg-gradient-to-r from-[#63e6e9] via-[#a78bfa] to-[#fb7185] bg-clip-text text-transparent">more fairness.</span></h1><p className="mt-6 max-w-lg text-sm leading-7 text-[#94a2bd]">Review speech quality, compare model outputs, and turn real audio into evidence your team can act on.</p><div className="mt-10 grid max-w-lg grid-cols-3 gap-3">{[{ value: "4", label: "voice groups" }, { value: "20+", label: "languages" }, { value: "2", label: "model views" }].map((item) => <div key={item.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4"><p className="text-2xl font-semibold text-[#f4f7ff]">{item.value}</p><p className="mt-1 text-[10px] text-[#7e8ca8]">{item.label}</p></div>)}</div></div><div className="mx-auto w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#151d37]/90 p-6 shadow-[0_24px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8"><div className="mb-7 flex items-center gap-3 lg:hidden"><LogoMark /><div><p className="text-[15px] font-bold">Speech workspace</p><p className="text-[9px] uppercase tracking-[0.16em] text-[#7483a4]">Private access</p></div></div><div className="mb-7"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#63e6e9]/20 to-[#a78bfa]/20 text-[#63e6e9]"><ShieldCheck size={19} /></div><h2 className="text-2xl font-semibold tracking-[-0.04em]">{mode === "login" ? "Welcome back" : "Create your account"}</h2><p className="mt-2 text-[11px] leading-5 text-[#8190ad]">{mode === "login" ? "Sign in to continue your audio evaluations." : "Create a client workspace to start testing speech models."}</p></div><form onSubmit={handleSubmit} className="space-y-4">{mode === "register" && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8795b1]">Full name</span><input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-white/[0.1] bg-[#1b2644] px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#566681] focus:border-[#63e6e9]/60" placeholder="Your name" /></label>}<label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8795b1]">Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-white/[0.1] bg-[#1b2644] px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#566681] focus:border-[#63e6e9]/60" placeholder="you@example.com" /></label><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8795b1]">Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/[0.1] bg-[#1b2644] px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#566681] focus:border-[#63e6e9]/60" placeholder="At least 6 characters" /></label>{mode === "register" && <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8795b1]">Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-white/[0.1] bg-[#1b2644] px-3.5 py-3 text-[12px] outline-none transition placeholder:text-[#566681] focus:border-[#63e6e9]/60" placeholder="Repeat password" /></label>}{error && <p className="rounded-xl border border-[#fb7185]/20 bg-[#fb7185]/10 px-3 py-2.5 text-[10px] leading-4 text-[#ffc1c5]">{error}</p>}<button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#63e6e9] to-[#a78bfa] px-4 py-3 text-[11px] font-bold text-[#07171e] transition hover:brightness-110"><LogIn size={15} />{mode === "login" ? "Sign in" : "Create client account"}</button></form>{mode === "login" && <button onClick={() => { setEmail("admin@accentlens.ai"); setPassword("admin123"); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#63e6e9]/20 bg-[#63e6e9]/[0.05] px-3 py-2.5 text-[10px] font-semibold text-[#a7f3f2] hover:bg-[#63e6e9]/10"><KeyRound size={13} />Use demo admin access</button>}<div className="my-6 flex items-center gap-3 text-[9px] uppercase tracking-[0.16em] text-[#657493]"><span className="h-px flex-1 bg-white/[0.08]" />{mode === "login" ? "New to AccentLens?" : "Already have access?"}<span className="h-px flex-1 bg-white/[0.08]" /></div><button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="w-full rounded-xl border border-white/[0.1] px-4 py-3 text-[11px] font-semibold text-[#d7e2f4] transition hover:border-white/25">{mode === "login" ? "Register as a client" : "Back to sign in"}</button><p className="mt-6 text-center text-[9px] leading-4 text-[#667594]">Demo mode stores accounts only in this browser. Connect a secure auth backend before production use.</p></div></div></div>;
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

type ClientWorkspaceProps = {
  session: Session;
  activeView: View;
  goTo: (view: View) => void;
  logout: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  transcript: string;
  setTranscript: (value: string) => void;
  experiment: ExperimentSummary | null;
};

function ClientTranslateView({ transcript, setTranscript }: Pick<ClientWorkspaceProps, "transcript" | "setTranscript">) {
  const [targetLanguage, setTargetLanguage] = useState("en-US");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const detectedAudioUrlRef = useRef("");
  const detectedLanguage = detectSpokenLanguage(transcript);
  const targetOptions = languages.filter((item) => item.value !== "auto");

  useEffect(() => {
    if (!audioUrl || detectedAudioUrlRef.current === audioUrl || !transcript.trim()) return;
    const detected = detectSpokenLanguage(transcript);
    if (detected.value === "unknown") return;
    detectedAudioUrlRef.current = audioUrl;
    setTargetLanguage(detected.value);
    toast.success(`Language detected: ${detected.label}.`);
  }, [audioUrl, transcript]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

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
          setAudioUrl("");
          toast.error("That recording was empty. Speak for a moment and try again.");
          return;
        }
        setAudioUrl(URL.createObjectURL(blob));
        toast.success(`Recorded ${(blob.size / 1024).toFixed(0)} KB of audio.`);
      };
      streamRef.current = stream;
      recorderRef.current = recorder;
      setTranscript("");
      setRecordingSeconds(0);
      setRecording(true);
      recorder.start();

      const Recognition = getSpeechRecognition();
      if (Recognition) {
        const recognition = new Recognition();
        recognition.lang = navigator.language || "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let nextTranscript = "";
          for (let index = 0; index < event.results.length; index += 1) nextTranscript += event.results[index][0].transcript;
          setTranscript(nextTranscript);
        };
        recognition.onerror = () => toast.info("Speech recognition stopped. Your audio recording is still available.");
        recognitionRef.current = recognition;
        recognition.start();
      }
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

  return <div className="page-enter">
    <div className="mb-7"><SectionEyebrow color="lavender">Transcript workspace</SectionEyebrow><h1 className="text-[29px] font-semibold tracking-[-0.05em] text-[#f0f5ed]">Translate transcript to</h1><p className="mt-2 max-w-xl text-[12px] leading-5 text-[#829092]">Paste or edit a transcript, then choose the language you want to read it in.</p></div>
    <section className="rounded-[24px] border border-[#a78bfa]/20 bg-[linear-gradient(145deg,#1a2140,#15172f)] p-5 shadow-[0_20px_60px_rgba(7,20,48,0.2)] sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#c4b5fd]">Audio input</p><h2 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-[#f4f7ff]">Record your voice</h2><p className="mt-1 text-[11px] text-[#8fa1c0]">Capture a live sample and turn it into editable speech.</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${recording ? "recording-pulse bg-[#ff9b9b]/15 text-[#ff9b9b]" : "bg-[#a78bfa]/10 text-[#c4b5fd]"}`}><Mic size={18} /></div></div>
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#121a32] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#63e6e9]/10 text-[#63e6e9]"><Waves size={16} /></div><div><p className="text-[11px] font-semibold text-[#dce6de]">{recording ? "Recording in progress" : audioUrl ? "Recording ready" : "Ready to record"}</p><p className="mt-1 font-mono text-[10px] text-[#7f91b2]">{formatDuration(recordingSeconds)}{recording ? " · microphone live" : " · max 25 MB"}</p></div></div><button onClick={() => { if (recording) stopRecording(); else void startRecording(); }} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold transition ${recording ? "bg-[#ff7f88] text-[#24131b] hover:bg-[#ff9ba1]" : "bg-[#63e6e9] text-[#07171e] hover:bg-[#8ff7f2]"}`}>{recording ? <CircleStop size={14} /> : <Mic size={14} />}{recording ? "Stop recording" : "Record audio"}</button></div>
      {recordingError && <p className="mt-3 text-[10px] text-[#ff9b9b]">{recordingError}</p>}
      {audioUrl && <audio controls src={audioUrl} className="mt-3 h-9 w-full" />}
      <div className="my-6 h-px bg-white/[0.07]" />
      <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#c4b5fd]">Language conversion</p><h2 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-[#f4f7ff]">Choose your output language</h2></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a78bfa]/10 text-[#c4b5fd]"><Globe2 size={18} /></div></div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748083]" htmlFor="translate-target">Translate transcript to</label>
      <div className="relative"><select id="translate-target" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className="w-full appearance-none rounded-xl border border-white/[0.1] bg-[#1b2644] px-3 py-3 text-[11px] text-[#dce6de] outline-none transition focus:border-[#63e6e9]/60">{targetOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-[#8796b4]" /></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2"><div><label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#748083]" htmlFor="transcript-input">Transcript</label><textarea id="transcript-input" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Type or paste a transcript here…" className="min-h-44 w-full resize-y rounded-xl border border-white/[0.08] bg-[#121a32] p-4 text-[12px] leading-6 text-[#dce6de] outline-none placeholder:text-[#66758e] focus:border-[#63e6e9]/50" /></div><div><div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#748083]">Translated result</p><span className="text-[9px] text-[#63e6e9]">{targetOptions.find((item) => item.value === targetLanguage)?.label}</span></div><div className="min-h-44 rounded-xl border border-[#63e6e9]/15 bg-[#121a32] p-4 text-[12px] leading-6 text-[#dce6de]">{translateTranscript(transcript, targetLanguage)}</div></div></div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[10px] text-[#8fa1c0]"><Sparkles size={13} className="text-[#63e6e9]" /><span>Detected speech: <strong className="font-semibold text-[#b9f2f1]">{detectedLanguage.label}</strong></span></div>
    </section>
  </div>;
}

function ClientWorkspace({ session, activeView, goTo, logout, sidebarOpen, setSidebarOpen, transcript, setTranscript, experiment }: ClientWorkspaceProps) {
  const navItems = [
    { id: "home" as View, label: "Home / Dashboard", icon: Home },
    { id: "analyze" as View, label: "Audio Input", icon: Mic },
    { id: "compare" as View, label: "Transcription Comparison", icon: GitCompareArrows },
    { id: "results" as View, label: "Results & Analytics", icon: BarChart3 },
  ];
  const initials = session.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const currentLabel = navItems.find((item) => item.id === activeView)?.label ?? "Audio Input";

  return <div className="min-h-screen bg-[#0b1020] text-[#f4f7ff]"><div className="flex min-h-screen">{sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />}<aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] shrink-0 flex-col border-r border-white/[0.07] bg-[#10172d] px-4 py-5 transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}><div className="flex items-center justify-between px-3"><div className="flex items-center gap-2"><LogoMark /><span className="text-[11px] font-semibold text-[#dce6de]">Workspace</span></div><button aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-[#748084] hover:bg-white/[0.06] lg:hidden"><X size={16} /></button></div><div className="mt-10"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#687578]">Workspace</p><nav className="space-y-1">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { goTo(id); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[11px] font-semibold transition ${activeView === id ? "bg-[#63e6e9]/10 text-[#63e6e9]" : "text-[#8b9899] hover:bg-white/[0.045] hover:text-[#dce6de]"}`}><Icon size={16} strokeWidth={1.8} />{label}{activeView === id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#63e6e9]" />}</button>)}</nav></div><div className="mt-auto border-t border-white/[0.07] pt-4"><div className="flex items-center gap-3 px-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#63e6e9] to-[#a78bfa] text-[10px] font-bold text-[#08131e]">{initials || "U"}</div><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#e8f0e8]">{session.name}</p><p className="mt-0.5 text-[9px] text-[#748084]">Client researcher</p></div></div><button onClick={logout} className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[10px] font-semibold text-[#8b9899] transition hover:bg-white/[0.045] hover:text-[#ff9b9b]"><LogOut size={15} />Sign out</button></div></aside><main className="min-w-0 flex-1"><header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#131a30] px-5 sm:px-8"><div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-[#aeb7c9] hover:bg-white/[0.06] lg:hidden"><Menu size={17} /></button><p className="text-[10px] text-[#747d90]">Workspace / <span className="text-[#e9edf6]">{currentLabel}</span></p></div><div className="flex items-center gap-3"><span className="hidden text-[9px] text-[#7e8799] sm:block">Signed in as <span className="text-[#b9f2f1]">{session.name}</span></span><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6e4ea6] text-[9px] font-bold">{initials || "U"}</div></div></header><div className="mx-auto max-w-[1120px] px-5 py-7 sm:px-8">{activeView === "analyze" && <ClientTranslateView transcript={transcript} setTranscript={setTranscript} />}{activeView === "compare" && <ExperimentComparisonView experiment={experiment} goTo={goTo} downloadTextFile={downloadTextFile} />}{activeView === "results" && <ExperimentResultsView experiment={experiment} goTo={goTo} downloadTextFile={downloadTextFile} />}</div></main></div></div>;
}

export default function Index() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>(() => readEvaluations());
  const [activeView, setActiveView] = useState<View>(() => readSession()?.role === "admin" ? "admin" : "home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAccent, setSelectedAccent] = useState("scot");
  const [fileName, setFileName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [experiment, setExperiment] = useState<ExperimentSummary | null>(null);
  const [experimentRequest, setExperimentRequest] = useState(false);

  const refreshExperiment = async () => {
    try {
      const response = await fetch("/api/experiments/latest");
      if (!response.ok) throw new Error("Experiment API unavailable");
      const payload = await response.json() as { experiment: ExperimentSummary | null };
      setExperiment(payload.experiment);
    } catch {
      setExperiment(null);
    }
  };

  useEffect(() => {
    void refreshExperiment();
  }, []);

  const runExperimentStage = async (stage: ExperimentStage) => {
    if (experimentRequest) return;
    setExperimentRequest(true);
    try {
      const endpoint = stage === "dataset" ? "/api/experiments" : `/api/experiments/${experiment?.id}/${stage}`;
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stage === "baseline" ? { checkpoint: "openai/whisper-small" } : stage === "finetune" ? { checkpoint: "openai/whisper-small", epochs: 3, learningRate: 0.00001, batchSize: 4, seed: 42 } : {}) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Experiment stage could not start.");
      await refreshExperiment();
      const poll = window.setInterval(async () => {
        await refreshExperiment();
        const latest = await fetch("/api/experiments/latest").then((result) => result.ok ? result.json() as Promise<{ experiment: ExperimentSummary | null }> : Promise.reject(new Error("status"))).catch(() => ({ experiment: null }));
        if (!latest.experiment || latest.experiment.status !== "running") window.clearInterval(poll);
      }, 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Experiment stage failed to start.");
    } finally {
      setExperimentRequest(false);
    }
  };

  const goTo = (view: View) => {
    setActiveView(view);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runAnalysis = (_details: { transcript: string; accent: string; language: string }) => {
    if (!fileName) {
      toast.error("Add or record an audio sample before running an evaluation.");
      return;
    }
    toast.info("This sample is not scored yet. Run the Common Voice Whisper experiment first, or provide a reference transcript for uploaded audio.");
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

  if (!session) return <AuthScreen onAuthenticated={(nextSession) => { setSession(nextSession); setActiveView(nextSession.role === "admin" ? "admin" : "home"); }} />;
  if (session.role === "admin" && activeView === "admin") return <AdminDashboard evaluations={evaluations} experiment={experiment} goTo={goTo} logout={logout} runStage={runExperimentStage} />;
  if (session.role === "client" && activeView === "home") return <ClientDashboard session={session} evaluations={evaluations} goTo={goTo} logout={logout} downloadTextFile={downloadTextFile} experiment={experiment} />;

  return <ClientWorkspace session={session} activeView={activeView} goTo={goTo} logout={logout} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} transcript={transcript} setTranscript={setTranscript} experiment={experiment} />;
}
