import { useMemo, useState } from "react";
import {
  CalendarCheck,
  Car,
  CheckCircle2,
  Clock,
  Download,
  Megaphone,
  Printer,
  Receipt,
  Share2,
  Smartphone,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "../utils/cn";

import { useApp } from "../state/store";
import {
  AVATARS,
  type Visitor,
  type VisitorStatus,
} from "../data/mock";
import { formatCurrency } from "../lib/format";

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  ModalFooter,
  PageHeader,
  QrCode,
  SectionTitle,
  TextInput,
} from "../components/ui";

import { downloadTextFile, shareText } from "../utils/actions";
import { api } from "../lib/api";

/* ============================================================================
   HELPERS
============================================================================ */

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:4000";

const todayISO = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeStatus = (status: unknown): VisitorStatus => {
  const value = String(status ?? "").toLowerCase();

  switch (value) {
    case "approved":
      return "approved";

    case "pending":
      return "pending";

    case "inside":
      return "inside";

    case "completed":
      return "completed";

    case "rejected":
      return "rejected";

    case "cancelled":
      return "cancelled";

    case "expired":
      return "expired";

    default:
      return "pending";
  }
};

const getVisitorPhoto = (visitor: Visitor) => {
  const extendedVisitor = visitor as Visitor & {
    photoUrl?: string;
  };

  return visitor.photo || extendedVisitor.photoUrl || "";
};

const getVisitorDateISO = (visitor: Visitor) => {
  if (!visitor.dateISO) return "";

  /*
   * IMPORTANT:
   *
   * Backend can return:
   * 2026-08-15T00:00:00.000Z
   *
   * We only need the calendar date here.
   * Using new Date() can shift the date because of timezone.
   */
  return String(visitor.dateISO).slice(0, 10);
};

