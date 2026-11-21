import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/family/auth-screen";

function asSearchString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { code?: string; signup?: string; apk_oauth?: string; apk_oauth_error?: string } => {
    const code = asSearchString(s["code"]);
    const signup = asSearchString(s["signup"]);
    const apkOauth = asSearchString(s["apk_oauth"]);
    const apkOauthError = asSearchString(s["apk_oauth_error"]);
    return {
      ...(code !== undefined ? { code } : {}),
      ...(signup !== undefined ? { signup } : {}),
      ...(apkOauth !== undefined ? { apk_oauth: apkOauth } : {}),
      ...(apkOauthError !== undefined ? { apk_oauth_error: apkOauthError } : {}),
    };
  },
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
  const { code, signup, apk_oauth, apk_oauth_error } = Route.useSearch();
  return (
    <AuthScreen
      code={code}
      defaultSignup={signup === "1" || signup === "true"}
      apkOauth={apk_oauth === "1" || apk_oauth === "true"}
      apkOauthError={apk_oauth_error}
    />
  );
}
