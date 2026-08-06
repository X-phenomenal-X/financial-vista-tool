import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-violet-grad font-display text-2xl shadow-elevated">W</div>
        <h1 className="mt-6 font-display text-6xl text-foreground">404</h1>
        <h2 className="mt-3 text-xl font-semibold text-foreground">This route is off course</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The page does not exist or has moved to another part of your Wealthpilot workspace.
        </p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl bg-violet-grad px-5 py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:scale-[1.02] active:scale-95"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-elevated">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/12 text-xl text-destructive">!</div>
        <h1 className="mt-5 font-display text-2xl tracking-tight text-foreground">This page did not load</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Something interrupted the request. Try again or return to your dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-2xl bg-violet-grad px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] active:scale-95"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Wealthpilot — Private Finance OS" },
      { name: "description", content: "A private financial command center for cash flow, budgets, debt payoff, goals, and smarter decisions." },
      { name: "author", content: "Wealthpilot" },
      { name: "theme-color", content: "#14101f" },
      { property: "og:title", content: "Wealthpilot" },
      { property: "og:description", content: "Your private financial command center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}