const formatVisitorDate = (dateISO: string) => {
  if (!dateISO) return "—";

  const parts = dateISO.slice(0, 10).split("-");

  if (parts.length !== 3) return dateISO;

  const [year, month, day] = parts;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  if (Number.isNaN(date.getTime())) return dateISO;

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getVisitorDateLabel = (visitor: Visitor) => {
  const visitorDate = getVisitorDateISO(visitor);
  const today = todayISO();

  if (visitorDate === today) return "Today";

  const todayDate = new Date(`${today}T00:00:00`);
  const visitorDateObj = new Date(`${visitorDate}T00:00:00`);

  if (
    !Number.isNaN(visitorDateObj.getTime()) &&
    !Number.isNaN(todayDate.getTime())
  ) {
    const diff =
      Math.round(
        (visitorDateObj.getTime() - todayDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
  }

  return formatVisitorDate(visitorDate);
};

const getVisitorTime = (visitor: Visitor) => {
  if (visitor.time) return visitor.time;

  const extendedVisitor = visitor as Visitor & {
    entryTime?: string;
    exitTime?: string;
  };

  if (extendedVisitor.entryTime || extendedVisitor.exitTime) {
    return `${extendedVisitor.entryTime || "—"} – ${
      extendedVisitor.exitTime || "—"
    }`;
  }

  return "—";
};

const timeToMinutes = (time: string) => {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) return -1;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return -1;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  return hour * 60 + minute;
};

export function visitorStatusBadge(status: VisitorStatus) {
  switch (normalizeStatus(status)) {
    case "approved":
      return <Badge tone="success">Pass ready</Badge>;

    case "pending":
      return <Badge tone="warning">Pending</Badge>;

    case "inside":
      return <Badge tone="info">Inside society</Badge>;

    case "completed":
      return <Badge tone="neutral">Completed</Badge>;

    case "rejected":
      return <Badge tone="danger">Rejected</Badge>;

    case "cancelled":
      return <Badge tone="neutral">Cancelled</Badge>;

    case "expired":
      return <Badge tone="warning">Expired</Badge>;

    default:
      return <Badge tone="neutral">Unknown</Badge>;
  }
}

/* ============================================================================
   DASHBOARD
============================================================================ */

export function ResidentDashboard() {
  const {
    setPage,
    user,
    visitors,
    bills,
    bookings,
    notices,
    complaints,
  } = useApp();

  const normalizedVisitors = useMemo(() => {
    return visitors.map((visitor) => ({
      ...visitor,
      status: normalizeStatus(visitor.status),
    }));
  }, [visitors]);

  const openBill = bills.find((b) => b.status !== "PAID");

  const insideNow = normalizedVisitors.filter(
    (v) => v.status === "inside"
  ).length;

  const todayVisitors = normalizedVisitors.filter(
    (v) => getVisitorDateISO(v) === todayISO()
  );

  const expectedToday = todayVisitors.filter(
    (v) =>
      v.status === "approved" ||
      v.status === "pending"
  ).length;

  const openComplaints = complaints.filter(
    (c) => c.status !== "resolved"
  );

  const nextVisitor = normalizedVisitors.find(
    (v) =>
      v.status === "approved" ||
      v.status === "inside"
  );

  const nextBooking = bookings.find(
    (b) =>
      b.status === "confirmed" ||
      b.status === "pending"
  );

  const latestNotice = notices[0];

  const day = new Date().toLocaleDateString("en-PK", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const quick = [
    {
      icon: UserPlus,
      label: "Visitor Pass",
      sub: "Create a guest pass",
      page: "visitors",
    },
    {
      icon: Receipt,
      label: "Pay Bill",
      sub: "Maintenance dues",
      page: "bills",
    },
    {
      icon: Wrench,
      label: "Raise Complaint",
      sub: "Report a problem",
      page: "complaints",
    },
    {
      icon: CalendarCheck,
      label: "Book Amenity",
      sub: "Check availability",
      page: "amenities",
    },
  ] as const;

  const timeline = [
    ...todayVisitors.slice(0, 3).map((v) => ({
      id: `v-${v.id}`,
      icon: Users,
      tone: "bg-sky-50 text-sky-600",
      title:
        v.status === "inside"
          ? `${v.name} is at the gate`
          : v.status === "completed"
            ? `${v.name} visited`
            : `Pass ready for ${v.name}`,
      detail: `${v.purpose} · ${getVisitorTime(v)}`,
    })),

    ...complaints.slice(0, 2).map((c) => ({
      id: `c-${c.id}`,
      icon: Wrench,
      tone: "bg-amber-50 text-amber-600",
      title: `${c.number} · ${c.title}`,
      detail: `${c.category} · ${
        c.status === "resolved"
          ? "Resolved"
          : c.status === "in-progress"
            ? "In progress"
            : "Pending"
      }`,
    })),

    ...bookings
      .filter((b) => b.status === "confirmed")
      .slice(0, 2)
      .map((b) => ({
        id: `b-${b.id}`,
        icon: CalendarCheck,
        tone: "bg-brand-50 text-brand-600",
        title: `${b.amenity} confirmed`,
        detail: `${b.date} · ${b.slot}`,
      })),
  ].slice(0, 5);

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="flex items-center gap-4">
        <Avatar
          src={user?.avatar ?? undefined}
          alt={user?.name ?? "Resident"}
          size="lg"
          ring
        />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
            {day}
          </p>

          <h1 className="mt-0.5 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
            Good day, {user?.name ?? "Resident"}
          </h1>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span>
              {user?.flat
                ? `Flat ${user.flat.tower}-${user.flat.number}`
                : "Maple Heights, Lahore"}
            </span>

            <span
              className="inline-flex items-center gap-1.5 text-emerald-600"
              title="Based on live visitor data"
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot"
                aria-hidden="true"
              />

              {insideNow > 0
                ? `${insideNow} visitor${
                    insideNow > 1 ? "s" : ""
                  } in society`
                : "Society secure"}
            </span>
          </p>
        </div>
      </div>

      {/* Society Pulse */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white shadow-lift">
        <div className="flex items-center justify-between px-5 pt-4 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-200">
              Society Pulse
            </p>

            <p className="mt-0.5 text-sm text-brand-100/80">
              Live status of Maple Heights
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/10 px-2.5 py-1 text-[11px] font-bold text-brand-50 ring-1 ring-inset ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            Live
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px bg-surface/10 sm:grid-cols-4">
          {[
            {
              label: "Visitors inside",
              value: String(insideNow),
              sub: "in the premises",
            },
            {
              label: "Expected today",
              value: String(expectedToday),
              sub: "passes scheduled",
            },
            {
              label: "Open complaints",
              value: String(openComplaints.length),
              sub:
                openComplaints.length > 0
                  ? "being tracked"
                  : "all clear",
            },
            {
              label: "Maintenance",
              value: openBill
                ? formatCurrency(openBill.amountDue + openBill.penalty)
                : "Paid",
              sub: openBill
                ? `due ${new Date(
                    openBill.dueDate
                  ).toLocaleDateString("en-PK", {
                    day: "2-digit",
                    month: "short",
                  })}`
                : "nothing due",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-brand-800/40 px-5 py-4 backdrop-blur-sm"
            >
              <p className="tnum text-xl font-extrabold tracking-tight">
                {s.value}
              </p>

              <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-200">
                {s.label}
              </p>

              <p className="text-[11px] text-brand-100/70">
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <SectionTitle
          action={
            <button
              onClick={() => setPage("emergency")}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
            >
              Emergency
            </button>
          }
        >
          Quick actions
        </SectionTitle>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => setPage(q.page)}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200/80 bg-surface p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift cursor-pointer"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <q.icon className="h-5 w-5" />
              </span>

              <span>
                <span className="block text-[15px] font-bold text-slate-900">
                  {q.label}
                </span>

                <span className="mt-0.5 block text-xs text-slate-400">
                  {q.sub}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Needs attention */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card
          className={cn(
            "flex flex-col p-5",
            openBill &&
              "border-brand-200 bg-brand-50/40"
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Maintenance
            </p>

            <Receipt className="h-4 w-4 text-slate-300" />
          </div>

          <p className="tnum mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            {openBill
              ? formatCurrency(openBill.amountDue + openBill.penalty)
              : "All paid"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {openBill
              ? `Due ${new Date(
                  openBill.dueDate
                ).toLocaleDateString("en-PK", {
                  day: "2-digit",
                  month: "short",
                })} · ${openBill.period}`
              : "No outstanding bill"}
          </p>

          <button
            onClick={() => setPage("bills")}
            className="mt-4 text-sm font-bold text-brand-700 hover:text-brand-800 cursor-pointer"
          >
            View bills →
          </button>
        </Card>

        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Visitor
            </p>

            <Users className="h-4 w-4 text-slate-300" />
          </div>

          <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            {nextVisitor?.name ?? "No active pass"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {nextVisitor
              ? `${getVisitorDateLabel(
                  nextVisitor
                )} · ${getVisitorTime(nextVisitor)}`
              : "Create a pass when you expect a guest"}
          </p>

          <button
            onClick={() => setPage("visitors")}
            className="mt-4 text-sm font-bold text-brand-700 hover:text-brand-800 cursor-pointer"
          >
            Manage visitors →
          </button>
        </Card>

        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Booking
            </p>

            <CalendarCheck className="h-4 w-4 text-slate-300" />
          </div>

          <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            {nextBooking?.amenity ?? "No booking"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {nextBooking
              ? `${nextBooking.date} · ${nextBooking.slot}`
              : "Check live availability"}
          </p>

          <button
            onClick={() => setPage("amenities")}
            className="mt-4 text-sm font-bold text-brand-700 hover:text-brand-800 cursor-pointer"
          >
            Book an amenity →
          </button>
        </Card>
      </section>

      {/* Timeline */}
      <section>
        <SectionTitle
          action={
            <button
              onClick={() => setPage("activity")}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              View all →
            </button>
          }
        >
          Today at a glance
        </SectionTitle>

        {timeline.length === 0 ? (
          <Card className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Clock className="h-6 w-6" />
            </span>

            <h3 className="mt-3 font-bold text-slate-900">
              Nothing happening yet
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Visitors, complaints and bookings you create will appear here as they happen.
            </p>
          </Card>
        ) : (
          <Card
            pad={false}
            className="divide-y divide-slate-100"
          >
            {timeline.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3.5 px-5 py-3.5"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    a.tone
                  )}
                >
                  <a.icon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {a.title}
                  </p>

                  <p className="text-xs text-slate-500">
                    {a.detail}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Notice */}
      {latestNotice && (
        <Card
          className={cn(
            "flex items-start gap-4 border-l-4 p-5",
            latestNotice.emergency
              ? "border-l-rose-500"
              : "border-l-amber-400"
          )}
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              latestNotice.emergency
                ? "bg-rose-50 text-rose-600"
                : "bg-amber-50 text-amber-600"
            )}
          >
            <Megaphone className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  latestNotice.emergency
                    ? "danger"
                    : "warning"
                }
              >
                {latestNotice.emergency
                  ? "Emergency"
                  : latestNotice.tag}
              </Badge>

              {latestNotice.date && (
                <span className="text-[11px] font-medium text-slate-400">
                  {latestNotice.date}
                </span>
              )}
            </div>

            <p className="mt-1.5 font-bold text-slate-900">
              {latestNotice.title}
            </p>

            <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
              {latestNotice.body}
            </p>
          </div>

          <button
            onClick={() => setPage("community")}
            className="hidden shrink-0 text-sm font-bold text-brand-700 hover:text-brand-800 sm:block cursor-pointer"
          >
            View →
          </button>
        </Card>
      )}
    </div>
  );
}

/* ============================================================================
   BILLS
============================================================================ */

export function ResidentBills() {
  const {
    toast,
    payment,
    recordPayment,
    bills,
    user,
  } = useApp();

  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("JazzCash");
  const [paying, setPaying] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);

  const currentBill = bills[0] ?? null;

  const paid =
    Boolean(
      currentBill &&
        currentBill.status === "PAID"
    ) ||
    payment?.billId === currentBill?.id;

  const currentBillItems =
    currentBill?.items?.map((item) => ({
      label: item.label,
      note: "Society charge",
      amount: item.amount,
    })) ?? [];

  const totalAmount = currentBill
    ? currentBill.amountDue + currentBill.penalty
    : 0;

  const max = Math.max(
    0,
    ...currentBillItems.map((b) => b.amount)
  );

  const receiptNumber =
    payment?.receiptNumber ??
    currentBill?.payments?.[0]?.receipt ??
    "Pending receipt";

  const paymentDate =
    payment?.paymentDate ?? "Not paid yet";

  const dueDate = currentBill?.dueDate
    ? new Date(
        currentBill.dueDate
      ).toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
      })
    : "";

  const residentName = user?.name ?? "Resident";

  const residentFlat = user?.flat
    ? `${user.flat.tower}-${user.flat.number}`
    : "";

  const previousBills = bills.slice(1);

  const startPayment = async () => {
    if (paying) return;

    setPaying(true);

    if (!currentBill) {
      toast(
        "No current bill is available.",
        "warning"
      );

      setPaying(false);
      return;
    }

    const nextPayment = {
      billId: currentBill.id,
      receiptNumber: "pending",
      amount: totalAmount,
      method,
      paymentDate:
        new Date().toLocaleDateString(
          "en-PK",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        ),
    };

    try {
      await recordPayment(nextPayment);

      setPaying(false);
      setReceiptVisible(false);

      toast(
        "Payment recorded and sent to the server.",
        "success"
      );
    } catch (error) {
      setPaying(false);

      toast(
        error instanceof Error
          ? error.message
          : "Payment failed",
        "danger"
      );
    }
  };

  const closePay = () => {
    setPayOpen(false);
    setPaying(false);
    setReceiptVisible(false);
    setMethod("JazzCash");
  };

  const openReceipt = () => {
    setReceiptVisible(true);
  };

  const printReceiptHtml = () => {
    const items = currentBillItems
      .map(
        (item) =>
          `<tr><td>${item.label}</td><td>${item.note}</td><td style="text-align:right;font-weight:700;">Rs. ${item.amount.toLocaleString(
            "en-PK"
          )}</td></tr>`
      )
      .join("");

    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>SmartSociety Receipt ${receiptNumber}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 40px;
              color: #0f172a;
              background: #f8fafc;
              font-family: Inter, Arial, sans-serif;
            }
            .receipt {
              max-width: 760px;
              margin: 0 auto;
              padding: 40px;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 20px;
            }
            .top {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              margin-bottom: 32px;
            }
            .brand { font-size: 22px; font-weight: 800; }
            .muted { color: #64748b; font-size: 13px; }
            .title { font-size: 30px; font-weight: 800; margin-top: 8px; }
            .status {
              display: inline-flex;
              padding: 8px 12px;
              border-radius: 999px;
              background: #ecfdf5;
              color: #047857;
              font-size: 12px;
              font-weight: 800;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              padding: 18px;
              border-radius: 14px;
              background: #f8fafc;
              margin-bottom: 28px;
            }
            .label { color: #64748b; font-size: 12px; }
            .value { margin-top: 4px; font-size: 14px; font-weight: 700; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            th, td {
              padding: 13px 0;
              text-align: left;
              border-bottom: 1px solid #e2e8f0;
              font-size: 13px;
            }
            th {
              color: #64748b;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: .08em;
            }
            .total {
              display: flex;
              justify-content: space-between;
              margin-top: 20px;
              padding-top: 18px;
              border-top: 2px solid #0f172a;
              font-size: 18px;
              font-weight: 800;
            }
            .footer {
              margin-top: 32px;
              padding-top: 18px;
              border-top: 1px solid #e2e8f0;
              color: #64748b;
              font-size: 12px;
              line-height: 1.6;
            }
            @media print {
              body { padding: 0; background: #fff; }
              .receipt { border: 0; border-radius: 0; }
            }
          </style>
        </head>

        <body>
          <div class="receipt">
            <div class="top">
              <div>
                <div class="brand">SmartSociety</div>
                <div class="muted">Maintenance payment receipt</div>
                <div class="title">Receipt</div>
              </div>

              <div>
                <div class="status">PAID</div>
                <div class="muted" style="margin-top:10px;text-align:right;">
                  ${receiptNumber}
                </div>
              </div>
            </div>

            <div class="grid">
              <div>
                <div class="label">Resident</div>
                <div class="value">${residentName}</div>
              </div>

              <div>
                <div class="label">Flat</div>
                <div class="value">${residentFlat}</div>
              </div>

              <div>
                <div class="label">Billing period</div>
                <div class="value">${currentBill?.period ?? "Current period"}</div>
              </div>

              <div>
                <div class="label">Payment date</div>
                <div class="value">${paymentDate}</div>
              </div>

              <div>
                <div class="label">Payment method</div>
                <div class="value">${method}</div>
              </div>

              <div>
                <div class="label">Status</div>
                <div class="value">Paid</div>
              </div>
            </div>

            <div class="muted">Charge breakdown</div>

            <table>
              <thead>
                <tr>
                  <th>Charge</th>
                  <th>Description</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>

              <tbody>${items}</tbody>
            </table>

            <div class="total">
              <span>Total paid</span>
              <span>Rs. ${totalAmount.toLocaleString("en-PK")}</span>
            </div>

            <div class="footer">
              This receipt was recorded by the SmartSociety billing service.
              For questions, contact the society office.
            </div>
          </div>

          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;
  };

  const printReceipt = () => {
    const receiptWindow = window.open(
      "",
      "_blank",
      "width=820,height=920"
    );

    if (!receiptWindow) {
      toast(
        "Please allow pop-ups to save your receipt as PDF.",
        "warning"
      );
      return;
    }

    receiptWindow.document.write(
      printReceiptHtml()
    );

    receiptWindow.document.close();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bills"
        subtitle="Your society charges, clearly broken down."
      />

      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[1.2fr_1fr]">
          <div className="p-6 sm:p-8">
            <Badge tone={paid ? "success" : "warning"}>
              {paid
                ? `Paid on ${paymentDate}`
                : currentBill
                  ? `Due ${dueDate}`
                  : "No bill available"}
            </Badge>

            <p className="mt-4 text-sm font-semibold text-slate-500">
              {paid ? "Paid amount" : "Current due"}
            </p>

            <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Rs. {totalAmount.toLocaleString("en-PK")}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {currentBill
                ? `${currentBill.period} maintenance bill`
                : "Current maintenance bill"}{" "}
              · Flat{" "}
              {currentBill ? "your linked flat" : "—"}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {paid ? (
                <>
                  <Button
                    size="lg"
                    onClick={openReceipt}
                  >
                    <Receipt className="h-4 w-4" />
                    View Receipt
                  </Button>

                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={printReceipt}
                  >
                    <Printer className="h-4 w-4" />
                    Save as PDF
                  </Button>
                </>
              ) : currentBill ? (
                <>
                  <Button
                    size="lg"
                    onClick={() => setPayOpen(true)}
                  >
                    <Receipt className="h-4 w-4" />
                    Pay Bill
                  </Button>

                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={printReceipt}
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  No maintenance bill is available for your flat.
                </p>
              )}
            </div>

            {paid && (
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                  <div>
                    <p className="text-sm font-bold text-emerald-900">
                      Payment completed
                    </p>

                    <p className="mt-0.5 text-xs text-emerald-700">
                      Receipt {receiptNumber} ·{" "}
                      {paymentDate} · {method}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/60 p-6 sm:p-8 md:border-l md:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-800">
                Payment methods
              </p>

              <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                Secure payment
              </span>
            </div>

            <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
              {[
                {
                  icon: Smartphone,
                  label: "JazzCash / EasyPaisa (mobile wallet)",
                },
                {
                  icon: Receipt,
                  label: "Credit / debit cards",
                },
                {
                  icon: Receipt,
                  label: "Bank transfer",
                },
                {
                  icon: Receipt,
                  label: "Cash at society office",
                },
                {
                  icon: Receipt,
                  label: "Cash at society office",
                },
              ].map((m, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2.5"
                >
                  <m.icon className="h-4 w-4 text-brand-600" />
                  {m.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <section>
        <SectionTitle>
          Charge breakdown
        </SectionTitle>

        <Card className="divide-y divide-slate-100">
          {currentBillItems.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-4 px-5 py-4 sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">
                  {b.label}
                </p>

                <p className="text-xs text-slate-400">
                  {b.note}
                </p>
              </div>

              <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-slate-100 sm:block">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{
                    width: `${
                      max > 0
                        ? (b.amount / max) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <p className="w-20 text-right text-sm font-extrabold text-slate-900">
                Rs. {b.amount.toLocaleString("en-PK")}
              </p>
            </div>
          ))}

          <div className="flex items-center justify-between bg-slate-50/70 px-5 py-4 sm:px-6">
            <p className="text-sm font-bold text-slate-900">
              Total
            </p>

            <p className="text-sm font-extrabold text-brand-700">
              Rs. {totalAmount.toLocaleString("en-PK")}
            </p>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>
          Previous bills
        </SectionTitle>

        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 sm:grid">
            <span>Month</span>
            <span>Amount</span>
            <span>Paid on</span>
            <span className="w-20 text-right">
              Status
            </span>
          </div>

          {previousBills.length === 0 ? (
            <Card className="px-5 py-8 text-center text-sm text-slate-500">
              No previous bills found.
            </Card>
          ) : (
            previousBills.map((b) => {
              const paidOn =
                b.payments?.[0]?.createdAt
                  ? new Date(
                      b.payments[0].createdAt
                    ).toLocaleDateString(
                      "en-PK",
                      {
                        day: "2-digit",
                        month: "short",
                      }
                    )
                  : "—";

              const isPaid =
                b.status === "PAID";

              return (
                <div
                  key={b.id}
                  className="grid grid-cols-2 gap-3 border-b border-slate-50 px-5 py-4 text-sm last:border-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4 sm:px-6"
                >
                  <p className="font-bold text-slate-800">
                    {b.period}
                  </p>

                  <p className="text-right font-semibold text-slate-600 sm:text-left">
                    Rs.{" "}
                    {(
                      b.amountDue +
                      b.penalty
                    ).toLocaleString("en-PK")}
                  </p>

                  <p className="text-xs text-slate-400 sm:w-24">
                    {paidOn}
                  </p>

                  <p className="text-right sm:w-20 sm:text-right">
                    <Badge
                      tone={
                        isPaid
                          ? "success"
                          : "warning"
                      }
                    >
                      {isPaid ? "Paid" : "Due"}
                    </Badge>
                  </p>
                </div>
              );
            })
          )}
        </Card>
      </section>

      <Modal
        open={payOpen}
        onClose={closePay}
        title={
          paid
            ? "Payment recorded"
            : "Pay your maintenance bill"
        }
        subtitle={
          paid
            ? "Your payment was recorded on the server."
            : `Rs. ${totalAmount.toLocaleString(
                "en-PK"
              )} · Due ${dueDate}`
        }
      >
        {paid ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </span>

            <h3 className="mt-4 text-xl font-extrabold text-slate-900">
              Rs.{" "}
              {totalAmount.toLocaleString(
                "en-PK"
              )}{" "}
              paid
            </h3>

            <p className="mt-1 max-w-xs text-sm text-slate-500">
              Payment via {method} confirmed.
              Your receipt is now ready.
            </p>

            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              <Button onClick={openReceipt}>
                <Receipt className="h-4 w-4" />
                View receipt
              </Button>

              <Button
                variant="secondary"
                onClick={printReceipt}
              >
                <Printer className="h-4 w-4" />
                Save as PDF
              </Button>
            </div>

            <Button
              className="mt-2 w-full"
              variant="ghost"
              onClick={closePay}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {[
                "JazzCash",
                "EasyPaisa",
                "Card",
                "Bank Transfer",
              ].map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                    method === m
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Bill amount</span>
                <span className="font-semibold text-slate-700">
                  Rs.{" "}
                  {totalAmount.toLocaleString(
                    "en-PK"
                  )}
                </span>
              </div>

              <div className="mt-1.5 flex justify-between text-slate-500">
                <span>Convenience fee</span>
                <span className="font-semibold text-emerald-600">
                  Free
                </span>
              </div>

              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Total</span>

                <span>
                  Rs.{" "}
                  {totalAmount.toLocaleString(
                    "en-PK"
                  )}
                </span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={startPayment}
              disabled={paying}
            >
              {paying
                ? "Processing…"
                : `Pay Rs. ${totalAmount.toLocaleString(
                    "en-PK"
                  )} via ${method}`}
            </Button>

            <p className="text-center text-xs text-slate-400">
              Payment is processed by the society
              billing service and a receipt is generated.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={receiptVisible}
        onClose={() =>
          setReceiptVisible(false)
        }
        title="Payment receipt"
        subtitle={`${receiptNumber} · ${paymentDate}`}
        wide
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>

              <div>
                <p className="font-bold text-emerald-900">
                  Payment received
                </p>

                <p className="text-xs text-emerald-700">
                  {method} · {paymentDate}
                </p>
              </div>
            </div>

            <p className="text-xl font-extrabold text-emerald-800">
              Rs.{" "}
              {totalAmount.toLocaleString(
                "en-PK"
              )}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-400">
                Resident
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {residentName}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-400">
                Flat
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {residentFlat}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-400">
                Billing period
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {currentBill?.period ??
                  "Current period"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-400">
                Receipt number
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {receiptNumber}
              </p>
            </div>
          </div>

          <div>
            <SectionTitle>
              Paid charges
            </SectionTitle>

            <Card className="divide-y divide-slate-100">
              {currentBillItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.label}
                    </p>

                    <p className="text-xs text-slate-400">
                      {item.note}
                    </p>
                  </div>

                  <p className="text-sm font-bold text-slate-900">
                    Rs.{" "}
                    {item.amount.toLocaleString(
                      "en-PK"
                    )}
                  </p>
                </div>
              ))}
            </Card>
          </div>

          <ModalFooter>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                onClick={printReceipt}
              >
                <Printer className="h-4 w-4" />
                Print / Save as PDF
              </Button>

              <Button
                variant="secondary"
                className="flex-1"
                onClick={() =>
                  downloadTextFile(
                    `receipt-${receiptNumber}.html`,
                    printReceiptHtml(),
                    "text/html;charset=utf-8"
                  )
                }
              >
                <Download className="h-4 w-4" />
                Download receipt
              </Button>
            </div>

            <p className="text-center text-xs text-slate-400">
              Use your browser's Print dialog and choose
              "Save as PDF" to keep a PDF copy.
            </p>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================================
   VISITORS
============================================================================ */

export function ResidentVisitors() {
  const {
    visitors,
    addVisitor,
    cancelVisitor,
    toast,
  } = useApp();

  const [tab, setTab] = useState<
    "active" | "upcoming" | "past"
  >("active");

  const [createOpen, setCreateOpen] =
    useState(false);

  const [passVisitor, setPassVisitor] =
    useState<Visitor | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    vehicle: "",
    date: todayISO(),
    startTime: "6:30 PM",
    endTime: "8:00 PM",
    purpose: "Friend visit",
  });

  const [visitorPhoto, setVisitorPhoto] =
    useState<File | null>(null);

  const [photoPreview, setPhotoPreview] =
    useState("");

  const [creating, setCreating] =
    useState(false);

  /*
   * Normalize every visitor coming from backend/store.
   *
   * Backend:
   * APPROVED
   *
   * Frontend:
   * approved
   */
  const normalizedVisitors = useMemo(() => {
    return visitors.map((visitor) => ({
      ...visitor,
      status: normalizeStatus(visitor.status),

      photo:
        visitor.photo ||
        (
          visitor as Visitor & {
            photoUrl?: string;
          }
        ).photoUrl ||
        "",

      dateLabel:
        getVisitorDateLabel(visitor),

      time:
        getVisitorTime(visitor),
    }));
  }, [visitors]);

  /*
   * IMPORTANT:
   *
   * Do NOT use:
   * v.dateLabel === "Today"
   *
   * because backend may return:
   * 15 Aug 2026
   *
   * Instead we compare dateISO.
   */
  const { active, upcoming, past } =
    useMemo(() => {
      const today = todayISO();

      const activeVisitors =
        normalizedVisitors.filter((v) => {
          const visitorDate =
            getVisitorDateISO(v);

          return (
            visitorDate === today &&
            (
              v.status === "approved" ||
              v.status === "pending" ||
              v.status === "inside"
            )
          );
        });

      const upcomingVisitors =
        normalizedVisitors.filter((v) => {
          const visitorDate =
            getVisitorDateISO(v);

          return (
            visitorDate > today &&
            v.status !== "completed" &&
            v.status !== "rejected" &&
            v.status !== "cancelled" &&
            v.status !== "expired"
          );
        });

      const pastVisitors =
        normalizedVisitors.filter((v) => {
          const visitorDate =
            getVisitorDateISO(v);

          return (
            visitorDate < today ||
            v.status === "completed" ||
            v.status === "rejected" ||
            v.status === "cancelled" ||
            v.status === "expired"
          );
        });

      return {
        active: activeVisitors,
        upcoming: upcomingVisitors,
        past: pastVisitors,
      };
    }, [normalizedVisitors]);

  const list =
    tab === "active"
      ? active
      : tab === "upcoming"
        ? upcoming
        : past;

  const createPass = async () => {
    if (!form.name.trim()) {
      toast(
        "Please enter the visitor's name",
        "warning"
      );
      return;
    }

    if (!form.phone.trim()) {
      toast(
        "Please enter a visitor phone number",
        "warning"
      );
      return;
    }

    if (!form.date) {
      toast(
        "Please select a visitor date.",
        "warning"
      );
      return;
    }

    const startMinutes =
      timeToMinutes(form.startTime);

    const endMinutes =
      timeToMinutes(form.endTime);

    if (
      startMinutes < 0 ||
      endMinutes < 0
    ) {
      toast(
        "Please select valid entry and exit times.",
        "warning"
      );
      return;
    }

    if (endMinutes <= startMinutes) {
      toast(
        "Exit time must be after entry time.",
        "warning"
      );
      return;
    }

    setCreating(true);

    try {
      let photoUrl = "";

      /*
       * Upload photo first.
       */
      if (visitorPhoto) {
        const uploaded =
          await api.uploadImage(
            "visitors",
            visitorPhoto
          );

        photoUrl = uploaded.url;
      }

      /*
       * Validate date.
       */
      const base = new Date(
        `${form.date}T00:00:00`
      );

      if (
        Number.isNaN(base.getTime())
      ) {
        throw new Error(
          "Choose a valid visitor date."
        );
      }

      /*
       * Send visitor to backend/store.
       */
      const created = await addVisitor({
        id: "",
        name: form.name.trim(),

        photo: photoUrl,

        phone: form.phone.trim(),

        vehicle:
          form.vehicle.trim() || "—",

        flat: "",

        resident: "",

        purpose:
          form.purpose.trim() || "Visit",

        dateLabel:
          form.date === todayISO()
            ? "Today"
            : formatVisitorDate(form.date),

        /*
         * Keep YYYY-MM-DD.
         *
         * Do NOT use:
         * base.toISOString().slice(0, 10)
         *
         * because timezone can shift the date.
         */
        dateISO: form.date,

        time: `${form.startTime} – ${form.endTime}`,

        status: "approved",

        passCode: "",

        guests: 1,
      });

      /*
       * Normalize the newly created visitor too.
       */
      const createdVisitor = {
        ...created,

        status: normalizeStatus(
          created.status
        ),

        photo:
          created.photo ||
          (
            created as Visitor & {
              photoUrl?: string;
            }
          ).photoUrl ||
          photoUrl ||
          "",

        dateLabel:
          getVisitorDateLabel(created),

        time:
          getVisitorTime(created),
      } as Visitor;

      toast(
        `Pass created for ${created.name}`,
        "success"
      );

      setCreateOpen(false);

      setVisitorPhoto(null);
      setPhotoPreview("");

      setForm({
        name: "",
        phone: "",
        vehicle: "",
        date: todayISO(),
        startTime: "6:30 PM",
        endTime: "8:00 PM",
        purpose: "Friend visit",
      });

      /*
       * Open the pass immediately.
       */
      setPassVisitor(createdVisitor);

      /*
       * Automatically switch to Active if today's visitor.
       */
      if (
        getVisitorDateISO(createdVisitor) ===
        todayISO()
      ) {
        setTab("active");
      } else {
        setTab("upcoming");
      }
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Unable to create visitor pass",
        "danger"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Your Visitors"
        subtitle="Passes you've created for guests, deliveries and family."
        actions={
          <Button
            onClick={() =>
              setCreateOpen(true)
            }
          >
            <UserPlus className="h-4 w-4" />
            Create Visitor Pass
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1.5">
        {(
          [
            [
              "active",
              `Active (${active.length})`,
            ],
            [
              "upcoming",
              `Upcoming (${upcoming.length})`,
            ],
            [
              "past",
              `Past (${past.length})`,
            ],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() =>
              setTab(id)
            }
            className={cn(
              "flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer",
              tab === id
                ? "bg-surface text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Visitor list */}
      {list.length === 0 ? (
        <EmptyState
          image={AVATARS.resident}
          title={
            tab === "active"
              ? "No visitor passes yet"
              : "Nothing here yet"
          }
          message={
            tab === "active"
              ? "Create your first visitor pass to give guests easy entry through the gate."
              : "Passes you create will appear here."
          }
          action={
            <Button
              onClick={() =>
                setCreateOpen(true)
              }
            >
              <UserPlus className="h-4 w-4" />
              Create Visitor Pass
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((v) => {
            const visitorPhoto =
              getVisitorPhoto(v);

            const status =
              normalizeStatus(v.status);

            return (
              <Card
                key={v.id}
                className="flex gap-4 p-4"
              >
                {/* Visitor photo */}
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                  {visitorPhoto ? (
                    <img
                      src={
                        visitorPhoto.startsWith(
                          "/uploads/"
                        )
                          ? `${API_BASE_URL}${visitorPhoto}`
                          : visitorPhoto
                      }
                      alt={v.name}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Users className="h-7 w-7 text-slate-400" />
                    </div>
                  )}
                </div>

                {/* Visitor information */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {v.name}
                      </p>

                      <p className="text-xs text-slate-400">
                        {v.purpose}
                        {v.flat
                          ? ` · ${v.flat}`
                          : ""}
                      </p>
                    </div>

                    {visitorStatusBadge(
                      status
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />

                      {getVisitorDateLabel(
                        v
                      )}{" "}
                      ·{" "}
                      {getVisitorTime(v)}
                    </span>

                    {v.vehicle &&
                      v.vehicle !== "—" && (
                        <span className="inline-flex items-center gap-1">
                          <Car className="h-3.5 w-3.5 text-slate-400" />
                          {v.vehicle}
                        </span>
                      )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {/* View pass */}
                    <Button
                      size="sm"
                      onClick={() =>
                        setPassVisitor(v)
                      }
                    >
                      View Pass
                    </Button>

                    {/* Cancel */}
                    {(status === "approved" ||
                      status === "pending") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await cancelVisitor(
                              v.id
                            );

                            toast(
                              "Visitor pass cancelled.",
                              "success"
                            );
                          } catch (error) {
                            toast(
                              error instanceof
                                Error
                                ? error.message
                                : "Unable to cancel the pass",
                              "danger"
                            );
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}

                    {/* Share */}
                    {status ===
                      "approved" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const text = `SmartSociety visitor pass for ${v.name}. Flat ${
                            v.flat || "your flat"
                          }. ${getVisitorDateLabel(
                            v
                          )} · ${getVisitorTime(
                            v
                          )}. Pass code: ${
                            v.passCode ||
                            "Available in app"
                          }.`;

                          const result =
                            await shareText(
                              "SmartSociety visitor pass",
                              text,
                              `https://wa.me/?text=${encodeURIComponent(
                                text
                              )}`
                            );

                          toast(
                            result === "shared"
                              ? "Pass shared successfully."
                              : result === "copied"
                                ? "Pass details copied to clipboard."
                                : result === "opened"
                                  ? "WhatsApp opened with the pass details."
                                  : "Sharing is not supported in this browser.",
                            result ===
                              "unsupported"
                              ? "warning"
                              : "success"
                          );
                        }}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ====================================================================
          CREATE VISITOR MODAL
      ==================================================================== */}

      <Modal
        open={createOpen}
        onClose={() =>
          setCreateOpen(false)
        }
        title="Create visitor pass"
        subtitle="The guard will see this pass instantly."
      >
        <div className="space-y-4">

          {/* Photo */}
          <Field
            label="Visitor photo"
            hint="JPG, PNG or WEBP · max 5 MB"
          >
            <div className="rounded-2xl border border-dashed border-slate-300 p-4">
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Visitor preview"
                    className="h-16 w-16 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <Users className="h-6 w-6 text-slate-400" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(e) => {
                      const file =
                        e.target.files?.[0] ??
                        null;

                      if (
                        file &&
                        file.size >
                          5 *
                            1024 *
                            1024
                      ) {
                        toast(
                          "Photo must be 5 MB or smaller.",
                          "warning"
                        );
                        return;
                      }

                      setVisitorPhoto(
                        file
                      );

                      setPhotoPreview(
                        file
                          ? URL.createObjectURL(
                              file
                            )
                          : ""
                      );
                    }}
                    className="block w-full text-sm"
                  />

                  {visitorPhoto && (
                    <button
                      type="button"
                      className="mt-2 text-xs font-bold text-rose-600"
                      onClick={() => {
                        setVisitorPhoto(
                          null
                        );

                        setPhotoPreview(
                          ""
                        );
                      }}
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Field>

          {/* Name */}
          <Field label="Visitor name">
            <TextInput
              placeholder="e.g. Ahmed Khan"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              autoFocus
            />
          </Field>

          {/* Phone / Vehicle */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <TextInput
                placeholder="+92 3XX XXXXXXX"
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value,
                  })
                }
              />
            </Field>

            <Field label="Vehicle number (optional)">
              <TextInput
                placeholder="LEB-1234"
                value={form.vehicle}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vehicle:
                      e.target.value,
                  })
                }
              />
            </Field>
          </div>

          {/* Date / Entry / Exit */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date">
              <input
                type="date"
                min={todayISO()}
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                value={form.date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    date: e.target.value,
                  })
                }
              />
            </Field>

            <Field label="Entry time">
              <select
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 cursor-pointer"
                value={form.startTime}
                onChange={(e) =>
                  setForm({
                    ...form,
                    startTime:
                      e.target.value,
                  })
                }
              >
                {[
                  "9:00 AM",
                  "10:00 AM",
                  "11:00 AM",
                  "12:30 PM",
                  "2:00 PM",
                  "4:30 PM",
                  "6:30 PM",
                  "7:30 PM",
                  "8:30 PM",
                ].map((t) => (
                  <option key={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Exit time">
              <select
                className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 cursor-pointer"
                value={form.endTime}
                onChange={(e) =>
                  setForm({
                    ...form,
                    endTime:
                      e.target.value,
                  })
                }
              >
                {[
                  "10:00 AM",
                  "11:00 AM",
                  "12:30 PM",
                  "2:00 PM",
                  "4:30 PM",
                  "6:30 PM",
                  "7:30 PM",
                  "8:30 PM",
                  "9:30 PM",
                ].map((t) => (
                  <option key={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Purpose */}
          <Field label="Purpose">
            <TextInput
              placeholder="Friend visit"
              value={form.purpose}
              onChange={(e) =>
                setForm({
                  ...form,
                  purpose:
                    e.target.value,
                })
              }
            />
          </Field>

          {/* Create button */}
          <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-slate-100 bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={createPass}
              disabled={creating}
            >
              <UserPlus className="h-4 w-4" />

              {creating
                ? "Creating pass…"
                : "Create pass"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ====================================================================
          VISITOR PASS MODAL
      ==================================================================== */}

      <Modal
        open={!!passVisitor}
        onClose={() =>
          setPassVisitor(null)
        }
        title="Visitor pass"
        subtitle="Show this at the gate or share it with your guest."
        wide
      >
        {passVisitor && (
          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">

            {/* QR */}
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-3xl border border-slate-200 bg-surface p-4 shadow-soft">
                <QrCode
                  seed={
                    passVisitor.passToken ||
                    passVisitor.passCode ||
                    passVisitor.id ||
                    passVisitor.name
                  }
                  size={176}
                  className="visitor-pass-qr"
                />
              </div>

              <div className="text-center">
                <p className="font-mono text-2xl font-extrabold tracking-[0.25em] text-slate-900">
                  {passVisitor.passCode ||
                    "----"}
                </p>

                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Numeric pass code
                </p>
              </div>
            </div>

            {/* Details */}
            <div>
              <div className="flex items-center gap-4">

                {/* PHOTO */}
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100 shadow-soft">
                  {getVisitorPhoto(
                    passVisitor
                  ) ? (
                    <img
                      src={
                        getVisitorPhoto(
                          passVisitor
                        ).startsWith(
                          "/uploads/"
                        )
                          ? `${API_BASE_URL}${getVisitorPhoto(
                              passVisitor
                            )}`
                          : getVisitorPhoto(
                              passVisitor
                            )
                      }
                      alt={passVisitor.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Users className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-slate-900">
                    {passVisitor.name}
                  </p>

                  <p className="text-sm text-slate-500">
                    {passVisitor.purpose}
                  </p>
                </div>
              </div>

              {/* Info */}
              <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">

                <div>
                  <p className="text-xs text-slate-400">
                    Flat
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {passVisitor.flat ||
                      "Your flat"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Guest of
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {passVisitor.resident ||
                      "Resident"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Phone
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {passVisitor.phone ||
                      "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Date
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {getVisitorDateLabel(
                      passVisitor
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Time
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {getVisitorTime(
                      passVisitor
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Vehicle
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {passVisitor.vehicle ||
                      "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Status
                  </p>

                  <p className="mt-1 font-bold text-emerald-600">
                    {normalizeStatus(
                      passVisitor.status
                    ) === "approved"
                      ? "Approved"
                      : String(
                          passVisitor.status
                        )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Guests
                  </p>

                  <p className="mt-1 font-bold text-slate-800">
                    {passVisitor.guests ||
                      1}
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-4 flex gap-2">

                {/* Share */}
                <Button
                  className="flex-1"
                  onClick={async () => {
                    const text = `SmartSociety visitor pass for ${
                      passVisitor.name
                    }. Flat ${
                      passVisitor.flat ||
                      "your flat"
                    }. ${getVisitorDateLabel(
                      passVisitor
                    )} · ${getVisitorTime(
                      passVisitor
                    )}. Pass code: ${
                      passVisitor.passCode ||
                      "Available in app"
                    }.`;

                    const result =
                      await shareText(
                        "SmartSociety visitor pass",
                        text,
                        `https://wa.me/?text=${encodeURIComponent(
                          text
                        )}`
                      );

                    toast(
                      result === "shared"
                        ? "Pass shared successfully."
                        : result === "copied"
                          ? "Pass details copied to clipboard."
                          : result === "opened"
                            ? "WhatsApp opened with the pass details."
                            : "Sharing is not supported in this browser.",
                      result ===
                        "unsupported"
                        ? "warning"
                        : "success"
                    );
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Share pass
                </Button>

                {/* Download */}
                <Button
                  variant="secondary"
                  onClick={() => {
                    const qr =
                      document.querySelector(
                        ".visitor-pass-qr"
                      );

                    const qrMarkup =
                      qr instanceof SVGElement
                        ? qr.outerHTML
                        : "";

                    const visitorPhoto =
                      getVisitorPhoto(
                        passVisitor
                      );

                    const photoMarkup =
                      visitorPhoto
                        ? `<img src="${
                            visitorPhoto.startsWith(
                              "/uploads/"
                            )
                              ? `${API_BASE_URL}${visitorPhoto}`
                              : visitorPhoto
                          }" style="width:120px;height:120px;object-fit:cover;border-radius:16px;" />`
                        : "";

                    const html = `
                      <!doctype html>
                      <html>
                        <head>
                          <meta charset="utf-8" />
                          <title>SmartSociety Visitor Pass</title>

                          <style>
                            body {
                              font-family: Arial, sans-serif;
                              padding: 32px;
                              color: #0f172a;
                            }

                            .pass {
                              max-width: 700px;
                              margin: auto;
                              border: 1px solid #e2e8f0;
                              border-radius: 24px;
                              padding: 32px;
                            }

                            .photo {
                              margin-bottom: 20px;
                            }

                            .qr {
                              margin: 20px 0;
                            }

                            .code {
                              font-size: 28px;
                              font-weight: bold;
                              letter-spacing: 5px;
                            }

                            .row {
                              margin: 8px 0;
                            }
                          </style>
                        </head>

                        <body>
                          <div class="pass">
                            <h1>SmartSociety</h1>

                            <h2>Visitor Pass</h2>

                            <div class="photo">
                              ${photoMarkup}
                            </div>

                            <p>
                              <strong>Visitor:</strong>
                              ${passVisitor.name}
                            </p>

                            <p>
                              <strong>Phone:</strong>
                              ${passVisitor.phone || "—"}
                            </p>

                            <p>
                              <strong>Flat:</strong>
                              ${passVisitor.flat || "Your flat"}
                            </p>

                            <p>
                              <strong>Purpose:</strong>
                              ${passVisitor.purpose}
                            </p>

                            <p>
                              <strong>Date:</strong>
                              ${getVisitorDateLabel(passVisitor)}
                            </p>

                            <p>
                              <strong>Time:</strong>
                              ${getVisitorTime(passVisitor)}
                            </p>

                            <p>
                              <strong>Vehicle:</strong>
                              ${passVisitor.vehicle || "—"}
                            </p>

                            <p>
                              <strong>Status:</strong>
                              Approved
                            </p>

                            <div class="qr">
                              ${qrMarkup}
                            </div>

                            <p class="code">
                              ${
                                passVisitor.passCode ||
                                "----"
                              }
                            </p>
                          </div>
                        </body>
                      </html>
                    `;

                    downloadTextFile(
                      `visitor-pass-${
                        passVisitor.passCode ||
                        passVisitor.id
                      }.html`,
                      html,
                      "text/html;charset=utf-8"
                    );

                    toast(
                      "Visitor pass downloaded.",
                      "success"
                    );
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================================
   RE-EXPORTS
============================================================================ */

export {
  ResidentAmenities,
  ResidentCommunity,
  ResidentComplaints,
  ResidentProfile,
} from "./ResidentMore";