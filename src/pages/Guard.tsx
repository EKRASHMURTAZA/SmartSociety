import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ChevronRight,
  DoorOpen,
  KeyRound,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  LogOut,
  XCircle,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useApp } from "../state/store";
import { type Visitor, type VisitorStatus } from "../data/mock";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, SectionTitle, Tabs } from "../components/ui";
import { ProfileEditor } from "../components/ProfileEditor";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";

const photoUrl = (src: string) =>
  src.startsWith("/uploads/")
    ? `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ?? "http://localhost:4000"}${src}`
    : src;

function VisitorPhoto({ src, name, className }: { src: string; name: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-2xl bg-brand-100 font-bold text-brand-700", className)}>
        {name?.slice(0, 1) ?? "?"}
      </div>
    );
  }
  return <img src={photoUrl(src)} alt={name} className={cn("shrink-0 object-cover", className)} />;
}

/* ------------------------------------------------------------------ helpers */
const statusBadge: Record<VisitorStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Pass ready", tone: "success" },
  inside: { label: "Inside", tone: "info" },
  completed: { label: "Left", tone: "neutral" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "danger" },
};

interface VerifyResult {
  kind: "valid" | "invalid";
  state: string;
  visitor?: Visitor;
  reason?: string;
}

interface GateAlert {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: "danger" | "warning" | "success";
  kind: "overstay" | "rejected";
}

