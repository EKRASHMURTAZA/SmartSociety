export const SOCIETY_TIMEZONE = "Asia/Karachi";
export const SOCIETY_CURRENCY = "PKR";

export function formatCurrency(amount: number | null | undefined, currency: string = SOCIETY_CURRENCY): string {
  const value = Number(amount ?? 0);
  if (currency === "PKR") {
    return `Rs. ${value.toLocaleString("en-PK")}`;
  }
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PK", { timeZone: SOCIETY_TIMEZONE, ...opts }).format(date);
}

export function formatTime(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true }): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PK", { timeZone: SOCIETY_TIMEZONE, ...opts }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", { timeZone: SOCIETY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(date);
}

export function paisaToRupees(amount: number | null | undefined): number {
  return Number(amount ?? 0) / 100;
}

export function rupeesToPaisa(amount: number | null | undefined): number {
  return Math.round((Number(amount ?? 0)) * 100);
}