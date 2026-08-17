import { useEffect, useRef, useState } from "react";
import { Bot, Check, Copy, Maximize2, MessageSquareText, Minimize2, Send, Sparkles, Trash2, X, RotateCcw, GripVertical } from "lucide-react";
import { useApp } from "../state/store";
import { api } from "../lib/api";

type Lang = "english" | "urdu" | "roman";

const LANGS: { id: Lang; label: string }[] = [
  { id: "english", label: "English" },
  { id: "urdu", label: "اردو" },
  { id: "roman", label: "Roman Urdu" },
];

const SUGGESTIONS: Record<Lang, string[]> = {
  english: [
    "How do I create a visitor pass?",
    "What are the quiet hours?",
    "When is my bill due?",
    "Show my complaints",
    "Who do I call in an emergency?",
    "How does QR entry work?",
  ],
  urdu: [
    "وزیٹر پاس کیسے بنائیں؟",
    "کوئٹ آورز کیا ہیں؟",
    "میرا بل کب ہے؟",
    "میری شکایات دکھائیں",
    "ایمرجنسی میں کس کو کال کریں؟",
  ],
  roman: [
    "Visitor pass kaise banayein?",
    "Quiet hours kya hain?",
    "Mera bill kab hai?",
    "Meri shikayat dikhayein",
    "Emergency mein kise call karein?",
    "QR entry kaise kaam karti hai?",
  ],
};

const QUICK: Record<string, { label: string; prompt?: string; page?: string }[]> = {
  resident: [
    { label: "My Visitors", prompt: "Show my visitors" },
    { label: "My Bill", prompt: "How much is my maintenance bill?" },
    { label: "Raise Complaint", prompt: "Raise a complaint about an issue in my flat" },
    { label: "Book Amenity", prompt: "Book the clubhouse" },
    { label: "Society Notices", prompt: "Show today's society notices" },
    { label: "Emergency Help", prompt: "Show emergency contacts" },
  ],
  guard: [
    { label: "Scan Visitor QR", page: "verify" },
    { label: "Current Visitors", prompt: "Show today's gate status" },
    { label: "Check-in", prompt: "Check in a visitor" },
    { label: "Check-out", prompt: "Check out a visitor" },
    { label: "Security Alerts", prompt: "Show security alerts" },
    { label: "Deliveries", prompt: "Show today's deliveries" },
  ],
  maintenance: [
    { label: "My Tickets", prompt: "Show my assigned tickets" },
    { label: "Urgent Tickets", prompt: "Show urgent tickets" },
    { label: "SLA Status", prompt: "Show my assignments" },
    { label: "Assigned Flats", prompt: "Show my assigned flats" },
  ],
  admin: [
    { label: "Society Overview", page: "overview" },
    { label: "Residents", page: "residents" },
    { label: "Visitors", page: "gate" },
    { label: "Billing", page: "billing" },
    { label: "Complaints", page: "complaints" },
    { label: "Security", page: "gate" },
    { label: "Reports", page: "reports" },
    { label: "AI Knowledge Base", page: "ai" },
  ],
};

interface ChatRow {
  role: "user" | "assistant";
  content: string;
  time: string;
  sources?: string[];
  confirm?: boolean;
  error?: boolean;
  emergency?: boolean;
  contacts?: Array<{ label: string; phone: string; description?: string | null }>;
  navigate?: string;
}

const POS_KEY = "ss-ai-pos";
const SIZE_KEY = "ss-ai-size";

function loadPos(): { x?: number; y?: number } {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof p.x === "number" && typeof p.y === "number") return p;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function loadSize(): { w: number; h: number } {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as { w?: number; h?: number };
      if (typeof s.w === "number" && typeof s.h === "number" && s.w >= 300 && s.h >= 320) return { w: s.w, h: s.h };
    }
  } catch {
    /* ignore */
  }
  return { w: 380, h: Math.min(560, typeof window !== "undefined" ? window.innerHeight - 96 : 560) };
}

