import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unexpected application error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("SmartSociety UI error", error, info);
    }
  }

  private recover = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
        <section
          role="alert"
          className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-lift"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
            SmartSociety
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-950">
            Something went wrong
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
            The page hit an unexpected error. Your account and database data have not been reset.
            Try the page again, or refresh the browser if the problem continues.
          </p>
          {import.meta.env.DEV && this.state.message ? (
            <pre className="mt-5 max-h-32 overflow-auto rounded-xl bg-slate-100 p-3 text-left text-xs text-slate-600">
              {this.state.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={this.recover}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </section>
      </main>
    );
  }
}
