import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Receipt,
  AlertTriangle,
  Check,
  Eye,
  Filter,
  UserPlus,
  Building2,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  Download,
  FileText,
  Banknote,
  Megaphone,
  Plus,
  Search,
  ShieldAlert,
  Siren,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useApp } from "../state/store";
import {
  reports,
  type ComplaintStatus,
} from "../data/mock";
import { Avatar, Badge, Button, Card, EmptyState, Field, HBarChart, Modal, PageHeader, SectionTitle, Tabs, TextArea, TextInput } from "../components/ui";
import { ProfileEditor } from "../components/ProfileEditor";
import { downloadTextFile, toCsv } from "../utils/actions";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";
import { formatCurrency } from "../lib/format";

const statIcons = [Building2, Users, Banknote, ClipboardList, Users, ShieldAlert];
const statTones = ["bg-brand-50 text-brand-600", "bg-sky-50 text-sky-600", "bg-amber-50 text-amber-600", "bg-rose-50 text-rose-600", "bg-emerald-50 text-emerald-600", "bg-violet-50 text-violet-600"];

const complaintStatusMeta: Record<ComplaintStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  submitted: { label: "Submitted", tone: "info" },
  assigned: { label: "Assigned", tone: "warning" },
  "in-progress": { label: "In Progress", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
};