export function SocietyAi() {
  const { user, toast, setPage } = useApp();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [lang, setLang] = useState<Lang>("english");
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [pos, setPos] = useState<{ x?: number; y?: number }>(() => loadPos());
  const [size, setSize] = useState<{ w: number; h: number }>(() => loadSize());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number; startX: number; startY: number } | null>(null);
  const resizeRef = useRef<{ startW: number; startH: number; startX: number; startY: number } | null>(null);
  const lastUserText = useRef("");

  const role = (user?.role ?? "resident") as string;

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (open && rows.length === 0) {
      setRows([
        {
          role: "assistant",
          content:
            lang === "english"
              ? `As-salamu alaykum${user?.name ? `, ${user.name}` : ""}! I am Society Assistant — the SmartSociety assistant. Ask me about visitors, QR passes, bills, complaints, amenities, society rules or emergency contacts. I only use data your role is allowed to see.`
              : lang === "urdu"
                ? `السلام علیکم${user?.name ? `، ${user.name}` : ""}! میں سوسائٹی اسسٹنٹ ہوں — سمارٹ سوسائٹی کا معاون۔`
                : `As-salamu alaykum${user?.name ? `, ${user.name}` : ""}! Main Society Assistant hoon — SmartSociety ka madadgaar.`,
          time: now(),
        },
      ]);
    }
  }, [open, lang, user, rows.length]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [rows, busy, open, minimized]);

  useEffect(() => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos]);

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify(size));
    } catch {
      /* ignore */
    }
  }, [size]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    lastUserText.current = message;
    setInput("");
    setRows((r) => [...r, { role: "user", content: message, time: now() }]);
    setBusy(true);
    try {
      const result = await api.aiChat(message, lang);
      setRows((r) => [
        ...r,
        {
          role: "assistant",
          content: result.reply,
          time: now(),
          sources: result.sources,
          confirm: Boolean(result.confirm),
          emergency: result.emergency,
          contacts: result.contacts,
          navigate: result.navigate,
        },
      ]);
    } catch (error) {
      setRows((r) => [
        ...r,
        {
          role: "assistant",
          content:
            lang === "english"
              ? `Sorry, I couldn't reach the backend: ${error instanceof Error ? error.message : "network error"}`
              : lang === "urdu"
                ? `معذرت، بیک اینڈ تک رسائی نہیں ہوئی۔`
                : `Maazrat, backend tak rasai nahi hui: ${error instanceof Error ? error.message : "network error"}`,
          time: now(),
          error: true,
        },
      ]);
      toast("Society Assistant — backend unavailable.", "danger");
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    if (!lastUserText.current || busy) return;
    setRows((r) => r.slice(0, -1));
    void send(lastUserText.current);
  };

  const copy = async (content: string, id: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const quickAction = (a: { label: string; prompt?: string; page?: string }) => {
    if (a.page) {
      setPage(a.page);
      setOpen(false);
      return;
    }
    void send(a.prompt);
  };

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (isMobile) return;
    if ((e.target as HTMLElement).closest("button,select,input,textarea,a")) return;
    const target = e.currentTarget as HTMLElement;
    dragRef.current = { dx: e.clientX - (pos.x ?? window.innerWidth - 420), dy: e.clientY - (pos.y ?? 90), startX: e.clientX, startY: e.clientY };
    target.setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || isMobile) return;
    const w = size.w;
    const h = size.h;
    const maxX = Math.max(0, window.innerWidth - w - 8);
    const maxY = Math.max(0, window.innerHeight - h - 8);
    const x = Math.min(Math.max(8, e.clientX - dragRef.current.dx), maxX);
    const y = Math.min(Math.max(8, e.clientY - dragRef.current.dy), maxY);
    setPos({ x, y });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    if (isMobile) return;
    e.stopPropagation();
    resizeRef.current = { startW: size.w, startH: size.h, startX: e.clientX, startY: e.clientY };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeRef.current || isMobile) return;
    const w = Math.min(Math.max(300, resizeRef.current.startW + e.clientX - resizeRef.current.startX), 560);
    const h = Math.min(Math.max(320, resizeRef.current.startH + e.clientY - resizeRef.current.startY), window.innerHeight - 24);
    setSize({ w, h });
  };

  const endResize = () => {
    resizeRef.current = null;
  };

  const now = () => new Date().toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[70] flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lift transition-all hover:scale-105 cursor-pointer"
        aria-label="Open Society Assistant"
      >
        <Bot className="h-7 w-7" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-amber-950">AI</span>
      </button>
    );
  }

  if (minimized) {
    return (
      <div
        className="fixed z-[70] flex items-center gap-2 rounded-2xl border border-slate-200 bg-surface px-3 py-2.5 shadow-lift"
        style={{ left: pos.x ?? undefined, top: pos.y ?? undefined, right: pos.x ? undefined : 16, bottom: pos.y ? undefined : 16, maxWidth: "calc(100vw - 2rem)" }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <button type="button" onClick={() => setMinimized(false)} className="text-sm font-bold text-slate-800 cursor-pointer">
          Society Assistant
        </button>
        <button type="button" onClick={() => setOpen(false)} className="ml-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-[70] flex flex-col overflow-hidden border border-slate-200 bg-surface shadow-lift ${isMobile ? "inset-x-0 bottom-0 top-16 rounded-none" : "rounded-3xl"}`}
      style={
        isMobile
          ? undefined
          : {
              left: pos.x ?? undefined,
              top: pos.y ?? undefined,
              right: pos.x ? undefined : 16,
              bottom: pos.y ? undefined : 16,
              width: size.w,
              height: size.h,
            }
      }
    >
      {/* Header (drag handle on desktop) */}
      <div
        className="flex items-center justify-between bg-gradient-to-br from-brand-600 to-brand-800 px-4 py-3"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/15 text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-white">Society Assistant</p>
            <p className="text-[10px] font-medium text-brand-100/80">
              {!isMobile && <GripVertical className="mr-1 inline h-3 w-3" />}
              SmartSociety · role-aware
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="rounded-lg border border-white/20 bg-surface/10 px-2 py-1 text-[11px] font-bold text-white outline-none cursor-pointer"
            aria-label="Language"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id} className="text-slate-800">
                {l.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setMinimized(true)} className="rounded-lg p-1.5 text-white/80 hover:bg-surface/10 cursor-pointer" aria-label="Minimize">
            <Minimize2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setRows([])} className="rounded-lg p-1.5 text-white/80 hover:bg-surface/10 cursor-pointer" aria-label="New conversation">
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/80 hover:bg-surface/10 cursor-pointer" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={bodyRef} className={`flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4 ${isMobile ? "max-h-none" : ""}`}>
        {rows.map((row, i) => (
          <div key={i} className={`flex ${row.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                row.role === "user" ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md border border-slate-200 bg-surface text-slate-800"
              } ${row.error ? "border-rose-300" : ""}`}
            >
              {row.emergency && row.contacts && row.contacts.length > 0 && (
                <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5">
                  <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-rose-700">Emergency contacts</p>
                  {row.contacts.map((c) => (
                    <a
                      key={`${c.label}-${c.phone}`}
                      href={`tel:${c.phone}`}
                      className="flex items-center justify-between rounded-lg border border-rose-200 bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-slate-800 transition-colors hover:border-rose-400"
                    >
                      <span>{c.label}</span>
                      <span className="text-brand-700">{c.phone}</span>
                    </a>
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap">{row.content}</p>
              {row.confirm && (
                <p className={`mt-1.5 text-[10px] font-bold ${row.role === "user" ? "text-brand-100" : "text-amber-600"}`}>Confirmation needed — reply yes or no.</p>
              )}
              {row.navigate && (
                <button
                  type="button"
                  onClick={() => {
                    setPage(row.navigate as string);
                    setOpen(false);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-brand-700 cursor-pointer"
                >
                  Open page <Maximize2 className="h-3 w-3" />
                </button>
              )}
              {row.sources && row.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.sources.map((s) => (
                    <span key={s} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      📄 {s}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className={`text-[10px] ${row.role === "user" ? "text-brand-100/80" : "text-slate-400"}`}>{row.time}</p>
                {row.role === "assistant" && (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void copy(row.content, i)}
                      className="rounded p-0.5 text-slate-400 transition-colors hover:text-brand-600 cursor-pointer"
                      aria-label="Copy response"
                    >
                      {copiedId === i ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                    {row.error && (
                      <button
                        type="button"
                        onClick={retry}
                        className="rounded p-0.5 text-rose-500 transition-colors hover:text-rose-700 cursor-pointer"
                        aria-label="Retry"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-surface px-4 py-3 shadow-sm">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions (role-based) + suggestions */}
      {rows.length <= 1 && (
        <div className="border-t border-slate-100 bg-surface px-3 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick actions</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 pb-2">
            {(QUICK[role] ?? QUICK.resident).map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => quickAction(a)}
                className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition-all hover:border-brand-300 cursor-pointer"
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Try asking</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 pb-2">
            {SUGGESTIONS[lang].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-all hover:border-brand-300 hover:text-brand-700 cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-slate-100 bg-surface p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={lang === "english" ? "Ask Society Assistant…" : lang === "urdu" ? "سوال پوچھیں…" : "Sawaal poochhiye…"}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white transition-all hover:bg-brand-700 disabled:opacity-40 cursor-pointer"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Resize handle (desktop only) */}
      {!isMobile && (
        <div
          className="absolute bottom-0 right-0 z-10 cursor-nwse-resize p-1 text-slate-300 hover:text-brand-500"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          aria-hidden="true"
        >
          <span className="block h-1.5 w-1.5 rounded-full border border-current" />
        </div>
      )}
    </div>
  );
}

export function SocietyAiFab() {
  return <SocietyAi />;
}

export function AiLauncher() {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
      <MessageSquareText className="h-4 w-4" /> Society Assistant
    </div>
  );
}