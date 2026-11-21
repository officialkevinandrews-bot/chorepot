import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LandingPage } from "@/features/family/landing-page";
import { isRunningInApk } from "@/features/family/model";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chorepot | Little chores, big possibilities" },
      {
        name: "description",
        content:
          "A cheerful family space for chores, pocket money and savings goals in pounds and pence.",
      },
      {
        property: "og:title",
        content: "Chorepot | Little chores, big possibilities",
      },
      {
        property: "og:description",
        content: "Grow good habits together with family chores, photo proof and pocket money.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [inApk, setInApk] = useState(false);

  useEffect(() => {
    const apk = isRunningInApk();
    setInApk(apk);
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        void navigate({ to: "/dashboard", replace: true });
      } else if (apk) {
        void navigate({ to: "/auth", replace: true });
      }
    });
  }, [navigate]);

  if (inApk) {
    return (
      <main className="auth-page flex items-center justify-center">
        <p className="text-sm font-semibold text-muted-foreground">Opening Chorepot…</p>
      </main>
    );
  }

  return <LandingPage />;
}