/* -------------------------------------------------------------- Overview */
export function AdminOverview() {
  const { complaints, visitors, toast } = useApp();
  const [live, setLive] = useState<any | null>(null);
  const [billing, setBilling] = useState<any | null>(null);
  const [gateLogs, setGateLogs] = useState<any[]>([]);

  const pendingComplaints = useMemo(() => complaints.filter((c) => c.status !== "resolved"), [complaints]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayVisitors = useMemo(() => visitors.filter((v) => v.dateISO === todayISO), [visitors, todayISO]);
  const insideCount = useMemo(() => visitors.filter((v) => v.status === "inside").length, [visitors]);

  useEffect(() => {
    void api.adminOverview().then(setLive).catch(() => undefined);
    void api.adminBilling().then(setBilling).catch(() => undefined);
    void api.gateLogs().then(setGateLogs).catch(() => undefined);
  }, [complaints.length, visitors.length]);

  const liveStats = live
    ? [
        { label: "Units", value: String(live.units), hint: "Registered units" },
        { label: "Residents", value: String(live.residents), hint: "Active resident accounts" },
        { label: "Outstanding dues", value: formatCurrency(live.outstandingDues), hint: "Current open bills" },
        { label: "Open complaints", value: String(live.openComplaints), hint: "Need attention" },
        { label: "Visitors today", value: String(live.visitorsToday), hint: "Scheduled/recorded" },
        { label: "Inside society", value: String(live.visitorsInside), hint: "Currently inside" },
      ]
    : [
        { label: "Units", value: "—", hint: "Registered units" },
        { label: "Residents", value: "—", hint: "Active resident accounts" },
        { label: "Outstanding dues", value: "—", hint: "Current open bills" },
        { label: "Open complaints", value: String(pendingComplaints.length), hint: "Need attention" },
        { label: "Visitors today", value: String(todayVisitors.length), hint: "Scheduled/recorded" },
        { label: "Inside society", value: String(insideCount), hint: "Currently inside" },
      ];

  const stats = liveStats.map((s, i) => ({
    ...s,
    icon: statIcons[i],
    tone: statTones[i],
  }));

  const downloadReport = () => {
    const rows = [
      ["Metric", "Value"],
      ...stats.map((s) => [s.label, s.value]),
      ["Open complaints", String(pendingComplaints.length)],
      ["Visitors today", String(todayVisitors.length)],
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `smartsociety-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);

    toast("Report downloaded", "success");
  };

  const complaintByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    complaints.forEach((c) => {
      counts[c.category] = (counts[c.category] ?? 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, value: count }));
  }, [complaints]);

  const hourly = useMemo(() => {
    const counts = new Array(8).fill(0);
    gateLogs.forEach((log) => {
      const d = new Date(log.entryAt ?? log.createdAt);
      if (Number.isNaN(d.getTime())) return;
      counts[Math.floor(d.getHours() / 3)] += 1;
    });
    const max = Math.max(...counts, 1);
    return counts
      .map((v, i) => ({ label: `${String(i * 3).padStart(2, "0")}:00`, v }))
      .filter((x) => x.v > 0)
      .map((x) => ({ ...x, pct: (x.v / max) * 100 }));
  }, [gateLogs]);

  const securityAlerts = useMemo(() => {
    const list: { id: string; title: string; detail: string; tone: "danger" | "warning" }[] = [];
    gateLogs
      .filter((log) => log.result === "REJECTED")
      .forEach((log) => {
        list.push({
          id: `rej-${log.id}`,
          title: `Pass rejected — ${log.visitor?.name ?? "Visitor"}`,
          detail: `Verification failed · ${new Date(log.createdAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}`,
          tone: "danger",
        });
      });
    gateLogs
      .filter((log) => log.result === "ALLOWED" && log.verification !== "EXIT")
      .forEach((log) => {
        const hasExit = gateLogs.some(
          (exit) => exit.visitorId === log.visitorId && exit.verification === "EXIT" && new Date(exit.exitAt) > new Date(log.entryAt)
        );
        if (hasExit) return;
        const minutes = Math.round((Date.now() - new Date(log.entryAt).getTime()) / 60000);
        if (minutes > 120) {
          list.push({
            id: `over-${log.id}`,
            title: `Overstay — ${log.visitor?.name ?? "Visitor"}`,
            detail: `Inside ${Math.floor(minutes / 60)}h ${minutes % 60}m · entered ${new Date(log.entryAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}`,
            tone: "warning",
          });
        }
      });
    return list.slice(0, 3);
  }, [gateLogs]);

  const currentMonth = billing?.months?.at(-1);
  const currentCollectedPct =
    currentMonth && currentMonth.total > 0 ? Math.round((currentMonth.collected / currentMonth.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Society Overview"
        subtitle="Maple Heights · live society data"
        actions={
          <Button size="sm" variant="secondary" onClick={downloadReport}>
            <FileText className="h-4 w-4" /> Download report
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", s.tone)}>
              <s.icon className="h-4.5 w-4.5" />
            </span>
            <p className="mt-3 text-xl font-extrabold text-slate-900">{s.value}</p>
            <p className="text-[11px] font-semibold text-slate-400">{s.label}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{s.hint}</p>
          </Card>
        ))}
      </div>

      {/* Row: recent activity + billing */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle action={<Badge tone="brand">Live</Badge>}>Recent activity</SectionTitle>
          <div className="space-y-1">
            {[...visitors.slice(0, 5).map(v => ({ title: `${v.name} · Visitor`, detail: `${v.status} · ${v.dateLabel}`, time: v.dateLabel, tone: "info" })), ...complaints.slice(0, 5).map(c => ({ title: `${c.number} · Complaint`, detail: `${c.title} · ${c.status}`, time: c.createdAt, tone: "warning" }))].slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                    a.tone === "success" ? "bg-emerald-50 text-emerald-600" : a.tone === "warning" ? "bg-amber-50 text-amber-600" : a.tone === "info" ? "bg-sky-50 text-sky-600" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {a.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">{a.title}</p>
                  <p className="text-xs text-slate-400">{a.detail}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-slate-400">{a.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <SectionTitle action={billing ? <Badge tone="warning">{formatCurrency(billing.outstanding)} pending</Badge> : undefined}>
              Billing collection
            </SectionTitle>
            {billing?.months?.length ? (
              <HBarChart data={billing.months.map((b: any) => ({ label: b.period, value: b.collected }))} format={(v) => `Rs. ${(v / 100000).toFixed(1)}L`} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">No billing data available yet.</p>
            )}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">Current period collection</p>
              <p className="text-sm font-extrabold text-slate-900">
                {currentMonth ? `${formatCurrency(currentMonth.collected)} of ${formatCurrency(currentMonth.total)}` : "—"}
                {currentMonth && <span className="font-semibold text-slate-400"> · {currentCollectedPct}%</span>}
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle action={<Badge tone="danger">{pendingComplaints.length} open</Badge>}>Complaints by category</SectionTitle>
            {complaintByCategory.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No complaints yet.</p>
            ) : (
              <HBarChart data={complaintByCategory} format={(v) => String(v)} />
            )}
          </Card>
        </div>
      </div>

      {/* Row: gate + attention */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle action={<Badge tone="brand">{todayVisitors.length} today</Badge>}>Gate activity · entries by time</SectionTitle>
          <div className="flex h-36 items-end gap-2">
            {hourly.length === 0 ? (
              <p className="w-full self-center text-center text-sm text-slate-400">No gate logs recorded yet.</p>
            ) : (
              hourly.map((g) => (
                <div key={g.label} className="group flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">{g.v}</span>
                  <div
                    className="w-full rounded-t-lg bg-brand-500/85 transition-all group-hover:bg-brand-600"
                    style={{ height: `${g.pct}%` }}
                  />
                  <span className="text-[9px] font-semibold text-slate-400">{g.label}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle action={securityAlerts.length > 0 ? <Badge tone="danger">{securityAlerts.length} alert{securityAlerts.length > 1 ? "s" : ""}</Badge> : <Badge tone="success">All clear</Badge>}>
            Security attention
          </SectionTitle>
          <div className="space-y-3">
            {securityAlerts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No overstays or rejected passes right now.</p>
            ) : (
              securityAlerts.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: a.tone === "danger" ? "var(--color-rose-200)" : "var(--color-amber-200)", backgroundColor: a.tone === "danger" ? "var(--color-rose-50)" : "var(--color-amber-50)" }}>
                  {a.tone === "danger" ? (
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Billing */
export function AdminBilling() {
  const { toast } = useApp();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [cycle, setCycle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ count: number; period: string } | null>(null);
  const [billing, setBilling] = useState<any | null>(null);

  const loadBilling = useCallback(() => {
    void api.adminBilling().then(setBilling).catch(() => undefined);
  }, []);
  useEffect(loadBilling, [loadBilling]);

  const pendingUnits = useMemo(
    () =>
      ((billing?.pendingUnits ?? []) as any[]).map((u: any) => ({
        billId: u.billId,
        flat: u.flat ? `${u.flat.tower}-${u.flat.number}` : "—",
        owner: u.resident ?? "Unknown",
        amount: formatCurrency(u.amountDue),
        days: Math.max(0, Math.ceil((Date.now() - new Date(u.dueDate).getTime()) / (24 * 60 * 60 * 1000))),
        overdue: u.dueDate ? new Date(u.dueDate).getTime() < Date.now() : false,
      })),
    [billing]
  );

  const generateBills = async () => {
    const period = cycle.trim();
    if (period.length < 3) {
      toast("Enter a billing cycle, e.g. September 2026.", "warning");
      return;
    }
    setGenerating(true);
    try {
      const result = await api.adminGenerateBills({ period });
      setGenerated({ count: result.count, period });
      setGenerateOpen(false);
      await loadBilling();
      toast(`${result.period} bills generated for ${result.count} units`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to generate bills", "danger");
    } finally {
      setGenerating(false);
    }
  };

  const currentMonth = billing?.months?.at(-1);
  const currentPct =
    currentMonth && currentMonth.total > 0 ? Math.round((currentMonth.collected / currentMonth.total) * 100) : 0;
  const collectedL = billing ? (Number(billing.collected) / 100000).toFixed(1) : "0";
  const outstandingL = billing ? (Number(billing.outstanding) / 100000).toFixed(2) : "0";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        subtitle="Collection status across the society."
        actions={
          <Button onClick={() => setGenerateOpen(true)}>
            <Plus className="h-4 w-4" /> Generate monthly bills
          </Button>
        }
      />

      {generated && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <Check className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Monthly billing cycle generated</p>
            <p className="mt-0.5 text-emerald-700">{generated.period} · bills created for {generated.count} occupied units.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400">Collected · all time</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">Rs. {collectedL}L</p>
          <Badge tone="success" className="mt-2">Recorded payments</Badge>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400">Pending</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">Rs. {outstandingL}L</p>
          <Badge tone="warning" className="mt-2">{billing?.pendingUnits?.length ?? 0} units</Badge>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400">Billed units</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{billing?.units ?? "—"}</p>
          <Badge tone="neutral" className="mt-2">{billing?.totalBills ?? 0} bills issued</Badge>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>Collection by period</SectionTitle>
          {billing?.months?.length ? (
            <HBarChart data={billing.months.map((b: any) => ({ label: b.period, value: b.collected }))} format={(v) => `Rs. ${(v / 100000).toFixed(1)}L`} />
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">No billing periods recorded yet.</p>
          )}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-500">Current period collection</p>
            <p className="text-sm font-extrabold text-slate-900">
              {currentMonth ? `${formatCurrency(currentMonth.collected)} of ${formatCurrency(currentMonth.total)}` : "—"}
              {currentMonth && <span className="font-semibold text-slate-400"> · {currentPct}%</span>}
            </p>
          </div>
        </Card>
        <Card className="p-6">
          <SectionTitle>Units with pending dues</SectionTitle>
          {pendingUnits.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">All bills are paid. No pending dues.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {pendingUnits.map((u) => (
                <div key={u.billId} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{u.flat} · {u.owner}</p>
                    <p className="text-xs text-slate-400">
                      {u.amount} · {u.overdue ? `overdue ${u.days} day${u.days === 1 ? "" : "s"}` : `due in ${u.days} day${u.days === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const message = `SmartSociety maintenance reminder: ${u.flat} has ${u.amount} outstanding (${u.overdue ? `overdue by ${u.days} days` : `due in ${u.days} days`}).`;
                      if (!navigator.clipboard?.writeText) {
                        toast("Clipboard access is unavailable in this browser.", "warning");
                        return;
                      }
                      void navigator.clipboard.writeText(message).then(
                        () => toast(`Reminder text copied for ${u.flat}`, "success"),
                        () => toast("Clipboard access was denied.", "warning")
                      );
                    }}
                  >Copy reminder</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate monthly bills" subtitle="Create the next maintenance billing cycle for all occupied units.">
        <div className="space-y-4">
          <Field label="Billing cycle">
            <TextInput value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="e.g. September 2026" />
          </Field>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Bills are created for every occupied unit with the standard maintenance charges, due 20 days after generation.
          </div>
          <Button size="lg" className="w-full" onClick={() => void generateBills()} disabled={generating}>
            <Receipt className="h-4 w-4" /> {generating ? "Generating…" : "Generate bills"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------- Complaints */
export function AdminComplaints() {
  const { complaints, toast, hydrate } = useApp();
  const [tab, setTab] = useState<"open" | "all">("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [targetStatus, setTargetStatus] = useState<ComplaintStatus>("assigned");
  const list = tab === "open" ? complaints.filter((c) => c.status !== "resolved") : complaints;
  const selected = complaints.find((c) => c.id === selectedId) ?? null;
  useEffect(() => { void api.adminStaff().then(setStaff).catch(() => undefined); }, []);
  usePoll(() => void api.adminStaff().then(setStaff).catch(() => undefined), 45000);

  const saveAssignment = async () => {
    if (!selected || !assignee) { toast("Select a maintenance staff member.", "warning"); return; }
    try {
      await api.updateComplaint(selected.id, { staffId: assignee, status: targetStatus === "assigned" ? "IN_PROGRESS" : targetStatus === "resolved" ? "RESOLVED" : "PENDING" });
      await hydrate();
      toast(`${selected.number} updated successfully.`, "success");
      setSelectedId(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Unable to update complaint.", "danger"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Complaints" subtitle="Track every issue until it's resolved." />
      <Tabs items={[{ id: "open", label: "Open" }, { id: "all", label: "All" }]} value={tab} onChange={setTab} className="max-w-xs" />
      <div className="space-y-3">
        {list.length === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-400">No open complaints. Great job!</Card>
        ) : (
          list.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{c.category}</Badge>
                    <span className="text-xs text-slate-400">{c.number} · {c.createdAt}{c.flat ? ` · Flat ${c.flat}` : ""}</span>
                  </div>
                  <p className="mt-2 font-bold text-slate-900">{c.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{c.description}</p>
                  <p className="mt-1.5 text-xs font-semibold text-brand-700">{c.assignedTo ? `Assigned to ${c.assignedTo}` : "Unassigned"}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {c.status === "resolved" ? "Marked resolved" : c.status === "in-progress" ? "In progress" : c.status === "assigned" ? "Assigned to maintenance" : "Awaiting assignment"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={complaintStatusMeta[c.status].tone}>{complaintStatusMeta[c.status].label}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => setSelectedId(c.id)}>
                    {c.status === "resolved" ? <Eye className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                    {c.status === "resolved" ? "View" : "Assign / update"}
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `Complaint ${selected.number}` : "Complaint"} subtitle={selected ? selected.title : undefined}>
        {selected && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Issue description</p>
              <p className="mt-1 leading-relaxed">{selected.description}</p>
            </div>
            {selected.photo && (
              <img src={selected.photo} alt="Complaint attachment" className="max-h-60 w-full rounded-2xl object-cover" />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Assign to">
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-400">
                  <option value="">Select maintenance staff</option>
                  {staff.map((member: any) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value as ComplaintStatus)} className="w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-400">
                  <option value="assigned">Assigned</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </Field>
            </div>
            <Button size="lg" className="w-full" onClick={saveAssignment}>
              <CheckCircle2 className="h-4 w-4" /> Save assignment
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------------- Gate */
const photoUrl = (src: string) =>
  src?.startsWith("/uploads/")
    ? `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ?? "http://localhost:4000"}${src}`
    : src;

export function AdminGate() {
  const { visitors, toast, gateAction } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "inside" | "approved" | "pending">("all");
  const [gateLogs, setGateLogs] = useState<any[]>([]);

  useEffect(() => {
    void api.gateLogs().then(setGateLogs).catch(() => undefined);
  }, []);

  usePoll(() => void api.gateLogs().then(setGateLogs).catch(() => undefined), 45000);

  const todayISO = new Date().toISOString().slice(0, 10);
  const today = visitors.filter((v) => v.dateISO === todayISO);
  const filtered = today.filter((v) => {
    const matchesQuery = `${v.name} ${v.flat} ${v.vehicle} ${v.passCode}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "all" || v.status === status;
    return matchesQuery && matchesStatus;
  });

  const hourly = useMemo(() => {
    const counts = new Array(8).fill(0);
    gateLogs.forEach((log) => {
      const d = new Date(log.entryAt ?? log.createdAt);
      if (Number.isNaN(d.getTime())) return;
      counts[Math.floor(d.getHours() / 3)] += 1;
    });
    const max = Math.max(...counts, 1);
    return counts
      .map((v, i) => ({ label: `${String(i * 3).padStart(2, "0")}:00`, v }))
      .filter((x) => x.v > 0)
      .map((x) => ({ ...x, pct: (x.v / max) * 100 }));
  }, [gateLogs]);

  const markExit = async (id: string, name: string) => {
    try {
      await gateAction(id, "exit");
      toast(`${name} marked as exited`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to log exit.", "danger");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Gate Activity" subtitle="A live view of entries across all gates." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs font-semibold text-slate-400">Visitors today</p><p className="mt-1 text-2xl font-extrabold">{today.length}</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold text-slate-400">Currently inside</p><p className="mt-1 text-2xl font-extrabold">{visitors.filter((v) => v.status === "inside").length}</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold text-slate-400">Pending check-in</p><p className="mt-1 text-2xl font-extrabold">{visitors.filter((v) => v.status === "approved" || v.status === "pending").length}</p></Card>
      </div>

      <Card className="p-6">
        <SectionTitle action={<Badge tone="brand">{filtered.length} shown</Badge>}>Entries by time</SectionTitle>
        <div className="flex h-40 items-end gap-2">
          {hourly.length === 0 ? (
            <p className="w-full self-center text-center text-sm text-slate-400">No gate logs recorded yet.</p>
          ) : (
            hourly.map((g) => (
              <div key={g.label} className="group flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">{g.v}</span>
                <div className="w-full rounded-t-lg bg-brand-500/85 transition-all group-hover:bg-brand-600" style={{ height: `${g.pct}%` }} />
                <span className="text-[9px] font-semibold text-slate-400">{g.label}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <SectionTitle className="mb-0">Today's passes</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search visitor, flat or code" className="pl-10" />
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              <Filter className="ml-1 h-3.5 w-3.5 text-slate-400" />
              {(["all", "inside", "approved", "pending"] as const).map((s) => (
                <button key={s} onClick={() => setStatus(s)} className={cn("rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize cursor-pointer", status === s ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500")}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-7 w-7" />} title="No visitors found" message="Try a different visitor, flat number or status filter." />
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-4 px-6 py-3.5">
                {v.photo ? (
                  <img src={photoUrl(v.photo)} alt={v.name} className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 font-bold text-brand-700">
                    {v.name?.slice(0, 1) ?? "?"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">{v.name} <span className="font-medium text-slate-400">· Flat {v.flat}</span></p>
                  <p className="text-xs text-slate-400">{v.time} · {v.vehicle} · pass {v.passCode}</p>
                </div>
                <Badge tone={v.status === "inside" ? "info" : v.status === "approved" ? "success" : v.status === "pending" ? "warning" : "neutral"}>
                  {v.status === "inside" ? "Inside" : v.status === "approved" ? "Pass ready" : v.status === "pending" ? "Pending" : v.status}
                </Badge>
                {v.status === "inside" && <Button size="sm" variant="secondary" onClick={() => void markExit(v.id, v.name)}>Mark exit</Button>}
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-slate-100 px-6 py-4">
          <Button size="sm" variant="secondary" onClick={() => {
            const rows = [
              ["Visitor", "Flat", "Vehicle", "Status", "Date", "Time", "Pass Code"],
              ...filtered.map((v) => [v.name, v.flat, v.vehicle, v.status, v.dateLabel, v.time, v.passCode]),
            ];
            downloadTextFile(`smartsociety-gate-log-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv;charset=utf-8");
            toast("Gate log exported", "success");
          }}>
            <FileText className="h-3.5 w-3.5" /> Export gate log
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- Residents */
export function AdminResidents() {
  const { toast } = useApp();
  const [view, setView] = useState<"residents" | "units">("residents");
  const [query, setQuery] = useState("");
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", flat: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setRows(await api.adminResidents()); }
    catch (e) { toast(e instanceof Error ? e.message : "Unable to load residents.", "danger"); }
  };
  useEffect(() => { void load(); }, []);
  usePoll(() => void load(), 45000);

  const filtered = rows.filter(r => `${r.name} ${r.flat?.tower ?? ""}-${r.flat?.number ?? ""} ${r.phone}`.toLowerCase().includes(query.toLowerCase()));
  const occupied = new Set(rows.map(r => r.flatId).filter(Boolean)).size;

  const onboard = async () => {
    if (!form.name.trim() || !form.flat.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      const result = await api.adminCreateResident(form);
      await load();
      setOnboardOpen(false);
      setForm({ name: "", flat: "", phone: "", email: "" });
      toast(`Resident created. Temporary password: ${result.temporaryPassword}`, "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Unable to create resident.", "danger"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Residents & Units" subtitle={`${occupied} occupied units represented by live resident records.`} actions={<Button onClick={() => setOnboardOpen(true)}><UserPlus className="h-4 w-4"/> Onboard resident</Button>} />
      <Tabs items={[{ id: "residents", label: "Residents" }, { id: "units", label: "Live occupancy" }]} value={view} onChange={setView} className="max-w-md" />
      {view === "residents" ? <>
        <div className="relative min-w-0 sm:max-w-md"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><TextInput className="pl-10" placeholder="Search name, flat or phone…" value={query} onChange={e => setQuery(e.target.value)}/></div>
        {filtered.length === 0 ? <EmptyState icon={<Search className="h-7 w-7"/>} title="No residents found" message="Resident records are loaded directly from the database."/> :
          <Card className="overflow-hidden"><div className="hidden grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 sm:grid"><span>Resident</span><span>Flat</span><span>Status</span><span>Phone</span></div>
            <div className="divide-y divide-slate-50">{filtered.map(r => <button key={r.id} type="button" onClick={() => setSelected(r)} className="grid w-full grid-cols-2 gap-3 px-5 py-3.5 text-left sm:grid-cols-[1.4fr_1fr_1fr_1.2fr] sm:items-center sm:gap-4 sm:px-6 hover:bg-slate-50">
              <div className="flex items-center gap-3"><Avatar src={r.avatarUrl} alt={r.name} size="sm"/><div className="min-w-0"><p className="truncate font-bold text-slate-900">{r.name}</p><p className="text-xs text-slate-400">{r.vehicles?.length ?? 0} vehicle(s)</p></div></div>
              <p className="font-semibold text-slate-700">{r.flat ? `${r.flat.tower}-${r.flat.number}` : "Unassigned"}</p><Badge tone={r.isActive ? "success" : "warning"}>{r.isActive ? "Active" : "Inactive"}</Badge><p className="text-slate-500">{r.phone}</p>
            </button>)}</div>
          </Card>}
      </> : <Card className="p-6"><SectionTitle>Live occupancy</SectionTitle><div className="grid gap-3 sm:grid-cols-3">{Object.entries(rows.reduce((acc: Record<string, number>, r) => { const tower=r.flat?.tower ?? "Unassigned"; acc[tower]=(acc[tower]??0)+1; return acc; }, {})).map(([tower,count]) => <div key={tower} className="rounded-2xl bg-slate-50 p-5"><p className="font-extrabold">{tower}</p><p className="mt-1 text-2xl font-extrabold">{count}</p><p className="text-xs text-slate-400">resident records</p></div>)}</div></Card>}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? "Resident details"} subtitle={selected?.flat ? `${selected.flat.tower}-${selected.flat.number}` : undefined}>
        {selected && <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><Card className="p-4"><p className="text-xs text-slate-400">Phone</p><p className="mt-1 font-bold">{selected.phone}</p></Card><Card className="p-4"><p className="text-xs text-slate-400">Email</p><p className="mt-1 break-all font-bold">{selected.email ?? "—"}</p></Card><Card className="p-4"><p className="text-xs text-slate-400">Vehicles</p><p className="mt-1 font-bold">{selected.vehicles?.length ?? 0}</p></Card><Card className="p-4"><p className="text-xs text-slate-400">Household</p><p className="mt-1 font-bold">{selected.householdMembers?.length ?? 0}</p></Card></div><Button variant="secondary" className="w-full" onClick={() => setSelected(null)}>Close</Button></div>}
      </Modal>

      <Modal open={onboardOpen} onClose={() => setOnboardOpen(false)} title="Onboard resident" subtitle="Create a real resident account linked to a society flat.">
        <div className="space-y-4">
          <Field label="Full name"><TextInput value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></Field>
          <Field label="Flat / unit"><TextInput value={form.flat} onChange={e => setForm({...form,flat:e.target.value})} placeholder="A-1204"/></Field>
          <Field label="Phone"><TextInput value={form.phone} onChange={e => setForm({...form,phone:e.target.value})}/></Field>
          <Field label="Email (optional)"><TextInput type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/></Field>
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-100 bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"><Button size="lg" className="w-full" onClick={() => void onboard()} disabled={saving || !form.name.trim() || !form.flat.trim() || !form.phone.trim()}>{saving ? "Creating…" : "Create resident record"}</Button></div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ Staff */
export function AdminStaff() {
  const { toast } = useApp();
  const [staff, setStaff] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", role: "GUARD" as "GUARD" | "MAINTENANCE" });
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const load = useCallback(() => {
    void api.adminStaff().then(setStaff).catch(e => toast(e instanceof Error ? e.message : "Unable to load staff.", "danger"));
  }, [toast]);
  useEffect(load, [load]);

  const createStaff = async () => {
    if (!form.name.trim() || form.phone.replace(/\D/g, "").length < 10) {
      toast("Enter a name and a valid phone number.", "warning");
      return;
    }
    setSaving(true);
    try {
      const result = await api.adminCreateStaff({ name: form.name.trim(), phone: form.phone.trim(), role: form.role });
      setTempPassword(result.temporaryPassword);
      await load();
      setForm({ name: "", phone: "", role: "GUARD" });
      toast(`${result.staff.name} added to staff`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to create staff.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const groups = [
    { label: "Security", icon: ShieldAlert, members: staff.filter(s => s.role === "GUARD") },
    { label: "Maintenance", icon: Wrench, members: staff.filter(s => s.role === "MAINTENANCE") },
  ];

  return <div className="space-y-8">
    <PageHeader title="Staff" subtitle="Live staff accounts from the society database." actions={<Button onClick={() => { setTempPassword(null); setCreateOpen(true); }}><UserPlus className="h-4 w-4"/> Add staff</Button>} />
    {groups.map(g => <section key={g.label}><SectionTitle>{g.label}</SectionTitle><Card className="divide-y divide-slate-50">
      {g.members.length === 0 ? <div className="p-6 text-sm text-slate-400">No staff records found.</div> : g.members.map(m => <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3"><Avatar src={m.avatarUrl} alt={m.name} size="sm"/><div className="min-w-0"><p className="font-bold text-slate-900">{m.name}</p><p className="text-xs text-slate-400">{m.role.toLowerCase()} · {m.phone} {m.flat ? `· ${m.flat.tower}-${m.flat.number}` : ""}</p></div></div>
        <Badge tone={m.isActive ? "success" : "neutral"}>{m.isActive ? "Active" : "Inactive"}</Badge>
      </div>)}
    </Card></section>)}

    <Modal open={createOpen} onClose={() => { setCreateOpen(false); setTempPassword(null); }} title={tempPassword ? "Staff account created" : "Add staff member"} subtitle={tempPassword ? "Share the temporary password with the new staff member." : "Create a real guard or maintenance account."}>
      {tempPassword ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center py-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-7 w-7" />
            </span>
            <h3 className="mt-3 text-lg font-extrabold text-slate-900">Temporary password</h3>
            <p className="mt-1 font-mono text-2xl font-extrabold tracking-widest text-brand-700">{tempPassword}</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">
              The staff member signs in with their phone number and this password, then changes it in their profile.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={() => { setCreateOpen(false); setTempPassword(null); }}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Full name">
            <TextInput placeholder="e.g. Ravi Deshmukh" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput placeholder="+92 3XX XXXXXXX" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Role">
            <div className="grid grid-cols-2 gap-2">
              {(["GUARD", "MAINTENANCE"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm({ ...form, role })}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                    form.role === role ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {role === "GUARD" ? "Security guard" : "Maintenance"}
                </button>
              ))}
            </div>
          </Field>
          <Button size="lg" className="w-full" onClick={() => void createStaff()} disabled={saving}>
            <UserPlus className="h-4 w-4" /> {saving ? "Creating…" : "Create staff account"}
          </Button>
        </div>
      )}
    </Modal>
  </div>;
}

export function AdminNotices() {
  const { notices, addNotice, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", tag: "Update" as "Important" | "Update" | "Event", emergency: false });

  const publish = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast("Please add a title and message", "warning");
      return;
    }
    try {
      await addNotice({
        id: "",
        title: form.title.trim(),
        body: form.body.trim(),
        date: "Today",
        tag: form.emergency ? "Important" : form.tag,
        emergency: form.emergency,
      });
      toast(form.emergency ? "Emergency notice published" : "Notice published");
      setOpen(false);
      setForm({ title: "", body: "", tag: "Update", emergency: false });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to publish notice.", "danger");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notices"
        subtitle="Keep residents informed — and alert everyone instantly in an emergency."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New notice</Button>}
      />
      {notices.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-7 w-7" />} title="No notices yet" message="Publish your first notice to reach every resident." />
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <Card key={n.id} className={cn("flex items-start gap-4 p-5", n.emergency && "border-rose-200 bg-rose-50/40")}>
              <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", n.emergency ? "bg-rose-100 text-rose-600" : "bg-brand-50 text-brand-600")}>
                {n.emergency ? <Siren className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={n.emergency ? "danger" : n.tag === "Important" ? "warning" : n.tag === "Event" ? "brand" : "info"}>
                    {n.emergency ? "Emergency" : n.tag}
                  </Badge>
                  <span className="text-xs text-slate-400">{n.date}</span>
                </div>
                <p className="mt-1.5 font-bold text-slate-900">{n.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New notice" subtitle="Publish to all residents at Maple Heights.">
        <div className="space-y-4">
          <Field label="Title">
            <TextInput placeholder="e.g. Water supply shutdown — Aug 22" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Message">
            <TextArea placeholder="Details residents should know…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <Field label="Category">
            <div className="flex gap-1.5">
              {(["Update", "Important", "Event"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, tag: t, emergency: false })}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                    form.tag === t && !form.emergency ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <button
            onClick={() => setForm({ ...form, emergency: !form.emergency })}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all cursor-pointer",
              form.emergency ? "border-rose-300 bg-rose-50" : "border-slate-200 hover:border-slate-300"
            )}
          >
            <Siren className={cn("h-5 w-5", form.emergency ? "text-rose-600" : "text-slate-400")} />
            <span className="flex-1">
              <span className="block text-sm font-bold text-slate-900">Mark as emergency</span>
              <span className="block text-xs text-slate-500">Highlights the notice and sends an urgent alert.</span>
            </span>
            <span className={cn("relative h-6 w-11 rounded-full transition-colors", form.emergency ? "bg-rose-500" : "bg-slate-200")}>
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all", form.emergency ? "left-[22px]" : "left-0.5")} />
            </span>
          </button>
          <Button size="lg" className="w-full" onClick={publish}>
            <Megaphone className="h-4 w-4" /> {form.emergency ? "Send emergency notice" : "Publish notice"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------- Reports */
export function AdminReports() {
  const { visitors, complaints, bookings, toast } = useApp();

  const generateReport = (title: string) => {
    const rows: Array<Array<string | number>> = [["SmartSociety report", title], ["Generated", new Date().toLocaleString()]];

    if (title.toLowerCase().includes("visitor")) {
      rows.push(["Visitor", "Flat", "Status", "Date", "Time"]);
      visitors.forEach((v) => rows.push([v.name, v.flat, v.status, v.dateLabel, v.time]));
    } else if (title.toLowerCase().includes("complaint")) {
      rows.push(["Complaint", "Category", "Status", "Assigned To", "Created"]);
      complaints.forEach((c) => rows.push([c.number, c.category, c.status, c.assignedTo ?? "Unassigned", c.createdAt]));
    } else if (title.toLowerCase().includes("booking")) {
      rows.push(["Amenity", "Date", "Slot", "Status"]);
      bookings.forEach((b) => rows.push([b.amenity, b.date, b.slot, b.status]));
    } else {
      rows.push(["Open complaints", complaints.filter((c) => c.status !== "resolved").length]);
      rows.push(["Visitors", visitors.length]);
      rows.push(["Bookings", bookings.length]);
    }

    downloadTextFile(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, toCsv(rows), "text/csv;charset=utf-8");
    toast(`${title} downloaded`, "success");
  };
  return (
    <div className="space-y-8">
      <PageHeader title="Reports" subtitle="Generate and download summaries for the committee." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.id} className="flex flex-col p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <FileText className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-extrabold text-slate-900">{r.title}</h3>
            <p className="mt-1.5 flex-1 text-sm text-slate-500">{r.desc}</p>
            <div className="mt-4 flex items-center justify-between">
              <Badge tone="neutral">{r.tag}</Badge>
              <Button size="sm" variant="secondary" onClick={() => generateReport(r.title)}>
                <Download className="h-3.5 w-3.5" /> Generate
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <SectionTitle action={<Badge tone="brand">Audit trail</Badge>}>Recent activity</SectionTitle>
        <div className="space-y-1">
          {[...visitors.slice(0, 5).map(v => ({ title: `${v.name} · Visitor`, detail: `${v.status} · ${v.dateLabel}`, time: v.dateLabel, tone: "info" })), ...complaints.slice(0, 5).map(c => ({ title: `${c.number} · Complaint`, detail: `${c.title} · ${c.status}`, time: c.createdAt, tone: "warning" }))].slice(0, 6).map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl px-2 py-2.5">
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                  a.tone === "success" ? "bg-emerald-50 text-emerald-600" : a.tone === "warning" ? "bg-amber-50 text-amber-600" : a.tone === "info" ? "bg-sky-50 text-sky-600" : "bg-slate-100 text-slate-500"
                )}
              >
                {a.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400">{a.detail}</p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-slate-400">{a.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- Profile */
export function AdminProfile() {
  const { role, profiles } = useApp();
  const [editOpen, setEditOpen] = useState(false);
  const p = profiles[role];
  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" subtitle="Administrator account details." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="flex flex-col items-center p-8 text-center">
          <Avatar src={p.avatar} alt={p.name} size="2xl" ring />
          <h2 className="mt-4 text-xl font-extrabold">{p.name}</h2>
          <p className="text-sm text-slate-500">{p.title}</p>
          <p className="mt-1 text-xs text-slate-400">{p.society}</p>
          <Button variant="secondary" className="mt-5" onClick={() => setEditOpen(true)}>
            <DoorOpen className="h-4 w-4" /> Edit profile
          </Button>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <SectionTitle>Administrator information</SectionTitle>
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