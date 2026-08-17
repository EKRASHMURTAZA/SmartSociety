
 import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Megaphone,
  Monitor,
  Moon,
  QrCode,
  Receipt,
  Settings,
  ShieldCheck,
  Siren,
  Sparkles,
  Sun,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useApp } from "../state/store";
import { api } from "../lib/api";
import { type Role } from "../data/mock";
import { applyTheme, cycleTheme, saveTheme, storedTheme, type ThemePreference } from "../lib/theme";
import { Avatar, Badge, EmptyState } from "./ui";
import {
  AdminBilling,
  AdminComplaints,
  AdminGate,
  AdminNotices,
  AdminOverview,
  AdminProfile,
  AdminReports,
  AdminResidents,
  AdminStaff,
} from "../pages/Admin";
import { GuardProfile, GuardVerify, GuardVisitors } from "../pages/Guard";
import { MaintenanceProfile, MaintenanceTasks } from "../pages/Maintenance";
import {
  ResidentAmenities,
  ResidentBills,
  ResidentCommunity,
  ResidentComplaints,
  ResidentDashboard,
  ResidentProfile,
  ResidentVisitors,
} from "../pages/Resident";
import { ResidentActivity, ResidentEmergency, ResidentNotifications } from "../pages/ResidentExtra";
import { AdminAi } from "../pages/AdminAi";
import { AdminSettings } from "../pages/AdminSettings";
import { SocietyAi } from "./SocietyAi";

/* ------------------------------------------------------------------ icons */
const iconMap = {
  dashboard: LayoutDashboard,
  bills: Receipt,
  visitors: Users,
  complaints: ClipboardList,
  amenities: CalendarCheck,
  community: Megaphone,
  profile: DoorOpen,
  verify: QrCode,
  overview: LayoutDashboard,
  billing: Receipt,
  gate: ShieldCheck,
  tasks: Wrench,
  alerts: AlertTriangle,
  activity: Activity,
  notifications: Bell,
  emergency: Siren,
  residents: Users,
  staff: Wrench,
  notices: Megaphone,
  reports: FileText,
  ai: Sparkles,
  settings: Settings,
};

/* ---------------------------------------------------------------- nav data */
interface NavItem {
  id: string;
  label: string;
  icon: keyof typeof iconMap;
  bottom?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  resident: [
    { id: "dashboard", label: "Home", icon: "dashboard", bottom: true },
    { id: "bills", label: "Bills", icon: "bills", bottom: true },
    { id: "visitors", label: "Visitors", icon: "visitors", bottom: true },
    { id: "amenities", label: "Amenities", icon: "amenities", bottom: true },
    { id: "community", label: "Community", icon: "community", bottom: true },
    { id: "activity", label: "Activity", icon: "activity" },
    { id: "complaints", label: "Complaints", icon: "complaints" },
    { id: "notifications", label: "Notifications", icon: "notifications" },
    { id: "emergency", label: "Emergency", icon: "emergency" },
    { id: "profile", label: "Profile", icon: "profile" },
  ],
  guard: [
    { id: "verify", label: "Gate", icon: "verify", bottom: true },
    { id: "visitors", label: "Visitors", icon: "visitors", bottom: true },
    { id: "alerts", label: "Alerts", icon: "alerts", bottom: true },
    { id: "profile", label: "Profile", icon: "profile", bottom: true },
  ],
  admin: [
    { id: "overview", label: "Overview", icon: "overview", bottom: true },
    { id: "residents", label: "Residents", icon: "residents", bottom: true },
    { id: "billing", label: "Billing", icon: "billing", bottom: true },
    { id: "complaints", label: "Complaints", icon: "complaints", bottom: true },
    { id: "gate", label: "Gate", icon: "gate", bottom: true },
    { id: "staff", label: "Staff", icon: "staff" },
    { id: "notices", label: "Notices", icon: "notices" },
    { id: "reports", label: "Reports", icon: "reports" },
    { id: "ai", label: "AI & Knowledge", icon: "ai" },
    { id: "settings", label: "Settings", icon: "settings" },
    { id: "profile", label: "Profile", icon: "profile" },
  ],
  maintenance: [
    { id: "tasks", label: "My Tasks", icon: "tasks", bottom: true },
    { id: "profile", label: "Profile", icon: "profile", bottom: true },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  resident: "Resident",
  guard: "Security",
  admin: "Administrator",
  maintenance: "Maintenance",
};

/* ------------------------------------------------------------- App shell */
const DEFAULT_PAGE_BY_ROLE: Record<Role, string> = {
  resident: "dashboard",
  guard: "verify",
  admin: "overview",
  maintenance: "tasks",
};

const PAGES: Record<Role, Record<string, () => ReactNode>> = {
  resident: {
    dashboard: () => <ResidentDashboard />,
    bills: () => <ResidentBills />,
    visitors: () => <ResidentVisitors />,
    complaints: () => <ResidentComplaints />,
    amenities: () => <ResidentAmenities />,
    community: () => <ResidentCommunity />,
    activity: () => <ResidentActivity />,
    notifications: () => <ResidentNotifications />,
    emergency: () => <ResidentEmergency />,
    profile: () => <ResidentProfile />,
  },
  guard: {
    verify: () => <GuardVerify />,
    visitors: () => <GuardVisitors />,
    alerts: () => <GuardAlertsPage />,
    profile: () => <GuardProfile />,
  },
  admin: {
    overview: () => <AdminOverview />,
    residents: () => <AdminResidents />,
    billing: () => <AdminBilling />,
    complaints: () => <AdminComplaints />,
    gate: () => <AdminGate />,
    staff: () => <AdminStaff />,
    notices: () => <AdminNotices />,
    reports: () => <AdminReports />,
    ai: () => <AdminAi />,
    settings: () => <AdminSettings />,
    profile: () => <AdminProfile />,
  },
  maintenance: {
    tasks: () => <MaintenanceTasks />,
    profile: () => <MaintenanceProfile />,
  },
};

function GuardAlertsPage() {
  return <GuardVisitors tab="alerts" />;
}

function useBackendHealth() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let active = true;
    const check = () => {
      api
        .health()
        .then((h) => {
          if (active) setStatus(h?.ok ? "online" : "offline");
        })
        .catch(() => {
          if (active) setStatus("offline");
        });
    };
    check();
    const timer = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return status;
}

