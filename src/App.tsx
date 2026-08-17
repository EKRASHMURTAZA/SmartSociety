import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./state/store";
import { AppShell, ToastViewport } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { ForgotPasswordPage, Login, Register, ResetPasswordPage } from "./pages/Login";
import { AboutPage, ContactPage, HelpCenterPage, HowItWorksPage } from "./pages/Static";
import { FaqPage, PrivacyPage, SecurityPrivacyPage, TermsPage } from "./pages/Legal";
import { ErrorPage, NotFoundPage, SessionExpiredPage, UnauthorizedPage } from "./pages/Misc";
import { ErrorBoundary } from "./components/ErrorBoundary";

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

function ProtectedApp() {
  const { user, authLoading } = useApp();
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm animate-fade-in text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-brand-100" />
          <div className="mx-auto mt-5 h-3 w-32 animate-pulse rounded-full bg-slate-200" />
          <div className="mx-auto mt-3 h-2.5 w-48 animate-pulse rounded-full bg-slate-200" />
          <p className="mt-6 text-xs font-semibold text-slate-400">Loading your secure workspace…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
      <HashRouter>
        <ScrollManager />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/security-privacy" element={<SecurityPrivacyPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/app" element={<ProtectedApp />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/session-expired" element={<SessionExpiredPage />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <ToastViewport />
      </HashRouter>
    </AppProvider>
    </ErrorBoundary>
  );
}
