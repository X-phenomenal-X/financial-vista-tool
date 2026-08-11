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
import { PwaProvider } from "@/hooks/use-pwa";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-violet-grad font-display text-3xl shadow-elevated ring-1 ring-white/15">W</div>
        <div className="eyebrow mt-7">Navigation error</div>
        <h1 className="mt-2 font-display text-7xl text-foreground">404</h1>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">This route is off course</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The page does not exist or has moved to another part of your Wealthpilot workspace.
        </p>
        <div className="mt-7">
          <Link
            to="/dashboard"
            className="ui-button relative inline-flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-violet-grad px-5 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:shadow-elevated"
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
      <div className="ui-card max-w-md rounded-3xl border border-white/[0.08] bg-card p-8 text-center shadow-elevated">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-destructive/20 bg-destructive/12 text-xl font-bold text-destructive">!</div>
        <div className="eyebrow mt-6">System interruption</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground">This page did not load</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Something interrupted the request. Try again or return to your dashboard.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="ui-button relative inline-flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-violet-grad px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="ui-button relative inline-flex items-center justify-center overflow-hidden rounded-2xl border border-input bg-white/[0.035] px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
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
      { name: "theme-color", content: "#100d18" },
      // Home-screen install support. iOS still reads the apple-prefixed tags, and
      // black-translucent lets the app run edge-to-edge — the shell already pads
      // with env(safe-area-inset-*).
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Wealthpilot" },
      // Stop iOS from turning balances and account numbers into phone links.
      { name: "format-detection", content: "telephone=no" },
      { property: "og:title", content: "Wealthpilot" },
      { property: "og:description", content: "Your private financial command center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap",
      },
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
      <PwaProvider>
        <Outlet />
        <Toaster theme="dark" position="top-center" richColors closeButton duration={3200} />
      </PwaProvider>
    </QueryClientProvider>
  );
}
