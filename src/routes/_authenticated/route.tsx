import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the stored session locally, so the app still opens
    // when there's no connection. getUser() would round-trip to Supabase and
    // bounce an offline user to the sign-in screen. This gate is only UX —
    // row-level security is what actually protects the data on every request.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <AppShell />,
});