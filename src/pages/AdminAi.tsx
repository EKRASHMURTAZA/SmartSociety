import { useEffect, useRef, useState } from "react";
import { Bot, FileUp, Plus, Search, Trash2, Pencil, BookOpenCheck } from "lucide-react";
import { useApp } from "../state/store";
import { api } from "../lib/api";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle, TextArea, TextInput } from "../components/ui";
import { formatDate } from "../lib/format";

interface Article {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  source?: string | null;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  version: number;
  createdAt: string;
  updatedAt: string;
  author?: { name: string } | null;
}

const emptyForm = { title: "", category: "Society Rules", content: "", tags: "", source: "", status: "PUBLISHED" };

export function AdminAi() {
  const { toast } = useApp();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (q?: string) => {
    setLoading(true);
    setError("");
    try {
      const rows = await api.knowledgeList(q);
      setArticles(rows as Article[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load knowledge base.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (a: Article) => {
    setEditingId(a.id);
    setForm({ title: a.title, category: a.category, content: a.content, tags: a.tags.join(", "), source: a.source ?? "", status: a.status });
    setEditorOpen(true);
  };

  const save = async () => {
    if (form.title.trim().length < 2 || form.content.trim().length < 10) {
      toast("Title and content (min 10 characters) are required.", "warning");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.knowledgeUpdate(editingId, form);
        toast("Knowledge article updated.", "success");
      } else {
        await api.knowledgeCreate(form);
        toast("Knowledge article published.", "success");
      }
      setEditorOpen(false);
      await load(search);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to save knowledge article.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Article) => {
    if (!window.confirm(`Delete "${a.title}" from the knowledge base? The chatbot will stop using it.`)) return;
    try {
      await api.knowledgeRemove(a.id);
      toast("Knowledge article deleted.", "success");
      await load(search);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to delete article.", "danger");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await api.knowledgeUpload(file, "Imported");
      toast(`Imported "${file.name}". The chatbot can now answer from it.`, "success");
      await load(search);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed.", "danger");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const statusTone = (s: string) => (s === "PUBLISHED" ? "success" : s === "DRAFT" ? "warning" : "neutral") as "success" | "warning" | "neutral";

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI & Knowledge Base"
        subtitle="Train SOCIETY AI — every published article is used to answer resident questions."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <FileUp className="h-4 w-4" /> {uploading ? "Importing…" : "Upload document"}
            </Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add knowledge</Button>
            <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.docx" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
        }
      />

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle action={<Badge tone="brand">{articles.length} articles</Badge>}>Knowledge articles</SectionTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <TextInput
              className="pl-9"
              placeholder="Search knowledge…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(search);
              }}
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 py-6">
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : error ? (
          <EmptyState icon={<Bot className="h-7 w-7" />} title="Unable to load knowledge base" message={error} action={<Button variant="secondary" onClick={() => void load(search)}>Retry</Button>} />
        ) : articles.length === 0 ? (
          <EmptyState
            icon={<BookOpenCheck className="h-7 w-7" />}
            title={search ? "No articles match your search" : "Knowledge base is empty"}
            message={search ? "Try a different search term." : "Add your first FAQ, rule or document so SOCIETY AI can answer residents."}
            action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add knowledge</Button>}
          />
        ) : (
          <div className="mt-4 space-y-3">
            {articles.map((a) => (
              <div key={a.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-slate-900">{a.title}</p>
                    <Badge tone="neutral">{a.category}</Badge>
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    {a.version > 1 && <Badge tone="info">v{a.version}</Badge>}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{a.content}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Updated {formatDate(a.updatedAt)} · {a.author?.name ?? "admin"}
                    {a.source && ` · ${a.source}`}
                    {a.tags.length > 0 && ` · ${a.tags.slice(0, 4).map((t) => `#${t}`).join(" ")}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editingId ? "Edit knowledge article" : "Add knowledge article"} subtitle="Published articles are immediately available to SOCIETY AI.">
        <div className="space-y-4">
          <Field label="Title">
            <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Quiet hours" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Society Rules" />
            </Field>
            <Field label="Tags" hint="Comma separated">
              <TextInput value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="rules, noise" />
            </Field>
          </div>
          <Field label="Source" hint="Document, circular or policy this answer is based on">
            <TextInput value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Management Committee Handbook, Rev. 2024" />
          </Field>
          <Field label="Content" hint="Min 10 characters">
            <TextArea rows={7} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write the verified answer the chatbot can use…" />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full min-h-11 rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
            >
              <option value="PUBLISHED">Published — available to the chatbot</option>
              <option value="DRAFT">Draft — hidden from the chatbot</option>
              <option value="UNPUBLISHED">Unpublished — hidden from the chatbot</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save article"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}