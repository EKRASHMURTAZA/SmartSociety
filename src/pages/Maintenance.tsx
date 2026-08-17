import { useMemo, useState } from "react";
import { CheckCircle2, Clock, MapPin, PlayCircle, Wrench } from "lucide-react";
import { useApp } from "../state/store";
import { Avatar, Badge, Button, Card, EmptyState, Modal, PageHeader, SectionTitle, Tabs } from "../components/ui";
import { ProfileEditor } from "../components/ProfileEditor";

const meta: Record<string, { label: string; tone: "warning" | "info" | "success" }> = {
  submitted: { label: "Assigned", tone: "warning" as const },
  "in-progress": { label: "In Progress", tone: "info" as const },
  resolved: { label: "Resolved", tone: "success" as const },
};

function imageUrl(src?: string | null) {
  if (!src) return "";
  return src.startsWith("/uploads/") ? `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ?? "http://localhost:4000"}${src}` : src;
}

export function MaintenanceTasks() {
  const { complaints, setComplaintStatus, toast, profiles, user } = useApp();
  const [tab, setTab] = useState<"mine" | "priority" | "progress" | "done">("mine");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const mine = useMemo(
    () => complaints.filter(c => c.status !== "resolved" && c.assignedTo === user?.name),
    [complaints, user]
  );
  const list = useMemo(() => {
    if (tab === "mine") return mine;
    if (tab === "priority") return mine.filter(c => c.priority === "high");
    if (tab === "progress") return complaints.filter(c => c.status === "in-progress");
    return complaints.filter(c => c.status === "resolved");
  }, [complaints, mine, tab]);

  const counts = {
    mine: mine.length,
    priority: mine.filter(c => c.priority === "high").length,
    progress: complaints.filter(c => c.status === "in-progress").length,
    done: complaints.filter(c => c.status === "resolved").length,
  };
  const detail = complaints.find(c => c.id === detailId) ?? null;

  const changeStatus = async (id: string, status: "in-progress" | "resolved") => {
    setBusy(id);
    try {
      await setComplaintStatus(id, status);
      toast(status === "resolved" ? "Complaint resolved and resident notified." : "Work marked in progress.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to update complaint.", "danger");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Avatar src={profiles.maintenance.avatar} alt={profiles.maintenance.name} size="lg" ring />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Maintenance workspace</p>
          <h1 className="mt-0.5 text-2xl font-extrabold sm:text-3xl">Hello, {profiles.maintenance.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-slate-500">{counts.mine} assigned complaints need attention.</p>
        </div>
      </div>

      <Tabs items={[
        { id: "mine", label: "Assigned to me", count: counts.mine },
        { id: "priority", label: "High priority", count: counts.priority },
        { id: "progress", label: "In progress", count: counts.progress },
        { id: "done", label: "Completed", count: counts.done },
      ]} value={tab} onChange={setTab} />

      {list.length === 0 ? <EmptyState title="Nothing here" message="New complaints assigned to you will appear here from the live server." /> :
        <div className="space-y-3">{list.map(c => {
          const m = meta[c.status];
          return <Card key={c.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">{c.number}</Badge><Badge tone={m.tone}>{m.label}</Badge></div>
                <p className="mt-2 font-bold text-slate-900">{c.title}</p>
                <p className="mt-1 text-sm text-slate-500">{c.description}</p>
                <p className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate-400"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5"/> {c.category}</span><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5"/> {c.createdAt}</span></p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setDetailId(c.id)}>Details</Button>
                {c.status === "submitted" && <Button size="sm" onClick={() => void changeStatus(c.id, "in-progress")} disabled={busy === c.id}><PlayCircle className="h-4 w-4"/> Start</Button>}
                {c.status === "in-progress" && <Button size="sm" variant="success" onClick={() => void changeStatus(c.id, "resolved")} disabled={busy === c.id}><CheckCircle2 className="h-4 w-4"/> Resolve</Button>}
              </div>
            </div>
          </Card>;
        })}</div>
      }

      <section><SectionTitle>Live workload</SectionTitle><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Open", counts.mine, Wrench], ["High priority", counts.priority, Clock], ["In progress", counts.progress, PlayCircle], ["Completed", counts.done, CheckCircle2]
        ].map(([label, value, Icon]: any) => <Card key={label} className="p-4 text-center"><Icon className="mx-auto h-5 w-5 text-slate-600"/><p className="mt-2 text-2xl font-extrabold">{value}</p><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p></Card>)}
      </div></section>

      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail?.number ?? ""} subtitle={detail?.title ?? ""} wide>
        {detail && <div className="space-y-5">
          <div className="flex flex-wrap gap-2"><Badge tone={meta[detail.status].tone}>{meta[detail.status].label}</Badge><Badge tone="neutral">{detail.category}</Badge></div>
          <Card className="p-4"><p className="text-sm leading-relaxed text-slate-600">{detail.description}</p></Card>
          {detail.photo && <img src={imageUrl(detail.photo)} alt="Complaint attachment" className="max-h-72 w-full rounded-2xl object-cover"/>}
          <div className="flex flex-wrap gap-3">
            {detail.status === "submitted" && <Button className="flex-1" onClick={() => void changeStatus(detail.id, "in-progress")} disabled={busy === detail.id}><PlayCircle className="h-4 w-4"/> Start work</Button>}
            {detail.status === "in-progress" && <Button variant="success" className="flex-1" onClick={() => void changeStatus(detail.id, "resolved")} disabled={busy === detail.id}><CheckCircle2 className="h-4 w-4"/> Mark resolved</Button>}
          </div>
        </div>}
      </Modal>
    </div>
  );
}

export function MaintenanceProfile() {
  const { role, profiles } = useApp();
  const [editOpen, setEditOpen] = useState(false);
  const p = profiles[role];
  return <div className="space-y-6">
    <PageHeader title="My Profile" subtitle="Your live account details and assigned work area." />
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card className="flex flex-col items-center p-8 text-center"><Avatar src={p.avatar} alt={p.name} size="2xl" ring/><h2 className="mt-4 text-xl font-extrabold">{p.name}</h2><p className="text-sm text-slate-500">{p.title}</p><p className="mt-1 text-xs text-slate-400">{p.society}</p><Button variant="secondary" className="mt-5" onClick={() => setEditOpen(true)}><Wrench className="h-4 w-4"/> Edit profile</Button></Card>
      <Card className="p-6"><SectionTitle>Work information</SectionTitle><div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">{p.fields.map(f => <div key={f.label} className="flex items-center justify-between gap-4 border-b border-slate-50 pb-2.5"><span className="text-sm text-slate-400">{f.label}</span><span className="text-sm font-bold text-slate-800">{f.value}</span></div>)}</div></Card>
    </div><ProfileEditor role={role} open={editOpen} onClose={() => setEditOpen(false)}/>
  </div>;
}