function useGateAlerts() {
  const [gateLogs, setGateLogs] = useState<any[]>([]);

  useEffect(() => {
    api
      .gateLogs()
      .then(setGateLogs)
      .catch(() => undefined);
  }, []);

  usePoll(
    () =>
      api
        .gateLogs()
        .then(setGateLogs)
        .catch(() => undefined),
    20000
  );

  const alerts = useMemo(() => {
    const list: GateAlert[] = [];
    const now = Date.now();

    gateLogs
      .filter((log) => log.result === "ALLOWED" && log.verification !== "EXIT")
      .forEach((log) => {
        const hasExit = gateLogs.some(
          (exit) => exit.visitorId === log.visitorId && exit.verification === "EXIT" && new Date(exit.exitAt) > new Date(log.entryAt)
        );
        if (hasExit) return;
        const elapsed = now - new Date(log.entryAt).getTime();
        if (elapsed > 2 * 60 * 60 * 1000) {
          const minutes = Math.round(elapsed / 60000);
          list.push({
            id: `over-${log.id}`,
            title: `Overstay — ${log.visitor?.name ?? "Visitor"}`,
            detail: `Inside since ${new Date(log.entryAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })} · ${Math.floor(minutes / 60)}h ${minutes % 60}m`,
            time: `${Math.floor(minutes / 60)}h`,
            tone: "warning",
            kind: "overstay",
          });
        }
      });

    gateLogs
      .filter((log) => log.result === "REJECTED")
      .forEach((log) => {
        list.push({
          id: `rej-${log.id}`,
          title: `Pass rejected — ${log.visitor?.name ?? "Visitor"}`,
          detail: "Verification failed at the gate",
          time: new Date(log.createdAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
          tone: "danger",
          kind: "rejected",
        });
      });

    return list.slice(0, 4);
  }, [gateLogs]);

  const overstays = useMemo(
    () =>
      gateLogs
        .filter((log) => log.result === "ALLOWED" && log.verification !== "EXIT")
        .map((log) => {
          const elapsed = Date.now() - new Date(log.entryAt).getTime();
          const minutes = Math.round(elapsed / 60000);
          const hasExit = gateLogs.some(
            (exit) => exit.visitorId === log.visitorId && exit.verification === "EXIT" && new Date(exit.exitAt) > new Date(log.entryAt)
          );
          return {
            id: log.id,
            name: log.visitor?.name ?? "Visitor",
            flat: log.visitor?.flat ? `${log.visitor.flat.tower}-${log.visitor.flat.number}` : "—",
            entered: new Date(log.entryAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
            duration: `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
            hasExit,
          };
        })
        .filter((o) => !o.hasExit),
    [gateLogs]
  );

  return { alerts, overstays };
}

/* ------------------------------------------------------------ Gate verify */
export function GuardVerify() {
  const { visitors, verifyPass, verifyQr, checkIn, checkOut, gateAction, toast } = useApp();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const { alerts } = useGateAlerts();

  const pending = useMemo(
    () => visitors.filter((v) => v.status === "pending" || v.status === "approved"),
    [visitors]
  );
  const inside = useMemo(() => visitors.filter((v) => v.status === "inside"), [visitors]);
  const todaysCount = useMemo(
    () => visitors.filter((v) => v.dateISO === new Date().toISOString().slice(0, 10)).length,
    [visitors]
  );

  const allowEntry = async (v: Visitor) => {
    try { await checkIn(v.id); toast(`Entry allowed for ${v.name}`); setResult(null); }
    catch (e) { toast(e instanceof Error ? e.message : "Unable to allow entry.", "danger"); }
  };

  const reject = async (v: Visitor, reason: string) => {
    try { await gateAction(v.id, "reject"); toast(`${v.name} marked rejected`, "warning"); setResult({ kind: "invalid", state: "REJECTED", visitor: v, reason }); }
    catch (e) { toast(e instanceof Error ? e.message : "Unable to reject visitor.", "danger"); }
  };

  const toVisitor = (v: any): Visitor => ({
  id: v.id,
  name: v.name,
  photo: v.photoUrl ?? "",
  phone: v.phone,
  vehicle: v.vehicle ?? "—",
  flat: v.flat ? `${v.flat.tower}-${v.flat.number}` : "",
  resident: v.resident?.name ?? "",
  purpose: v.purpose,
  dateLabel: new Date(v.dateISO).toLocaleDateString("en-PK"),
  dateISO: new Date(v.dateISO).toISOString().slice(0, 10),
  time: `${v.entryTime} – ${v.exitTime}`,
  status: String(v.status).toLowerCase() as Visitor["status"],
  passCode: v.passCode,
  passToken: v.passToken,
  guests: v.guests ?? 1,
});

const resolvePass = async (code: string) => {
  try {
    const response = await verifyPass(code);
    setKeypadOpen(false); setScannerOpen(false);
    if (!response.valid) {
      setResult({
        kind: "invalid",
        state: String(response.state ?? "INVALID"),
        visitor: response.visitor ? toVisitor(response.visitor) : undefined,
        reason: `Verification failed: ${response.state}.`,
      });
      return;
    }
    setResult({ kind: "valid", state: "VALID", visitor: toVisitor(response.visitor) });
  } catch (e) { toast(e instanceof Error ? e.message : "Verification failed.", "danger"); }
};

const resolveToken = async (token: string) => {
  try {
    const response = await verifyQr(token);
    setKeypadOpen(false); setScannerOpen(false);
    if (!response.valid) {
      setResult({
        kind: "invalid",
        state: String(response.state ?? "INVALID"),
        visitor: response.visitor ? toVisitor(response.visitor) : undefined,
        reason: `Verification failed: ${response.state}.`,
      });
      return;
    }
    setResult({ kind: "valid", state: "VALID", visitor: toVisitor(response.visitor) });
  } catch (e) { toast(e instanceof Error ? e.message : "Verification failed.", "danger"); }
};

const checkOutVisitor = async (v: Visitor) => {
  try { await checkOut(v.id); toast(`Exit logged for ${v.name}`); setResult(null); }
  catch (e) { toast(e instanceof Error ? e.message : "Unable to log exit.", "danger"); }
};

  /* ------------------------------------------------------------ gate home */
  if (!result) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Gate Verification"
          subtitle="Main Gate · Morning shift · 6 AM – 2 PM"
        />

        {/* Big verify actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="group flex flex-col items-center gap-4 rounded-3xl border-2 border-brand-200 bg-brand-50/60 p-8 text-center transition-all hover:border-brand-400 hover:bg-brand-50 hover:shadow-lift cursor-pointer sm:p-10"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition-transform group-hover:scale-105">
              <ScanLine className="h-10 w-10" />
            </span>
            <span>
              <span className="block text-xl font-extrabold text-slate-900">Scan QR Code</span>
              <span className="mt-1 block text-sm text-slate-500">Point the tablet at the visitor's pass</span>
            </span>
          </button>
          <button
            onClick={() => setKeypadOpen(true)}
            className="group flex flex-col items-center gap-4 rounded-3xl border-2 border-slate-200 bg-surface p-8 text-center transition-all hover:border-slate-300 hover:shadow-lift cursor-pointer sm:p-10"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0f172a] text-white shadow-lg shadow-[#020617]/30 transition-transform group-hover:scale-105">
              <KeyRound className="h-10 w-10" />
            </span>
            <span>
              <span className="block text-xl font-extrabold text-slate-900">Enter Pass Code</span>
              <span className="mt-1 block text-sm text-slate-500">Type the 4-digit code from the pass</span>
            </span>
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Today's visitors", value: String(todaysCount), tone: "text-slate-900" },
            { label: "Pending verification", value: String(pending.length), tone: "text-amber-600" },
            { label: "Inside society", value: String(inside.length), tone: "text-brand-700" },
          ].map((s) => (
            <Card key={s.label} className="p-4 text-center sm:p-5">
              <p className={cn("text-2xl font-extrabold sm:text-3xl", s.tone)}>{s.value}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Pending verification list */}
        <section>
          <SectionTitle>Pending verification</SectionTitle>
          {pending.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-7 w-7" />}
              title="All clear"
              message="No passes waiting at the gate right now. New passes will appear here instantly."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pending.map((v) => (
                <Card key={v.id} className="flex items-center gap-4 p-4">
                  <VisitorPhoto src={v.photo} name={v.name} className="h-14 w-14 rounded-2xl shadow-soft" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-bold text-slate-900">{v.name}</p>
                      <Badge tone={statusBadge[v.status].tone}>{statusBadge[v.status].label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Flat {v.flat} · {v.time} · guest of {v.resident}
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-bold tracking-widest text-slate-400">CODE {v.passCode}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => resolvePass(v.passCode)}>
                    Verify <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Alerts preview */}
        <section>
          <SectionTitle>Alerts</SectionTitle>
          <Card className="divide-y divide-slate-100">
            {alerts.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">No recent alerts at the gate.</p>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-4">
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", a.tone === "danger" ? "bg-rose-50 text-rose-600" : a.tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                    {a.tone === "danger" ? <ShieldAlert className="h-4 w-4" /> : a.tone === "warning" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800">{a.title}</p>
                      <span className="text-[11px] text-slate-400">{a.time}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{a.detail}</p>
                  </div>
                </div>
              ))
            )}
          </Card>
        </section>

        {/* Scanner overlay */}
        {scannerOpen && <ScannerOverlay onDone={(code) => { setScannerOpen(false); resolveToken(code); }} onClose={() => setScannerOpen(false)} />}

        {/* Keypad modal */}
        {keypadOpen && (
          <KeypadModal
            onClose={() => setKeypadOpen(false)}
            onSubmit={resolvePass}
          />
        )}

        {/* Walk-in */}
        
      </div>
    );
  }

  /* ------------------------------------------------------------ result */
  const r = result;
  const isInside = r.kind === "invalid" && r.state === "ALREADY_INSIDE";
  const alreadyUsed = r.kind === "invalid" && r.state === "ALREADY_USED";
  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <button onClick={() => setResult(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
        <ArrowLeft className="h-4 w-4" /> Back to gate
      </button>

      {r.kind === "valid" && r.visitor ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-center gap-3 bg-emerald-600 px-6 py-5">
            <CheckCircle2 className="h-9 w-9 text-white" />
            <p className="text-2xl font-extrabold tracking-wide text-white">PASS VALID</p>
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <VisitorPhoto src={r.visitor.photo} name={r.visitor.name} className="h-24 w-24 rounded-3xl shadow-soft" />
              <div className="text-center sm:text-left">
                <p className="text-xl font-extrabold text-slate-900">{r.visitor.name}</p>
                <p className="text-sm text-slate-500">{r.visitor.purpose} · visiting {r.visitor.resident}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3.5 rounded-2xl bg-slate-50 p-5 text-sm">
              <p className="text-slate-400">Flat <span className="float-right font-bold text-slate-800">{r.visitor.flat}</span></p>
              <p className="text-slate-400">Vehicle <span className="float-right font-bold text-slate-800">{r.visitor.vehicle}</span></p>
              <p className="text-slate-400">Phone <span className="float-right font-bold text-slate-800">{r.visitor.phone}</span></p>
              <p className="text-slate-400">Guests <span className="float-right font-bold text-slate-800">{r.visitor.guests}</span></p>
              <p className="text-slate-400">Visit window <span className="float-right font-bold text-slate-800">{r.visitor.dateLabel} · {r.visitor.time}</span></p>
              <p className="text-slate-400">Pass code <span className="float-right font-mono font-bold text-slate-800">{r.visitor.passCode}</span></p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="xl" variant="success" className="flex-1" onClick={() => allowEntry(r.visitor!)}>
                <DoorOpen className="h-5 w-5" /> ALLOW ENTRY
              </Button>
              <Button size="xl" variant="danger" className="flex-1" onClick={() => reject(r.visitor!, "Details did not match")}>
                <XCircle className="h-5 w-5" /> REJECT
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">Rejecting notifies the resident immediately.</p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className={cn("flex items-center justify-center gap-3 px-6 py-5", isInside ? "bg-amber-500" : alreadyUsed ? "bg-slate-700" : "bg-rose-600")}>
            {isInside ? (
              <DoorOpen className="h-9 w-9 text-white" />
            ) : (
              <XCircle className="h-9 w-9 text-white" />
            )}
            <p className="text-2xl font-extrabold tracking-wide text-white">
              {isInside ? "ALREADY INSIDE" : alreadyUsed ? "PASS ALREADY USED" : "PASS INVALID"}
            </p>
          </div>
          <div className="p-6 text-center sm:p-8">
            <span className={cn("mx-auto flex h-16 w-16 items-center justify-center rounded-full", isInside ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600")}>
              <ShieldAlert className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-lg font-extrabold text-slate-900">
              {isInside ? "Visitor is inside the society" : "Entry not allowed"}
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
              {isInside
                ? "This pass was already used for entry. Check the visitor out when they leave."
                : alreadyUsed
                  ? "This pass has already been used and cannot be reused. Ask the host to create a new pass."
                  : r.reason ?? "This pass is not valid for entry. Please ask the visitor to contact their host."}
            </p>
            {r.visitor && (
              <p className="mt-3 text-xs font-semibold text-slate-400">
                {r.visitor.name} · Flat {r.visitor.flat} · code {r.visitor.passCode}
              </p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              {isInside && r.visitor && (
                <Button variant="secondary" onClick={() => checkOutVisitor(r.visitor!)}>
                  <LogOut className="h-4 w-4" /> CHECK OUT
                </Button>
              )}
              <Button variant="secondary" onClick={() => setResult(null)}>Dismiss</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ scanner */
function ScannerOverlay({
  onDone,
  onClose,
}: {
  onDone: (code: string) => void;
  onClose: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const completedRef = useRef(false);
  const scannerId = "smartsociety-qr-reader";
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let active = true;

    const stopScanner = async () => {
      const scanner = scannerRef.current;
      if (!scanner) return;

      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {
        // Camera may already have stopped while the overlay is closing.
      }

      try {
        scanner.clear();
      } catch {
        // Clear is best-effort because the element can unmount during cleanup.
      }

      scannerRef.current = null;
    };

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          "Camera access is unavailable in this browser. Use Chrome or Edge over HTTPS/localhost, or enter the 4-digit pass code."
        );
        setStarting(false);
        return;
      }

      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
          },
          async (decodedText) => {
            if (!active || completedRef.current) return;

            completedRef.current = true;
            await stopScanner();
            onDone(decodedText);
          },
          () => {
            // Ignore frame-level decode misses; the library retries automatically.
          }
        );

        if (active) setStarting(false);
      } catch (cause) {
        console.error("SmartSociety QR camera error:", cause);
        if (active) {
          setStarting(false);
          setError(
            "Camera permission was blocked or the camera could not be started. Allow camera access and try again."
          );
        }
      }
    };

    void startScanner();

    return () => {
      active = false;
      void stopScanner();
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-[#020617]">
      <div className="flex items-center justify-between px-5 py-4 text-white">
        <button
          onClick={() => {
            void (async () => {
              const scanner = scannerRef.current;
              if (scanner?.isScanning) {
                try {
                  await scanner.stop();
                } catch {
                  // no-op
                }
              }
              onClose();
            })();
          }}
          className="rounded-full p-2 hover:bg-surface/10 cursor-pointer"
          aria-label="Close scanner"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <p className="text-sm font-bold tracking-wide">Scan visitor QR</p>
        <span className="w-9" />
      </div>

      <div className="relative mx-auto mt-6 w-80 max-w-[86vw]">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-black ring-2 ring-white/15">
          <div id={scannerId} className="h-full w-full overflow-hidden" />
          <div className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_999px_rgba(2,6,23,0.22)]" />
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 animate-scan bg-emerald-400 shadow-[0_0_18px_4px_rgba(52,211,153,0.55)]" />
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 px-6 text-center">
        <p className="text-sm font-semibold text-white">
          {starting ? "Starting camera…" : error ? "Camera unavailable" : "Scanning…"}
        </p>

        <p className="max-w-sm text-xs leading-relaxed text-slate-400">
          Hold the visitor pass inside the frame. SmartSociety verifies the secure pass identifier with the server.
        </p>

        {error && (
          <div className="mt-2 max-w-sm rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs font-medium leading-relaxed text-amber-100">
            {error}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-2 rounded-2xl bg-surface px-6 py-3 text-sm font-bold text-slate-900 cursor-pointer"
        >
          {error ? "Use pass code instead" : "Cancel scan"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ keypad */
function KeypadModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");

  const press = (d: string) => {
    if (code.length < 4) setCode((c) => c + d);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-[#020617]/60 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-sm animate-pop-in overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-lift sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Enter pass code</h3>
            <p className="text-xs text-slate-400">4-digit code shown on the visitor's pass</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 cursor-pointer">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "flex h-14 w-11 items-center justify-center rounded-2xl border text-xl font-extrabold transition-all",
                code.length > i ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-200"
              )}
            >
              {code[i] ?? "•"}
            </span>
          ))}
        </div>
        <div className="mx-auto mt-6 grid max-w-[260px] grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) =>
            d === "" ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                onClick={() => (d === "⌫" ? setCode((c) => c.slice(0, -1)) : press(d))}
                className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-800 transition-all hover:bg-slate-200 active:scale-95 cursor-pointer"
              >
                {d}
              </button>
            )
          )}
        </div>
        <Button size="lg" className="mt-6 w-full" disabled={code.length < 4} onClick={() => onSubmit(code)}>
          <ShieldCheck className="h-4 w-4" /> Verify pass
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ visitors */
export function GuardVisitors({ tab: initialTab }: { tab?: "alerts" }) {
  const { visitors, gateAction, toast } = useApp();
  const [tab, setTab] = useState<"all" | "pending" | "inside" | "completed" | "deliveries">("all");

  const list =
    tab === "all"
      ? visitors
      : tab === "pending"
      ? visitors.filter((v) => v.status === "pending" || v.status === "approved")
      : tab === "deliveries"
      ? visitors.filter((v) => v.purpose === "Delivery")
      : visitors.filter((v) => v.status === tab);

  const exit = async (v: Visitor) => {
    try { await gateAction(v.id, "exit"); toast(`Exit logged for ${v.name}`); }
    catch (e) { toast(e instanceof Error ? e.message : "Unable to log exit.", "danger"); }
  };

  if (initialTab === "alerts") {
    const { alerts: gateAlerts, overstays } = useGateAlerts();

    return (
      <div className="space-y-6">
        <PageHeader title="Alerts" subtitle="Things the gate team should know." />
        <div className="space-y-3">
          {gateAlerts.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-7 w-7" />}
              title="No alerts"
              message="Overstays and rejected passes will appear here."
            />
          ) : (
            gateAlerts.map((a) => (
              <Card key={a.id} className="flex items-start gap-4 p-5">
                <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", a.tone === "danger" ? "bg-rose-50 text-rose-600" : a.tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                  {a.tone === "danger" ? <ShieldAlert className="h-5 w-5" /> : a.tone === "warning" ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-900">{a.title}</p>
                    <span className="text-xs text-slate-400">{a.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{a.detail}</p>
                </div>
              </Card>
            ))
          )}
        </div>
        <section>
          <SectionTitle>Overstay alerts</SectionTitle>
          <Card className="divide-y divide-slate-100">
            {overstays.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">No visitors have overstayed.</p>
            ) : (
              overstays.map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{o.name} <span className="font-medium text-slate-400">· Flat {o.flat}</span></p>
                    <p className="text-xs text-slate-500">Entered {o.entered} · inside for {o.duration}</p>
                  </div>
                  <Badge tone="warning">Overstay</Badge>
                </div>
              ))
            )}
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Today's Visitors" subtitle="Everyone who came through the gates today." />
      <Tabs
        items={[
          { id: "all", label: "All" },
          { id: "pending", label: "Pending verification" },
          { id: "inside", label: "Inside" },
          { id: "deliveries", label: "Deliveries" },
          { id: "completed", label: "Exit log" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {list.length === 0 ? (
        <EmptyState icon={<UserRound className="h-7 w-7" />} title="No visitors here" message="Passes created by residents will show up in this list automatically." />
      ) : (
        <div className="space-y-3">
          {list.map((v) => (
            <Card key={v.id} className="flex items-center gap-4 p-4">
              <VisitorPhoto src={v.photo} name={v.name} className="h-14 w-14 rounded-2xl shadow-soft" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-900">{v.name}</p>
                  <Badge tone={statusBadge[v.status].tone}>{statusBadge[v.status].label}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Flat {v.flat} · {v.time} · guest of {v.resident} · {v.vehicle}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden font-mono text-xs font-bold tracking-widest text-slate-300 sm:block">{v.passCode}</span>
                {v.status === "inside" && (
                  <Button size="sm" variant="secondary" onClick={() => exit(v)}>
                    <LogOut className="h-3.5 w-3.5" /> Exit
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ walk-in */

export function GuardProfile() {
  const { role, profiles } = useApp();
  const [editOpen, setEditOpen] = useState(false);
  const p = profiles[role];
  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" subtitle="Your details and shift information." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="flex flex-col items-center p-8 text-center">
          <Avatar src={p.avatar} alt={p.name} size="2xl" ring />
          <h2 className="mt-4 text-xl font-extrabold">{p.name}</h2>
          <p className="text-sm text-slate-500">{p.title}</p>
          <p className="mt-1 text-xs text-slate-400">{p.society}</p>
          <Button variant="secondary" className="mt-5" onClick={() => setEditOpen(true)}>
            <Clock className="h-4 w-4" /> Edit profile
          </Button>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <SectionTitle>Work information</SectionTitle>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {p.fields.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-4 border-b border-slate-50 pb-2.5">
                  <span className="text-sm text-slate-400">{f.label}</span>
                  <span className="text-sm font-bold text-slate-800">{f.value}</span>
                </div>
              ))}
            </div>
          </Card>
          {p.sections?.map((s) => (
            <Card key={s.heading} className="p-6">
              <SectionTitle>{s.heading}</SectionTitle>
              <div className="space-y-3">
                {s.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-700">{r.label}</span>
                    <span className="text-sm font-bold text-slate-500">{r.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <ProfileEditor role={role} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}