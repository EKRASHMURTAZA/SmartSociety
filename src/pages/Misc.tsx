import { Link } from "react-router-dom";
import { ArrowLeft, Home, KeyRound, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "../components/ui";
import { LogoMark } from "../components/Layout";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md animate-pop-in text-center">{children}</div>
    </div>
  );
}

function HomeButton() {
  return (
    <Link to="/">
      <Button variant="secondary">
        <Home className="h-4 w-4" /> Back to home
      </Button>
    </Link>
  );
}

/* ---------------------------------------------------------------------- 404 */
export function NotFoundPage() {
  return (
    <Shell>
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 text-brand-600">
        <LogoMark />
      </div>
      <p className="font-display text-7xl font-extrabold text-slate-900">404</p>
      <h1 className="mt-3 text-xl font-extrabold">Page not found</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
        The page you're looking for doesn't exist or may have moved. Let's get you back home.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <HomeButton />
        <Link to="/app"><Button>Open the app</Button></Link>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------- generic error */
export function ErrorPage() {
  return (
    <Shell>
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <ShieldAlert className="h-8 w-8" />
      </span>
      <h1 className="text-xl font-extrabold">Something went wrong</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
        We hit an unexpected problem. Please try again — your data is safe.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
        <HomeButton />
      </div>
    </Shell>
  );
}

/* ---------------------------------------------------------------- unauthorised */
export function UnauthorizedPage() {
  return (
    <Shell>
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <KeyRound className="h-8 w-8" />
      </span>
      <h1 className="text-xl font-extrabold">You don't have access</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
        This area is restricted to authorised users. Sign in with the right account to continue.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link to="/login"><Button>Sign in</Button></Link>
        <HomeButton />
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------ session expired */
export function SessionExpiredPage() {
  return (
    <Shell>
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <RefreshCw className="h-8 w-8" />
      </span>
      <h1 className="text-xl font-extrabold">Your session expired</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
        For your security, you've been signed out after a period of inactivity. Sign back in to continue.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link to="/login"><Button>Sign in again</Button></Link>
        <HomeButton />
      </div>
    </Shell>
  );
}

/* --------------------------------------------------------- back-to-login link */
export function BackToLoginLink() {
  return (
    <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 transition-colors hover:text-slate-600">
      <ArrowLeft className="h-4 w-4" /> Back to login
    </Link>
  );
}
