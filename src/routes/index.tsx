import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LandingPage } from "@/features/family/landing-page";
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
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);
  return <LandingPage />;
}
