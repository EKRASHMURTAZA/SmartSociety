import { useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  DoorOpen,
  LifeBuoy,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
Receipt,
  Search,
  Send,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "../utils/cn";
import { AVATARS, contactInfo, helpSections, IMG } from "../data/mock";
import { Accordion, Badge, Button, Card, Eyebrow, Field, ImgWithFallback, TextArea, TextInput } from "../components/ui";
import { LandingFooter, LandingHeader } from "../components/Layout";

/* ---------------------------------------------------------- How it works */
const roleSteps: {
  role: string;
  avatar: string;
  intro: string;
  steps: { icon: ComponentType<{ className?: string }>; title: string; desc: string }[];
}[] = [
  {
    role: "For Residents",
    avatar: AVATARS.resident,
    intro: "Everything you need from your society, without the queues.",
    steps: [
      { icon: Users, title: "Create a request", desc: "Visitor pass, bill payment, complaint or booking — in a few taps." },
      { icon: ClipboardList, title: "Track it live", desc: "Every request shows its current status, clearly." },
      { icon: BellIcon, title: "Get notified", desc: "Updates arrive as quiet notifications — never missed calls." },
      { icon: CheckCircle2, title: "Receive the result", desc: "The visitor arrives, the issue is fixed, the slot is yours." },
    ],
  },
  {
    role: "For Security",
    avatar: AVATARS.guard,
    intro: "Verify anyone at the gate in under 30 seconds.",
    steps: [
      { icon: ScanSvg, title: "Scan the QR", desc: "Or type the 4-digit code from the pass." },
      { icon: ShieldCheck, title: "See full details", desc: "Photo, flat, host, vehicle and visit time — all at once." },
      { icon: DoorOpen, title: "Allow or reject", desc: "One tap. The resident is notified either way." },
      { icon: ClipboardList, title: "Log kept automatically", desc: "Every entry is recorded for the admin report." },
    ],
  },
  {
    role: "For Administrators",
    avatar: AVATARS.admin,
    intro: "Run the whole society from one calm dashboard.",
    steps: [
      { icon: Building2, title: "See the overview", desc: "Units, dues, complaints, visitors and alerts at a glance." },
      { icon: ClipboardList, title: "Assign work", desc: "Send complaints to the right staff member instantly." },
      { icon: Receipt, title: "Track billing", desc: "Who paid, who hasn't, and what to follow up on." },
      { icon: CheckCircle2, title: "Review reports", desc: "Monthly summaries without spreadsheet work." },
    ],
  },
  {
    role: "For Maintenance",
    avatar: AVATARS.maintenance,
    intro: "A clear list of jobs, sorted by what matters.",
    steps: [
      { icon: Wrench, title: "Receive the ticket", desc: "Complaints arrive assigned, with the flat and issue." },
      { icon: Clock, title: "Check priority & SLA", desc: "High-priority jobs always float to the top." },
      { icon: DoorOpen, title: "Do the work", desc: "Start and complete with one tap at the door." },
      { icon: CheckCircle2, title: "Resident notified", desc: "The moment you mark it done, they know." },
    ],
  },
];

function ScanSvg({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11.5 11.5h3v3h-3zM16 14.5h1.5V16H16zM14.5 16H16v1.5h-1.5z" fill="currentColor" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v3.2l-1.2 2.4a.8.8 0 0 0 .7 1.15h10a.8.8 0 0 0 .7-1.15l-1.2-2.4V7a4.5 4.5 0 0 0-4.5-4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 16a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-surface">
      <LandingHeader />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-3 text-4xl font-extrabold">Simple for every role</h1>
          <p className="mt-4 text-lg text-slate-500">
            Four ways to use SmartSociety — each one designed around the person doing the work.
          </p>
        </div>
        <div className="mt-16 space-y-10">
          {roleSteps.map((r, idx) => (
            <Card key={r.role} className="overflow-hidden">
              <div className="grid lg:grid-cols-[320px_1fr]">
                <div className={cn("flex flex-col items-center justify-center gap-4 p-8 text-center lg:p-10", idx % 2 === 0 ? "bg-brand-50/70" : "bg-slate-50")}>
                  <ImgWithFallback src={r.avatar} alt={r.role} className="h-28 w-28 rounded-[2rem] object-cover shadow-soft ring-4 ring-white" />
                  <div>
                    <p className="text-xl font-extrabold text-slate-900">{r.role}</p>
                    <p className="mt-1 text-sm text-slate-500">{r.intro}</p>
                  </div>
                </div>
                <div className="grid gap-4 p-8 sm:grid-cols-2 lg:p-10">
                  {r.steps.map((s, i) => (
                    <div key={s.title} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-600 shadow-soft ring-1 ring-slate-100">
                          <s.icon className="h-4.5 w-4.5" />
                        </span>
                        {i < r.steps.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-extrabold text-slate-900">
                          <span className="mr-1.5 text-brand-500">{i + 1}.</span> {s.title}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link to="/login">
            <Button size="xl">Try it yourself <ArrowRight className="h-5 w-5" /></Button>
          </Link>
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}

/* ---------------------------------------------------------------- About */
export function AboutPage() {
  return (
    <div className="min-h-screen bg-surface">
      <LandingHeader />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>About SmartSociety</Eyebrow>
          <h1 className="mt-3 text-4xl font-extrabold">Built for communities that care</h1>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[2rem] shadow-lift">
            <ImgWithFallback src={IMG.buildingGlass} alt="Modern residential building" className="aspect-[4/3] w-full object-cover" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">What is SmartSociety?</h2>
            <p className="mt-4 leading-relaxed text-slate-500">
              SmartSociety is a single platform for apartment communities — visitor management, maintenance billing,
              complaints, amenity bookings and gate security. One login for residents, one dashboard for administrators,
              one screen for the security desk.
            </p>
            <p className="mt-4 leading-relaxed text-slate-500">
              It exists because running a society today means chasing WhatsApp messages, paper registers and phone
              calls. We believe the people who keep communities running deserve better tools — tools that feel as calm
              as the gardens they maintain.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "No training needed — every screen explains itself",
                "Works on phones, tablets and desktops",
                "Built with security and privacy first",
              ].map((t) => (
                <p key={t} className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-500" /> {t}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { img: AVATARS.resident, title: "For residents", desc: "One place for bills, visitors, complaints and bookings — with zero friction." },
            { img: AVATARS.guard, title: "For security", desc: "Verify passes in seconds and keep a perfect record of every entry." },
            { img: AVATARS.admin, title: "For administrators", desc: "See the whole society at a glance and act before small issues grow." },
            { img: AVATARS.maintenance, title: "For maintenance", desc: "A prioritized list of work, so nothing important gets forgotten." },
          ].map((c) => (
            <Card key={c.title} className="p-6">
              <ImgWithFallback src={c.img} alt={c.title} className="h-16 w-16 rounded-2xl object-cover shadow-soft ring-4 ring-slate-50" />
              <h3 className="mt-4 text-lg font-extrabold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{c.desc}</p>
            </Card>
          ))}
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold">How it improves security</h2>
            <p className="mt-4 leading-relaxed text-slate-500">
              Every visitor is verified against a pass created by the resident they're visiting — with photo, vehicle
              and flat details. Guards see exactly what they need, and every entry is logged automatically.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["QR verification", "Digital gate log", "Instant alerts", "Resident notified on entry"].map((t) => (
                <Badge key={t} tone="brand" className="px-3 py-1">{t}</Badge>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] shadow-lift">
            <ImgWithFallback src={IMG.security} alt="Security guard at a building entrance" className="aspect-[4/3] w-full object-cover" />
          </div>
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}

/* --------------------------------------------------------------- Contact */
export function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  return (
    <div className="min-h-screen bg-surface">
      <LandingHeader />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-3 text-4xl font-extrabold">We're here to help</h1>
          <p className="mt-4 text-lg text-slate-500">Questions, feedback or a local request — write to us.</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card className="p-7 sm:p-8">
            {sent ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <h2 className="mt-4 text-xl font-extrabold">Message sent</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Thank you, {form.name || "friend"}. We usually reply within one working day.
                </p>
                <Button variant="secondary" className="mt-6" onClick={() => setSent(false)}>Send another</Button>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name">
                    <TextInput required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <TextInput required type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </Field>
                </div>
                <Field label="Subject">
                  <TextInput required placeholder="What is this about?" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </Field>
                <Field label="Message">
                  <TextArea required placeholder="Tell us more…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </Field>
                <Button size="lg" className="w-full sm:w-auto">
                  <Send className="h-4 w-4" /> Send message
                </Button>
              </form>
            )}
          </Card>

          <div className="space-y-4">
            {[
              { icon: MapPin, title: "Society Office", lines: [contactInfo.office, contactInfo.officeHours] },
              { icon: Phone, title: "Emergency Contact", lines: [contactInfo.emergency, "Security desk · 24 × 7"] },
              { icon: Mail, title: "Support", lines: [contactInfo.support, contactInfo.phone] },
            ].map((c) => (
              <Card key={c.title} className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <p className="font-extrabold text-slate-900">{c.title}</p>
                </div>
                {c.lines.map((l, i) => (
                  <p key={i} className="mt-2.5 text-sm leading-relaxed text-slate-500">{l}</p>
                ))}
              </Card>
            ))}
          </div>
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}

/* ------------------------------------------------------------ Help center */
export function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query.trim()) return helpSections;
    const q = query.toLowerCase();
    return helpSections
      .map((s) => ({ ...s, qa: s.qa.filter((x) => x.q.toLowerCase().includes(q) || x.a.toLowerCase().includes(q)) }))
      .filter((s) => s.qa.length > 0);
  }, [query]);

  const totalQ = helpSections.reduce((s, h) => s + h.qa.length, 0);

  return (
    <div className="min-h-screen bg-surface">
      <LandingHeader />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Help center</Eyebrow>
          <h1 className="mt-3 text-4xl font-extrabold">How can we help?</h1>
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for help — e.g. visitor pass, bill, complaint…"
              className="w-full rounded-2xl border border-slate-200 bg-surface py-4 pl-12 pr-4 text-sm shadow-soft outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-8">
          {filtered.length === 0 ? (
            <Card className="p-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Search className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-extrabold">No results for "{query}"</h2>
              <p className="mt-1 text-sm text-slate-500">Try different words, or reach out to support below.</p>
              <Button variant="secondary" className="mt-5" onClick={() => setQuery("")}>Clear search</Button>
            </Card>
          ) : (
            filtered.map((s) => (
              <section key={s.category}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <LifeBuoy className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-extrabold">{s.category}</h2>
                  <span className="text-xs font-semibold text-slate-400">· {s.qa.length} questions</span>
                </div>
                <Accordion items={s.qa} />
              </section>
            ))
          )}
        </div>

        <Card className="mx-auto mt-12 flex max-w-3xl flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <MessageSquare className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">Still stuck?</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {totalQ} answers are a start, but humans are better. Write to us — we reply within a day.
            </p>
          </div>
          <Link to="/contact">
            <Button><Mail className="h-4 w-4" /> Contact support</Button>
          </Link>
        </Card>
      </section>
      <LandingFooter />
    </div>
  );
}