export function AppShell() {
  const { role, page, setPage, unreadCount, logout, profiles } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const backendStatus = useBackendHealth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemePreference>(() => storedTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const t = storedTheme();
      applyTheme(t);
      setTheme(t);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const nav = NAV[role];
  const validPage = Boolean(PAGES[role][page]);
  const safePage = validPage ? page : DEFAULT_PAGE_BY_ROLE[role];
  const current = nav.find((n) => n.id === safePage);
  const profile = profiles[role];

  useEffect(() => {
    if (!validPage) {
      setPage(DEFAULT_PAGE_BY_ROLE[role]);
    }
  }, [role, validPage, setPage]);

  const go = (id: string) => {
    if (!PAGES[role][id]) return;
    setPage(id);
    window.scrollTo({ top: 0 });
  };

  const switchRole = (_r: Role) => {
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200/70 bg-surface lg:flex">
        <div className="flex items-center px-5 py-5">
          <Link to="/" className="flex items-center gap-2.5" aria-label="SmartSociety home">
            <Brand />
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 thin-scroll">
          {nav.map((item) => {
            const Icon = iconMap[item.icon];
            const active = safePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                  active ? "bg-brand-50 text-brand-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500" aria-hidden="true" />}
                <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-600" : "text-slate-400")} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <Avatar src={profile.avatar} alt={profile.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{profile.name}</p>
              <p className="truncate text-xs text-slate-400">{ROLE_LABEL[role]} · {role === "guard" ? "Gate 1" : "Maple Heights"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-600 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" /> Return to website
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-surface/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <div className="flex items-center gap-1 lg:hidden">
              <button onClick={() => setNavOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 cursor-pointer" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
              <Link to="/" className="flex items-center gap-2" aria-label="SmartSociety home">
                <Brand compact />
              </Link>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-bold text-slate-900">
                {current?.label ?? "Home"}
                <span className="ml-2 text-xs font-medium text-slate-400">Maple Heights · Lahore, Pakistan</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-surface px-2.5 py-1 sm:flex"
                title={`Backend API: ${backendStatus}`}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    backendStatus === "online"
                      ? "bg-emerald-500"
                      : backendStatus === "offline"
                        ? "bg-rose-500"
                        : "animate-pulse bg-amber-400"
                  )}
                />
                <span className="text-[11px] font-semibold text-slate-500">
                  {backendStatus === "online"
                    ? "API online"
                    : backendStatus === "offline"
                      ? "API offline"
                      : "Checking…"}
                </span>
              </div>
              <button
                onClick={() => {
                  const next = cycleTheme(theme);
                  setTheme(next);
                  saveTheme(next);
                }}
                className="rounded-full p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                title={`Theme: ${theme} (click to change)`}
                aria-label={`Theme: ${theme}`}
              >
                {theme === "dark" ? <Moon className="h-5 w-5" /> : theme === "light" ? <Sun className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setDrawerOpen(true)}
                className="relative rounded-full p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-slate-100 cursor-pointer sm:pr-3"
                >
                  <Avatar src={profile.avatar} alt={profile.name} size="sm" />
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-bold leading-tight text-slate-800">{profile.name}</span>
                    <span className="block text-[10px] font-medium leading-tight text-slate-400">{ROLE_LABEL[role]}</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-50 mt-2 w-64 animate-pop-in rounded-2xl border border-slate-200/80 bg-surface p-2 shadow-lift">
                      <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Preview another role</p>
                      {(Object.keys(NAV) as Role[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => switchRole(r)} disabled={r !== role}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer",
                            r === role ? "bg-brand-50" : "hover:bg-slate-50"
                          )}
                        >
                          <Avatar src={profiles[r].avatar} alt={profiles[r].name} size="sm" />
                          <span className="flex-1">
                            <span className="block text-sm font-bold text-slate-800">{profiles[r].name}</span>
                            <span className="block text-xs text-slate-400">{ROLE_LABEL[r]}</span>
                          </span>
                          {r === role && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                        </button>
                      ))}
                      <div className="my-2 border-t border-slate-100" />
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" /> Back to website
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8">
          <div key={role + safePage} className="animate-slide-up">
            {PAGES[role][safePage]()}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
          {nav.filter((n) => n.bottom).map((item) => {
            const Icon = iconMap[item.icon];
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors cursor-pointer",
                  active ? "text-brand-700" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <span className={cn("flex h-7 w-11 items-center justify-center rounded-full transition-colors", active && "bg-brand-50")}>
                  <Icon className={cn("h-5 w-5", active && "text-brand-600")} />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <MobileNavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      <SocietyAi />
    </div>
  );
}

/* --------------------------------------------------------- Mobile nav drawer */
function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, page, setPage, logout, profiles } = useApp();
  const navigate = useNavigate();
  const nav = NAV[role];

  const go = (id: string) => {
    setPage(id);
    onClose();
    window.scrollTo({ top: 0 });
  };
  const switchRole = (_r: Role) => {
    onClose();
  };

  return (
    <div className={cn("fixed inset-0 z-50 lg:hidden", !open && "pointer-events-none")}>
      <div
        className={cn("absolute inset-0 bg-[#020617]/50 backdrop-blur-[2px] transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-surface shadow-lift transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5" onClick={onClose} aria-label="SmartSociety home">
            <Brand />
          </Link>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Menu</p>
          {nav.map((item) => {
            const Icon = iconMap[item.icon];
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors cursor-pointer",
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-600" : "text-slate-400")} />
                {item.label}
              </button>
            );
          })}
          <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Workspace</p>
          {(Object.keys(NAV) as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => switchRole(r)} disabled={r !== role}
              className={cn("flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors cursor-pointer", r === role ? "bg-brand-50" : "hover:bg-slate-50")}
            >
              <Avatar src={profiles[r].avatar} alt={profiles[r].name} size="sm" />
              <span className="flex-1 truncate text-sm font-bold text-slate-800">{profiles[r].name}</span>
              {r === role && <span className="h-2 w-2 rounded-full bg-brand-500" />}
            </button>
          ))}
        </div>
        <div className="border-t border-slate-100 p-4">
          <button
            onClick={async () => {
              onClose();
              await logout();
              navigate("/");
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Back to website
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- Notification drawer */
const CATEGORIES = ["All", "Security", "Billing", "Complaints", "Bookings", "Community", "Emergency"] as const;

function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, markAllRead, markRead } = useApp();
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");

  useEffect(() => {
    if (open) setCat("All");
  }, [open]);

  const filtered = cat === "All" ? notifications : notifications.filter((n) => n.category === cat);
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <div className={cn("fixed inset-0 z-50", !open && "pointer-events-none")}>
      <div
        className={cn("absolute inset-0 bg-[#020617]/50 backdrop-blur-[2px] transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-lift transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Notifications</h3>
            <p className="text-xs text-slate-400">{unread} unread</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
            <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-slate-100 px-4 py-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                cat === c ? "bg-[#0f172a] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-7 w-7" />}
              title="Nothing here"
              message={cat === "All" ? "You're all caught up. New updates will appear here." : `No ${cat.toLowerCase()} notifications right now.`}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3.5 text-left transition-colors cursor-pointer",
                    n.unread ? "border-brand-100 bg-brand-50/50 hover:bg-brand-50" : "border-slate-100 bg-surface hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={n.tone}>{n.category}</Badge>
                    <span className="text-[11px] font-medium text-slate-400">{n.time}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-800">{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.body}</p>
                  {n.unread && <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Logo mark */
export function LogoMark({ small }: { small?: boolean }) {
  return (
    <span
      className={cn(
        "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-700/30 ring-1 ring-inset ring-white/20",
        small ? "h-8 w-8" : "h-9 w-9"
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className={small ? "h-4 w-4" : "h-[18px] w-[18px]"} aria-hidden="true">
        <path d="M4 11.2 12 4.6l8 6.6V19.4a1.6 1.6 0 0 1-1.6 1.6h-3.4v-6h-6v6H5.6A1.6 1.6 0 0 1 4 19.4V11.2Z" fill="currentColor" />
        <path d="M4 11.2 12 4.6l8 6.6" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark small={compact} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display font-extrabold tracking-tight text-slate-900", compact ? "text-base" : "text-lg")}>
          Smart<span className="text-brand-600">Society</span>
        </span>
        {!compact && <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Maple Heights</span>}
      </span>
    </span>
  );
}

/* -------------------------------------------------------- Landing header */
export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Features", to: "/#features" },
    { label: "How It Works", to: "/how-it-works" },
    { label: "About", to: "/about" },
    { label: "Contact", to: "/contact" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label="SmartSociety home">
          <Brand />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link to="/login" className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            Login
          </Link>
          <Link to="/login">
            <button className="rounded-xl bg-brand-600 px-4.5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-700/20 transition-all hover:bg-brand-700 active:scale-[0.98] cursor-pointer">
              Get Started
            </button>
          </Link>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden cursor-pointer" aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="animate-fade-in border-t border-slate-100 bg-surface px-4 pb-4 pt-2 md:hidden">
          {links.map((l) => (
            <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {l.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2 border-t border-slate-100 pt-3">
            <Link to="/login" className="flex-1">
              <span className="block rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700">Login</span>
            </Link>
            <Link to="/login" className="flex-1">
              <span className="block rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white">Get Started</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* --------------------------------------------------------- Landing footer */
export function LandingFooter() {
  const cols = [
    {
      title: "Product",
      links: [
        { label: "Features", to: "/#features" },
        { label: "How It Works", to: "/how-it-works" },
        { label: "About", to: "/about" },
        { label: "Help Center", to: "/help" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About us", to: "/about" },
        { label: "Contact", to: "/contact" },
        { label: "Support", to: "/help" },
        { label: "FAQ", to: "/faq" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", to: "/privacy" },
        { label: "Terms of Service", to: "/terms" },
        { label: "Security & Privacy", to: "/security-privacy" },
      ],
    },
    {
      title: "Apps",
      links: [
        { label: "Resident login", to: "/login" },
        { label: "Security login", to: "/login" },
        { label: "Admin login", to: "/login" },
        { label: "Maintenance login", to: "/login" },
      ],
    },
  ];
  return (
    <footer className="border-t border-slate-200/70 bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <LogoMark />
              <span className="font-display text-lg font-extrabold text-slate-900">SmartSociety</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Everything your residential society needs — visitors, bills, complaints, amenities and security — in one calm, simple place.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {[LifeBuoy, ShieldCheck, Users].map((Icon, i) => (
                <span key={i} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-bold text-slate-900">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm text-slate-500 transition-colors hover:text-brand-700">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© 2026 SmartSociety Technologies (Pvt.) Ltd.</p>
          <p>Made for communities that care · Maple Heights, Lahore, Pakistan</p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------ Toast stack */
export function ToastViewport() {
  const { toasts, dismissToast } = useApp();
  const tones = {
    success: "border-emerald-200 bg-surface text-emerald-800",
    info: "border-sky-200 bg-surface text-sky-800",
    warning: "border-amber-200 bg-surface text-amber-800",
    danger: "border-rose-200 bg-surface text-rose-800",
  };
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn("pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lift animate-pop-in", tones[t.tone])}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-current text-white">
            <CheckIcon />
          </span>
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="opacity-50 hover:opacity-100 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 5.2 4.2 7.4 8 2.6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}