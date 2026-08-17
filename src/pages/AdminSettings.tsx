import { useEffect, useState } from "react";
import { Plus, Save, Trash2, Pencil } from "lucide-react";
import { useApp } from "../state/store";
import { api } from "../lib/api";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle, TextArea, TextInput } from "../components/ui";

interface EmergencyContact {
  id: string;
  label: string;
  phone: string;
  description: string | null;
  enabled: boolean;
  sortOrder: number;
}

const QUIET_RE = /^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:–|-)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i;

const emptyContact = { label: "", phone: "", description: "", enabled: true, sortOrder: 10 };

export function AdminSettings() {
  const { toast } = useApp();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [quietStart, setQuietStart] = useState("23:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyContact);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, e] = await Promise.all([api.adminSettings(), api.societyEmergency()]);
      setSettings(s);
      setContacts(e as unknown as EmergencyContact[]);
      const qh = (s.SOCIETY_QUIET_HOURS ?? "").match(QUIET_RE);
      if (qh) {
        setQuietStart(qh[1]);
        setQuietEnd(qh[2]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load society settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const set = (key: string, value: string) => setSettings((s) => (s ? ({ ...s, [key]: value } as Record<string, string>) : s));

  const saveSettings = async () => {
    if (!settings) return;
    const quiet = `${quietStart} – ${quietEnd}`;
    const dirty: Record<string, string> = { ...settings, SOCIETY_QUIET_HOURS: quiet };
    const keys = ["SOCIETY_NAME", "SOCIETY_CITY", "SOCIETY_COUNTRY", "SOCIETY_CURRENCY", "SOCIETY_TIMEZONE", "SOCIETY_ADDRESS", "SOCIETY_QUIET_HOURS", "SOCIETY_EMERGENCY_DESK"];
    const changes = keys.map((k) => ({ key: k, value: dirty[k] ?? "" })).filter((c) => c.value.trim());
    setSavingSettings(true);
    try {
      const updated = await api.adminUpdateSettings(changes);
      setSettings(updated);
      toast("Society settings saved.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to save settings.", "danger");
    } finally {
      setSavingSettings(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyContact);
    setEditorOpen(true);
  };

  const openEdit = (c: EmergencyContact) => {
    setEditingId(c.id);
    setForm({ label: c.label, phone: c.phone, description: c.description ?? "", enabled: c.enabled, sortOrder: c.sortOrder });
    setEditorOpen(true);
  };

  const saveContact = async () => {
    if (!form.label.trim() || !form.phone.trim()) {
      toast("Label and phone number are required.", "warning");
      return;
    }
    setSavingContact(true);
    try {
      if (editingId) {
        await api.adminEmergencyUpdate(editingId, form);
        toast("Emergency contact updated.", "success");
      } else {
        await api.adminEmergencyCreate(form);
        toast("Emergency contact added.", "success");
      }
      setEditorOpen(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to save contact.", "danger");
    } finally {
      setSavingContact(false);
    }
  };

  const removeContact = async (c: EmergencyContact) => {
    if (!window.confirm(`Remove "${c.label}" from emergency contacts?`)) return;
    try {
      await api.adminEmergencyRemove(c.id);
      toast("Emergency contact removed.", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to remove contact.", "danger");
    }
  };

  const inputCls = "min-h-11 w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Society Settings" subtitle="Society profile and emergency contacts." />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Society Settings" subtitle="Society profile and emergency contacts." />
        <EmptyState icon={<Save className="h-7 w-7" />} title="Unable to load settings" message={error} action={<Button variant="secondary" onClick={() => void load()}>Retry</Button>} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Society Settings" subtitle="Society profile and emergency contacts." />

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <SectionTitle>Society profile</SectionTitle>
          <Button size="sm" onClick={() => void saveSettings()} disabled={savingSettings}><Save className="h-3.5 w-3.5" /> {savingSettings ? "Saving…" : "Save settings"}</Button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Society name">
            <TextInput value={settings.SOCIETY_NAME ?? ""} onChange={(e) => set("SOCIETY_NAME", e.target.value)} placeholder="Maple Heights Housing Society" />
          </Field>
          <Field label="Address">
            <TextInput value={settings.SOCIETY_ADDRESS ?? ""} onChange={(e) => set("SOCIETY_ADDRESS", e.target.value)} placeholder="48-B Gulberg III, Lahore" />
          </Field>
          <Field label="City">
            <TextInput value={settings.SOCIETY_CITY ?? ""} onChange={(e) => set("SOCIETY_CITY", e.target.value)} placeholder="Lahore" />
          </Field>
          <Field label="Country">
            <TextInput value={settings.SOCIETY_COUNTRY ?? ""} onChange={(e) => set("SOCIETY_COUNTRY", e.target.value)} placeholder="Pakistan" />
          </Field>
          <Field label="Currency">
            <select value={settings.SOCIETY_CURRENCY ?? "PKR"} onChange={(e) => set("SOCIETY_CURRENCY", e.target.value)} className={inputCls}>
              <option value="PKR">PKR — Pakistani Rupee</option>
              <option value="USD">USD</option>
              <option value="AED">AED</option>
            </select>
          </Field>
          <Field label="Timezone">
            <select value={settings.SOCIETY_TIMEZONE ?? "Asia/Karachi"} onChange={(e) => set("SOCIETY_TIMEZONE", e.target.value)} className={inputCls}>
              <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <Field label="Quiet hours start">
            <TextInput value={quietStart} onChange={(e) => setQuietStart(e.target.value)} placeholder="23:00" />
          </Field>
          <Field label="Quiet hours end">
            <TextInput value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} placeholder="08:00" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Emergency desk number" hint="Shown to residents and used by SOCIETY AI">
              <TextInput value={settings.SOCIETY_EMERGENCY_DESK ?? ""} onChange={(e) => set("SOCIETY_EMERGENCY_DESK", e.target.value)} placeholder="042-111-222-333" />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <SectionTitle action={<Badge tone="brand">{contacts.length} contacts</Badge>}>Emergency contacts</SectionTitle>
          <Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add contact</Button>
        </div>
        <p className="mt-1 text-sm text-slate-500">Shown to residents in the Emergency page and used by SOCIETY AI.</p>
        <div className="mt-4 space-y-2.5">
          {contacts.length === 0 ? (
            <EmptyState icon={<Plus className="h-7 w-7" />} title="No emergency contacts" message="Add the local police, rescue, fire and utility numbers for this society." />
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-slate-900">{c.label}</p>
                    {!c.enabled && <Badge tone="warning">inactive</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm font-bold text-brand-700">{c.phone}</p>
                  {c.description && <p className="mt-0.5 truncate text-xs text-slate-400">{c.description}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="danger" onClick={() => void removeContact(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editingId ? "Edit emergency contact" : "Add emergency contact"} subtitle="These numbers appear in the resident Emergency page.">
        <div className="space-y-4">
          <Field label="Label">
            <TextInput value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Rescue 1122" />
          </Field>
          <Field label="Phone number">
            <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="1122" />
          </Field>
          <Field label="Sort order" hint="Lower numbers appear first">
            <TextInput type="number" value={String(form.sortOrder)} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          </Field>
          <Field label="Description" hint="Optional">
            <TextArea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Punjab emergency helpline" />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
            Active (visible to residents)
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveContact()} disabled={savingContact}>{savingContact ? "Saving…" : "Save contact"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}