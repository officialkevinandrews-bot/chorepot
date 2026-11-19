import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/family/auth-screen";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { code?: string; signup?: string } => ({
    ...(typeof s["code"] === "string" ? { code: s["code"] } : {}),
    ...(typeof s["signup"] === "string" ? { signup: s["signup"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Join your family | Chorepot" },
      {
        name: "description",
        content: "Sign in or start your family’s chore and pocket money journey.",
      },
      { property: "og:title", content: "Join your family | Chorepot" },
      {
        property: "og:description",
        content: "A happy little space for family chores and pocket money.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const { code, signup } = Route.useSearch();
  return <AuthScreen code={code} defaultSignup={signup === "1" || signup === "true"} />;
}
