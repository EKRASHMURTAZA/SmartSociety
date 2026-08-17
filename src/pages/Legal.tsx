import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { Eyebrow, Accordion, Button, Card } from "../components/ui";
import { helpSections } from "../data/mock";
import { LandingFooter, LandingHeader } from "../components/Layout";

/* ------------------------------------------------------- shared legal shell */
function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <LandingHeader />
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <Eyebrow>SmartSociety</Eyebrow>
        <h1 className="mt-3 text-4xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: {updated}</p>
        <div className="mt-10 space-y-8">{children}</div>
      </section>
      <LandingFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-extrabold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-500">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Privacy */
export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 2025">
      <p className="text-slate-500 leading-relaxed">
        Your privacy matters. SmartSociety is built for residential communities, and we handle personal
        information carefully and transparently. This policy explains what we collect and how we use it.
      </p>
      <Section title="What we collect">
        <p>We collect only what is needed to run your society: your name, flat number, phone number, vehicle details, household members and emergency contacts — as provided by you or your society administrator.</p>
        <p>For visitors, we store the details residents provide when creating a pass: name, phone, vehicle and the visit time. This is visible only to the resident, the security desk and the administrator.</p>
      </Section>
      <Section title="How we use it">
        <p>We use your information to process visitor passes, manage bills and payments, assign complaints, book amenities and send important notices. We never sell personal information or use it for advertising.</p>
      </Section>
      <Section title="Who can see it">
        <p>Security staff see visitor passes for the gate. Administrators see society-level data needed to run operations. Residents see only their own details and passes. Access is role-based and logged.</p>
      </Section>
      <Section title="Your choices">
        <p>You can review and correct your details from your profile at any time. You can request deletion of your visitor history by writing to the society office.</p>
      </Section>
      <Section title="Data security">
        <p>Data is encrypted in transit and at rest. Access is protected with role-based permissions, and all administrative actions are recorded in the audit log.</p>
      </Section>
      <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Lock className="h-5 w-5" /></span>
        <p className="flex-1 text-sm text-slate-500">Questions about your data? Contact us and we'll respond within one working day.</p>
        <Link to="/contact"><Button variant="secondary" size="sm">Contact us</Button></Link>
      </Card>
    </LegalShell>
  );
}

/* -------------------------------------------------------------------- Terms */
export function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 2025">
      <p className="text-slate-500 leading-relaxed">
        These terms govern your use of SmartSociety. By using the app, you agree to them.
      </p>
      <Section title="Using SmartSociety">
        <p>SmartSociety is provided to help residential communities manage visitors, billing, complaints, amenities and security. You agree to provide accurate information and to use the app responsibly.</p>
      </Section>
      <Section title="Your account">
        <p>Keep your login details private. You are responsible for activity that happens under your account. Notify your society office immediately if you believe your account has been compromised.</p>
      </Section>
      <Section title="Visitor passes">
        <p>You are responsible for passes created from your account. Please only create passes for people you genuinely expect to visit. The security desk may refuse entry if details do not match.</p>
      </Section>
      <Section title="Payments">
        <p>Bill payments are processed by regulated payment providers. Receipts are generated instantly and available in the app. Please raise any payment concerns within 30 days.</p>
      </Section>
      <Section title="Acceptable use">
        <p>Do not misuse the app, attempt to access data you are not authorised to see, or interfere with the security of the community. Violations may result in account suspension.</p>
      </Section>
      <Section title="Changes to these terms">
        <p>We may update these terms from time to time. Significant changes will be announced through the app before they take effect.</p>
      </Section>
    </LegalShell>
  );
}

/* ------------------------------------------------------ Security & privacy */
export function SecurityPrivacyPage() {
  const points = [
    { title: "Role-based access", desc: "Residents, guards, admins and maintenance staff see only what their role needs." },
    { title: "Encryption", desc: "All data is encrypted in transit and at rest, including gate activity and payments." },
    { title: "Audit trail", desc: "Every entry approval, payment and administrative action is recorded and reviewable." },
    { title: "Visitor privacy", desc: "Visitor details are shared only with the host resident, the gate and the administrator." },
    { title: "Emergency handling", desc: "Emergency alerts reach the security desk and administrator instantly, with clear escalation." },
    { title: "You control your data", desc: "Review and correct your details anytime from your profile." },
  ];
  return (
    <div className="min-h-screen bg-surface">
      <LandingHeader />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Security & Privacy</Eyebrow>
          <h1 className="mt-3 text-4xl font-extrabold">Your community, protected</h1>
          <p className="mt-4 text-lg text-slate-500">
            SmartSociety treats the safety of residents and their data as the same problem — and solves both.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((p) => (
            <Card key={p.title} className="p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><ShieldCheck className="h-5 w-5" /></span>
              <h3 className="mt-4 text-lg font-extrabold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{p.desc}</p>
            </Card>
          ))}
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
          <Link to="/privacy">
            <Card className="flex items-center justify-between p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift cursor-pointer">
              <div>
                <p className="font-extrabold">Read our Privacy Policy</p>
                <p className="mt-1 text-sm text-slate-500">What we collect and how we use it.</p>
              </div>
              <ArrowRight className="h-5 w-5 text-brand-600" />
            </Card>
          </Link>
          <Link to="/terms">
            <Card className="flex items-center justify-between p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift cursor-pointer">
              <div>
                <p className="font-extrabold">Read our Terms of Service</p>
                <p className="mt-1 text-sm text-slate-500">The rules for using SmartSociety.</p>
              </div>
              <ArrowRight className="h-5 w-5 text-brand-600" />
            </Card>
          </Link>
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}

/* ---------------------------------------------------------------------- FAQ */
export function FaqPage() {
  const totalQ = helpSections.reduce((s, h) => s + h.qa.length, 0);
  return (
    <div className="min-h-screen bg-surface">
      <LandingHeader />
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h1 className="mt-3 text-4xl font-extrabold">Frequently asked questions</h1>
          <p className="mt-4 text-lg text-slate-500">{totalQ} quick answers for residents, guards and administrators.</p>
        </div>
        <div className="mt-10 space-y-8">
          {helpSections.map((s) => (
            <section key={s.category}>
              <h2 className="mb-3 text-lg font-extrabold">{s.category}</h2>
              <Accordion items={s.qa} />
            </section>
          ))}
        </div>
        <Card className="mt-10 flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Mail className="h-5 w-5" /></span>
          <p className="flex-1 text-sm text-slate-500">Can't find your answer? Our support team is happy to help.</p>
          <Link to="/contact"><Button size="sm">Contact support</Button></Link>
        </Card>
      </section>
      <LandingFooter />
    </div>
  );
}
