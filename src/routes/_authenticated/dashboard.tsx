import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Dashboard } from "@/features/family/dashboard";
import { OnboardingWizard } from "@/features/family/onboarding-wizard";
import { fetchAuthenticatedFamily } from "@/features/family/family-client";

const familyQuery = queryOptions({
  queryKey: ["family"],
  queryFn: () => fetchAuthenticatedFamily(),
  refetchInterval: 15000,
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(familyQuery),
  head: () => ({
    meta: [
      { title: "Your family dashboard | Chorepot" },
      {
        name: "description",
        content: "Manage family chores, approve little wins and grow pocket money savings.",
      },
      { property: "og:title", content: "Your family dashboard | Chorepot" },
      {
        property: "og:description",
        content: "Chores, savings and little wins for your whole family.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FamilyDashboard,
});

function FamilyDashboard() {
  const { data, refetch } = useSuspenseQuery(familyQuery);

  const needsOnboarding =
    !data ||
    (data.role !== "child" &&
      data.members.filter((m) => m.role === "child").length === 0 &&
      !data.config?.onboardingCompleted);

  if (needsOnboarding) {
    return <OnboardingWizard family={data ?? null} onComplete={() => void refetch()} />;
  }

  return <Dashboard family={data} onRefresh={() => void refetch()} />;
}
