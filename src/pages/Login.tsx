import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Smartphone, ShieldCheck, Eye, EyeOff, UserRound, Mail } from "lucide-react";
import { useApp } from "../state/store";
import { AVATARS, IMG } from "../data/mock";
import { Avatar, Badge, Button, Field, ImgWithFallback, TextInput } from "../components/ui";
import { LogoMark } from "../components/Layout";
import { api } from "../lib/api";

const IS_DEV = import.meta.env.DEV;

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-slate-200/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-lg font-extrabold text-slate-900">SmartSociety</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Back to website
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-md justify-center px-4 py-12 sm:px-8">
        <div className="w-full animate-slide-up">{children}</div>
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <TextInput
        className="pl-11 pr-11"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ForgotView({ onBack, onSent }: { onBack: () => void; onSent: (token?: string) => void }) {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState("");

  const send = async () => {
    if (value.replace(/\D/g, "").length < 10) return;
    setLoading(true);
    try {
      const result = await api.forgotPassword(value);
      setSent(true);
      setDevToken(result.devToken ?? "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="rounded-3xl border border-slate-200 bg-surface p-6 shadow-soft sm:p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <KeyRound className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Account recovery</p>
            <h1 className="mt-0.5 text-2xl font-extrabold">Reset your password</h1>
          </div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-slate-500">
          Enter the phone number linked to your account. In production, the reset token would be delivered by a verified recovery channel.
        </p>

        {!sent ? (
          <div className="mt-7 space-y-4">
            <Field label="Phone number">
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <TextInput className="pl-11" value={value} onChange={(e) => setValue(e.target.value)} placeholder="+92 3XX XXXXXXX" />
              </div>
            </Field>
            <Button size="lg" className="w-full" onClick={send} disabled={loading || value.replace(/\D/g, "").length < 10}>
              {loading ? "Creating reset request…" : "Create reset request"}
            </Button>
            <button type="button" onClick={onBack} className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-800">
              Back to login
            </button>
          </div>
        ) : (
          <div className="mt-7 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Reset request created.</span>
            </div>
            {devToken ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Development reset token</p>
                <p className="mt-2 break-all font-mono text-xs text-amber-900">{devToken}</p>
                <p className="mt-2 text-xs text-amber-800">This token is shown only in development builds.</p>
              </div>
            ) : null}
            <Button size="lg" className="w-full" onClick={() => onSent(devToken || undefined)}>
              Continue to reset
            </Button>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function ResetView({ token: initialToken, onDone }: { token?: string; onDone: () => void }) {
  const [token, setToken] = useState(initialToken ?? "");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const canSubmit = token.length > 20 && pw.length >= 8 && pw === confirm;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await api.resetPassword(token, pw);
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="rounded-3xl border border-slate-200 bg-surface p-6 shadow-soft sm:p-8">
        {done ? (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">Password updated</h1>
            <p className="mt-2 text-sm text-slate-500">You can now sign in with your new password.</p>
            <Button size="lg" className="mt-6 w-full" onClick={onDone}>Back to login</Button>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Secure reset</p>
            <h1 className="mt-1 text-2xl font-extrabold">Choose a new password</h1>
            <div className="mt-7 space-y-4">
              <Field label="Reset token">
                <TextInput value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the reset token" />
              </Field>
              <Field label="New password" hint="At least 8 characters">
                <PasswordInput value={pw} onChange={setPw} placeholder="Create a strong password" />
              </Field>
              <Field label="Confirm password">
                <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat your password" />
              </Field>
              {confirm && pw !== confirm && <p className="text-xs font-semibold text-rose-600">Passwords do not match.</p>}
              <Button size="lg" className="w-full" onClick={submit} disabled={!canSubmit || loading}>
                {loading ? "Updating password…" : "Update password"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}

type StaffRole = "resident" | "guard" | "maintenance";

export function Register() {
  const navigate = useNavigate();
  const { user, authLoading, toast } = useApp();
  const [form, setForm] = useState({ name: "", email: "", phone: "", flat: "", staffId: "", password: "", confirm: "" });
  const [role, setRole] = useState<StaffRole>("resident");
  const [loading, setLoading] = useState(false);
  const [flats, setFlats] = useState<{ id: string; tower: string; number: string; occupancy: string }[]>([]);
  const [flatsLoading, setFlatsLoading] = useState(true);
  const [flatsError, setFlatsError] = useState("");
  const valid = form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) &&
    form.phone.replace(/\D/g, "").length >= 10 &&
    (role !== "resident" || form.flat.trim().length >= 2) &&
    (role === "resident" || form.staffId.trim().length >= 2) &&
    form.password.length >= 8 && form.password === form.confirm;

  useEffect(() => { if (!authLoading && user) navigate("/app", { replace: true }); }, [authLoading, user, navigate]);

  useEffect(() => {
    let mounted = true;
    api.flats()
      .then((rows) => { if (mounted) setFlats(rows); })
      .catch(() => { if (mounted) setFlatsError("Unable to load society flats. Please try again."); })
      .finally(() => { if (mounted) setFlatsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const towers = [...new Set(flats.map((f) => f.tower))].sort();
  const flatOptions = form.flat ? flats.filter((f) => f.tower === form.flat.split("-")[0]) : flats;

  const submit = async () => {
    if (!valid) { toast("Please complete all fields correctly.", "warning"); return; }
    setLoading(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      role,
    };
    if (role === "resident") {
      payload.flat = form.flat;
    } else {
      payload.staffId = form.staffId.trim().toUpperCase();
    }
    try {
      await api.register(payload);
      toast("Account created successfully.", "success");
      navigate("/app", { replace: true });
      window.location.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to create account.", "danger");
    } finally { setLoading(false); }
  };

  const roleOptions: { id: StaffRole; label: string; desc: string }[] = [
    { id: "resident", label: "Resident", desc: "Flat owner / tenant" },
    { id: "guard", label: "Gate Guard", desc: "Requires staff ID from admin" },
    { id: "maintenance", label: "Maintenance", desc: "Requires staff ID from admin" },
  ];

  return (
    <AuthShell>
      <div className="rounded-3xl border border-slate-200 bg-surface p-6 shadow-soft sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Create account</p>
        <h1 className="mt-1 text-2xl font-extrabold">Join your society</h1>
        <p className="mt-2 text-sm text-slate-500">
          Residents register with their flat. Guard and maintenance staff need a valid staff ID issued by the society admin. Admin accounts cannot be self-registered.
        </p>
        <div className="mt-7 space-y-4">
          <Field label="Account type">
            <div className="grid grid-cols-3 gap-2">
              {roleOptions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition-all cursor-pointer ${role === r.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-surface text-slate-600 hover:border-slate-300"}`}
                >
                  <span className="block text-sm font-bold">{r.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-slate-400">{r.desc}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Full name"><TextInput value={form.name} onChange={e=>setForm({...form,name:e.target.value})} autoComplete="name" /></Field>
          <Field label="Email"><TextInput type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} autoComplete="email" /></Field>
          <Field label="Phone"><TextInput type="tel" placeholder="+92 3XX XXXXXXX" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} autoComplete="tel" /></Field>

          {role === "resident" ? (
            <Field label="Flat / Unit">
              {flatsLoading ? (
                <div className="min-h-11 animate-pulse rounded-xl bg-slate-100" />
              ) : flatsError ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-rose-600">{flatsError}</p>
                  <Button size="sm" variant="secondary" onClick={() => { setFlatsLoading(true); setFlatsError(""); api.flats().then(setFlats).catch(() => setFlatsError("Unable to load society flats.")).finally(() => setFlatsLoading(false)); }}>
                    Retry loading flats
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {towers.map((tower) => (
                    <button
                      key={tower}
                      type="button"
                      onClick={() => setForm({ ...form, flat: "" })}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition-all cursor-pointer ${form.flat.startsWith(tower) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-surface text-slate-600 hover:border-slate-300"}`}
                    >
                      Tower {tower}
                    </button>
                  ))}
                </div>
              )}
              {!flatsLoading && !flatsError && (
                <>
                  <select
                    value={form.flat}
                    onChange={(e) => setForm({ ...form, flat: e.target.value })}
                    className="mt-2 w-full min-h-11 rounded-xl border border-slate-200 bg-surface px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  >
                    <option value="">Select a flat…</option>
                    {flatOptions.map((f) => (
                      <option key={f.id} value={`${f.tower}-${f.number}`}>{`${f.tower}-${f.number}`}{f.occupancy === "VACANT" ? " (vacant)" : ""}</option>
                    ))}
                  </select>
                  {form.flat && !flatOptions.some((f) => `${f.tower}-${f.number}` === form.flat) && (
                    <p className="mt-1 text-xs font-semibold text-rose-600">Select a flat from the list above.</p>
                  )}
                </>
              )}
            </Field>
          ) : (
            <Field label="Staff ID" hint="Issued by the society admin (e.g. SEC-101 for guards, MNT-201 for maintenance)">
              <TextInput value={form.staffId} onChange={e=>setForm({...form,staffId:e.target.value})} placeholder="SEC-101 / MNT-201" />
            </Field>
          )}

          <Field label="Password" hint="At least 8 characters, letters and numbers"><PasswordInput value={form.password} onChange={v=>setForm({...form,password:v})} /></Field>
          <Field label="Confirm password"><PasswordInput value={form.confirm} onChange={v=>setForm({...form,confirm:v})} /></Field>
          {form.confirm && form.password !== form.confirm && <p className="text-xs font-semibold text-rose-600">Passwords do not match.</p>}
          <Button size="lg" className="w-full" disabled={!valid || loading} onClick={submit}>{loading ? "Creating account…" : `Create ${role} account`}</Button>
          <p className="text-center text-sm text-slate-500">Already registered? <Link className="font-bold text-brand-700" to="/login">Sign in</Link></p>
        </div>
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  return <ForgotView onBack={() => navigate("/login")} onSent={(token) => navigate(`/reset-password${token ? `?token=${encodeURIComponent(token)}` : ""}`)} />;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  return <ResetView token={params.get("token") ?? undefined} onDone={() => navigate("/login")} />;
}

export function Login() {
  const { login, authLoading, user, toast } = useApp();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<{ role: string; label: string; email: string; password: string }[] | null>(null);

  useEffect(() => {
    if (!authLoading && user) navigate("/app", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!IS_DEV) return;
    api.demoAccounts()
      .then((r) => setDemoAccounts(r.enabled ? r.accounts : null))
      .catch(() => setDemoAccounts(null));
  }, []);

  const isEmail = identifier.includes("@");
  const validIdentifier = isEmail ? /\S+@\S+\.\S+/.test(identifier) : identifier.replace(/\D/g, "").length >= 10;

  const submit = async () => {
    if (!validIdentifier) {
      toast(isEmail ? "Enter a valid email address." : "Enter a valid phone number.", "warning");
      return;
    }
    if (password.length < 8) {
      toast("Password must contain at least 8 characters.", "warning");
      return;
    }
    setLoading(true);
    try {
      await login(identifier, password);
      toast("Signed in successfully.", "success");
      navigate("/app");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to sign in.", "danger");
    } finally {
      setLoading(false);
    }
  };

  const useDemo = (account: { email: string; password: string }) => {
    setIdentifier(account.email);
    setPassword(account.password);
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-slate-200/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-lg font-extrabold text-slate-900">SmartSociety</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Back to website
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl lg:grid-cols-2">
        <div className="relative hidden overflow-hidden lg:block">
          <ImgWithFallback src={IMG.buildingBlue} alt="Residential community" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950/85 via-brand-900/40 to-brand-900/10" />
          <div className="absolute inset-x-0 bottom-0 p-12">
            <Badge tone="brand" className="bg-surface/15 text-white ring-white/25 backdrop-blur">
              <ShieldCheck className="h-3 w-3" /> Maple Heights · Lahore, Pakistan
            </Badge>
            <p className="mt-4 max-w-md text-2xl font-extrabold leading-snug text-white">
              One secure place for residents, security and society operations.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <ImgWithFallback src={AVATARS.resident} alt="" className="h-11 w-11 rounded-full border-2 border-white/40 object-cover" />
              <div>
                <p className="text-sm font-bold text-white">SmartSociety</p>
                <p className="text-xs text-brand-100/80">Secure community management</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-4 py-14 sm:px-8">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-4">
              <Avatar src={AVATARS.resident} alt="SmartSociety" size="xl" ring />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Welcome back</p>
                <h1 className="mt-0.5 text-2xl font-extrabold">Sign in to your workspace</h1>
              </div>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Use your society email or phone number. Your role and permissions are loaded securely from the server.
            </p>

            <div className="mt-7 space-y-4">
              <Field label="Email or phone number">
                <div className="relative">
                  {isEmail ? (
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  ) : (
                    <Smartphone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  )}
                  <TextInput className="pl-11" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="name@email.com · +92 3XX XXXXXXX" autoComplete="username" />
                </div>
              </Field>
              <Field label="Password">
                <PasswordInput value={password} onChange={setPassword} placeholder="Your password" />
              </Field>
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs font-semibold text-brand-700 hover:text-brand-800">Forgot password?</Link>
              </div>
              <Button size="lg" className="w-full" onClick={submit} disabled={loading}>
                {loading ? "Signing in…" : "Sign in"} <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-sm text-slate-500">New resident? <Link className="font-bold text-brand-700" to="/register">Create an account</Link></p>
            </div>

            {IS_DEV && demoAccounts && demoAccounts.length > 0 && (
              <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Development demo accounts</p>
                    <p className="text-[11px] text-amber-700">Development only — one click fills the fields (no auto-login).</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {demoAccounts.map((a) => (
                    <button
                      key={a.role}
                      type="button"
                      onClick={() => useDemo(a)}
                      className="rounded-xl border border-amber-200 bg-surface px-3 py-2 text-left transition-all hover:border-amber-400 cursor-pointer"
                    >
                      <span className="block text-xs font-bold text-slate-800">{a.label}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">{a.email}</span>
                      <span className="block text-[10px] font-semibold text-amber-700">{a.password}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}