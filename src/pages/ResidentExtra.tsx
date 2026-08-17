import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CalendarCheck,
  CheckCheck,
  ClipboardList,
  FileText,
  Megaphone,
  Phone,
  Receipt,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useApp } from "../state/store";
import { guidelines, type ActivityItem, type NotifCategory } from "../data/mock";
import { api } from "../lib/api";
import { Badge, Button, Card, EmptyState, PageHeader, Tabs } from "../components/ui";

const NOTIF_CATS: ("All" | NotifCategory)[] = ["All", "Security", "Billing", "Complaints", "Bookings", "Community", "Emergency"];

/* ----------------------------------------------------- Notification center */
export function ResidentNotifications() {
  const { notifications, unreadCount, markAllRead, markRead } = useApp();
  const [cat, setCat] = useState<(typeof NOTIF_CATS)[number]>("All");

  const filtered = cat === "All" ? notifications : notifications.filter((n) => n.category === cat);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread · everything about your flat and society`}
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />
      <Tabs items={NOTIF_CATS.map((c) => ({ id: c, label: c }))} value={cat} onChange={setCat} />
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-7 w-7" />}
          title="No notifications here"
          message={cat === "All" ? "You're all caught up. New updates will appear here." : `No ${cat.toLowerCase()} notifications right now.`}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((n) => (
            <Card key={n.id} className={cn("p-4 transition-colors", n.unread && "border-brand-100 bg-brand-50/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", n.tone === "danger" ? "bg-rose-50 text-rose-600" : n.tone === "warning" ? "bg-amber-50 text-amber-600" : n.tone === "success" ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600")}>
                    <CatIcon cat={n.category} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{n.title}</p>
                      {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge tone={n.tone}>{n.category}</Badge>
                  <span className="text-[11px] text-slate-400">{n.time}</span>
                </div>
              </div>
              {n.unread && (
                <div className="mt-2 text-right">
                  <button onClick={() => markRead(n.id)} className="text-xs font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
                    Mark as read
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CatIcon({ cat }: { cat: NotifCategory }) {
  const map: Record<NotifCategory, React.ReactNode> = {
    Security: <ShieldCheck className="h-4.5 w-4.5" />,
    Billing: <Receipt className="h-4.5 w-4.5" />,
    Complaints: <ClipboardList className="h-4.5 w-4.5" />,
    Bookings: <CalendarCheck className="h-4.5 w-4.5" />,
    Community: <Megaphone className="h-4.5 w-4.5" />,
    Emergency: <Siren className="h-4.5 w-4.5" />,
  };
  return <>{map[cat]}</>;
}

/* --------------------------------------------------------- Activity center */
const ACT_FILTERS: ("All" | ActivityItem["category"])[] = ["All", "Visitor", "Booking", "Complaint", "Billing", "Vote"];

const actIcon: Record<ActivityItem["category"], React.ReactNode> = {
  Visitor: <Users className="h-4 w-4" />,
  Booking: <CalendarCheck className="h-4 w-4" />,
  Complaint: <ClipboardList className="h-4 w-4" />,
  Billing: <Receipt className="h-4 w-4" />,
  Vote: <FileText className="h-4 w-4" />,
};

const actTone: Record<ActivityItem["category"], string> = {
  Visitor: "bg-sky-50 text-sky-600",
  Booking: "bg-brand-50 text-brand-600",
  Complaint: "bg-amber-50 text-amber-600",
  Billing: "bg-emerald-50 text-emerald-600",
  Vote: "bg-violet-50 text-violet-600",
};

export function ResidentActivity() {
  const { complaints, bookings, visitors } = useApp();
  const [filter, setFilter] = useState<(typeof ACT_FILTERS)[number]>("All");

  const derived: ActivityItem[] = useMemo(
    () => [
      ...complaints.map((c) => ({
        id: c.id,
        category: "Complaint" as const,
        title: `${c.number} · ${c.title}`,
        detail: `${c.category} · ${c.status === "resolved" ? "resolved" : c.status === "in-progress" ? "in progress" : c.status}`,
        time: c.createdAt,
      })),
      ...bookings.map((b) => ({
        id: b.id,
        category: "Booking" as const,
        title: `${b.amenity} booked`,
        detail: `${b.date} · ${b.slot}`,
        time: "Recently",
      })),
      ...visitors
        .filter((v) => v.status === "completed" || v.status === "inside")
        .map((v) => ({
          id: v.id,
          category: "Visitor" as const,
          title: `${v.name} ${v.status === "inside" ? "is visiting" : "visited"}`,
          detail: `${v.purpose} · ${v.time}`,
          time: v.dateLabel,
        })),
    ],
    [complaints, bookings, visitors]
  );

  const all = derived;
  const list = filter === "All" ? all : all.filter((a) => a.category === filter);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" subtitle="A running record of everything you've done and received." />
      <Tabs items={ACT_FILTERS.map((f) => ({ id: f, label: f }))} value={filter} onChange={setFilter} />
      {list.length === 0 ? (
        <EmptyState icon={<Activity className="h-7 w-7" />} title="No activity yet" message="Your visitors, bookings, complaints, payments and votes will appear here." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {list.map((a) => (
            <div key={a.id} className="flex items-start gap-3.5 px-5 py-4">
              <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", actTone[a.category])}>
                {actIcon[a.category]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-500">{a.detail}</p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-slate-400">{a.time}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Emergency */
export function ResidentEmergency() {
  const { toast } = useApp();
  const [alerting, setAlerting] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(() => {
    void Promise.all([api.profile(), api.emergency()]).then(([profile, active]) => {
      setContacts(profile.emergencyContacts ?? []);
      setAlerts(active ?? []);
    }).catch(() => undefined);
  }, []);
  const raiseAlert = async () => {
    setAlerting(true);
    try { await api.createEmergency({ title: "Resident emergency alert", body: "Emergency assistance requested." }); setAlerts(await api.emergency()); toast("Emergency alert sent to the security team.", "danger"); }
    catch (e) { toast(e instanceof Error ? e.message : "Unable to send emergency alert.", "danger"); }
    finally { setAlerting(false); }
  };
  return (
    <div className="space-y-8">
      <PageHeader title="Emergency" subtitle="Real actions for urgent assistance." />
      <Card className="border-rose-200 bg-rose-50/50 p-6"><div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white"><Siren className="h-6 w-6"/></span><div className="flex-1"><p className="font-extrabold text-slate-900">Notify society security</p><p className="text-sm text-slate-500">Creates a persistent alert and notifies active guards and administrators.</p></div><Button variant="dangerSolid" onClick={raiseAlert} disabled={alerting}><Siren className="h-4 w-4"/>{alerting ? "Sending…" : "Send alert"}</Button></div></Card>
      {alerts.length > 0 && <section><h2 className="mb-3 text-base font-bold">Active alerts</h2><div className="space-y-3">{alerts.map(a=><Card key={a.id} className="border-rose-100 p-4"><p className="font-bold">{a.title}</p><p className="mt-1 text-sm text-slate-500">{a.body}</p><p className="mt-2 text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</p></Card>)}</div></section>}
      <section><h2 className="mb-3 text-base font-bold">My emergency contacts</h2>{contacts.length===0?<EmptyState title="No emergency contacts configured" message="Add emergency contacts to your profile so you can call them quickly."/>:<div className="grid gap-3 sm:grid-cols-2">{contacts.map(c=><Card key={c.id} className="flex items-center justify-between gap-3 p-5"><div><p className="font-bold">{c.label}</p><p className="text-sm text-slate-400">{c.phone}</p></div><div className="flex gap-2"><a href={`tel:${c.phone.replace(/\s/g,"")}`} className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-sm font-bold text-white"><Phone className="h-4 w-4"/>Call</a><a target="_blank" rel="noreferrer" href={`https://wa.me/${c.phone.replace(/\D/g,"")}?text=${encodeURIComponent("Hello SmartSociety, I need urgent assistance.")}`} className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700">WhatsApp</a></div></Card>)}</div>}</section>
      <section><h2 className="mb-3 text-base font-bold">Safety guidelines</h2><Card className="divide-y divide-slate-100">{guidelines.map(g=><div key={g.title} className="px-5 py-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-600"/><p className="text-sm font-bold">{g.title}</p></div><p className="mt-1 pl-6 text-sm leading-relaxed text-slate-500">{g.body}</p></div>)}</Card></section>
    </div>
  );
}
