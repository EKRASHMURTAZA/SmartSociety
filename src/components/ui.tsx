import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useEffect,
  useState,
} from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ Button */
type ButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger" | "dangerSolid" | "white" | "dark";
type ButtonSize = "sm" | "md" | "lg" | "xl";

const btnVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-700/20",
  secondary: "bg-surface text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-700/20",
  danger: "bg-surface text-rose-600 border border-rose-200 hover:bg-rose-50",
  dangerSolid: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-700/20",
  white: "bg-surface text-brand-700 hover:bg-brand-50",
  dark: "bg-[#0f172a] text-white hover:bg-[#1e293b]",
};

const btnSizes: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-xl",
  xl: "px-8 py-4 text-base rounded-2xl",
};

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  loading,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer whitespace-nowrap",
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-[1.1em] w-[1.1em]" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Badge */
type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const badgeTones: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/25",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/15",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
};

export function Badge({ tone = "neutral", className, children, dot }: { tone?: BadgeTone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", badgeTones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------- Card */
export function Card({
  className,
  children,
  onClick,
  variant = "default",
  pad = true,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "flat" | "outline";
  pad?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl bg-surface border border-slate-200/80 shadow-soft",
        variant === "flat" && "bg-slate-50/70 border-slate-200/60 shadow-none",
        variant === "outline" && "shadow-none border-slate-200",
        pad && "p-5",
        onClick && "cursor-pointer transition-all hover:shadow-lift hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-bold uppercase tracking-[0.14em] text-brand-600", className)}>{children}</p>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-base font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Divider */
export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-slate-100", className)} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ DataRow */
export function DataRow({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2.5", className)}>
      <dt className="shrink-0 text-sm font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ Skeleton */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/80", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-24" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Empty state */
export function EmptyState({
  image,
  icon,
  title,
  message,
  action,
  className,
}: {
  image?: string;
  icon?: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {image ? (
        <img src={image} alt="" className="mb-5 h-24 w-24 rounded-full object-cover shadow-soft ring-4 ring-white" />
      ) : icon ? (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
      ) : null}
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

/* --------------------------------------------------------------- Error state */
export function ErrorState({
  title = "Something went wrong.",
  message = "Please try again. If the problem continues, contact support.",
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-rose-100 bg-rose-50/60 px-6 py-8 text-center", className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertCircleIcon />
      </span>
      <h3 className="mt-3 text-sm font-extrabold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-slate-500">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2 text-xs font-bold text-slate-700 shadow-soft ring-1 ring-slate-200 transition-all hover:bg-slate-50 cursor-pointer"
        >
          <RefreshIcon /> Retry
        </button>
      )}
    </div>
  );
}

function AlertCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 6v4.5M10 13.5v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M10 6a4 4 0 1 1-1.2-2.8M10 1.5V4H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------- Modal */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-[#020617]/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex w-full max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl bg-surface shadow-lift animate-pop-in sm:max-h-[90dvh] sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-surface/95 px-6 py-4 backdrop-blur">
          <div>
            {title && <h3 className="text-lg font-bold">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-slate-100 bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------- Tabs */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-100 p-1.5", className)}>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer",
            value === it.id ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
          )}
        >
          {it.label}
          {typeof it.count === "number" && (
            <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-bold", value === it.id ? "bg-brand-50 text-brand-700" : "bg-slate-200/70 text-slate-500")}>
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Accordion */
export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-surface shadow-soft">
      {items.map((it, i) => (
        <div key={i}>
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
          >
            <span className="text-sm font-semibold text-slate-800">{it.q}</span>
            <span className={cn("text-slate-400 transition-transform duration-200", openIdx === i && "rotate-45")}>
              <PlusIcon />
            </span>
          </button>
          {openIdx === i && (
            <p className="animate-fade-in px-5 pb-5 text-sm leading-relaxed text-slate-500">{it.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ Avatar */
export function Avatar({
  src,
  alt,
  size = "md",
  className,
  ring,
}: {
  src?: string;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  ring?: boolean;
}) {
  const sizes = {
    xs: "h-8 w-8",
    sm: "h-10 w-10",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
    "2xl": "h-32 w-32",
  };
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  if (!showImage) {
    return (
      <div className={cn("flex items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold", sizes[size], className)}>
        {alt?.slice(0, 1).toUpperCase() ?? "?"}
      </div>
    );
  }
  const imageSrc = src!.startsWith("/uploads/") ? `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ?? "http://localhost:4000"}${src}` : src;
  return (
    <img
      src={imageSrc}
      alt={alt ?? ""}
      onError={() => setFailed(true)}
      className={cn("rounded-full object-cover", sizes[size], ring && "ring-4 ring-white shadow-soft", className)}
    />
  );
}

/* -------------------------------------------- image with graceful fallback */
export function ImgWithFallback({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-slate-100 text-slate-400", className)} aria-hidden="true">
        {fallback ?? <ImageIcon className="h-1/3 w-1/3" />}
      </div>
    );
  }
  const imageSrc = src.startsWith("/uploads/") ? `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ?? "http://localhost:4000"}${src}` : src;
  return <img src={imageSrc} alt={alt ?? ""} onError={() => setFailed(true)} loading="lazy" className={className} />;
}

/* --------------------------------------------------------------------- QR */
export function QrCode({
  seed,
  size = 168,
  className,
}: {
  seed: string;
  size?: number;
  className?: string;
}) {
  const payload = JSON.stringify({
    type: "SMARTSOCIETY_VISITOR_PASS",
    passToken: seed,
  });
  return (
    <QRCodeSVG
      value={payload}
      size={size}
      level="M"
      includeMargin
      className={cn("h-auto max-w-full rounded-xl bg-surface", className)}
      role="img"
      aria-label="Visitor pass QR code"
    />
  );
}

/* -------------------------------------------------------------------- Bars */
export function HBarChart({
  data,
  format,
  className,
}: {
  data: { label: string; value: number }[];
  format?: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className={cn("space-y-3", className)}>
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs font-medium text-slate-500">{d.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-700"
              style={{ width: `${Math.max(4, (d.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs font-bold text-slate-700">{format ? format(d.value) : d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone = "brand", className }: { value: number; tone?: "brand" | "success" | "warning" | "danger"; className?: string }) {
  const tones = { brand: "bg-brand-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full transition-all duration-700", tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* -------------------------------------------------------------- Form fields */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const fieldClass =
  "w-full min-h-11 rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:bg-slate-50 disabled:text-slate-400";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldClass, "min-h-24 resize-none", props.className)} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(fieldClass, "cursor-pointer appearance-none bg-no-repeat pr-10", className)}>
      {children}
    </select>
  );
}

/* -------------------------------------------------------------- Status dot */
export function StatusDot({ tone }: { tone: "success" | "warning" | "danger" | "neutral" | "brand" }) {
  const tones = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    neutral: "bg-slate-300",
    brand: "bg-brand-500",
  };
  return <span className={cn("inline-block h-2 w-2 rounded-full", tones[tone])} />;
}
