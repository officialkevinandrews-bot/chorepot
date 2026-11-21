import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches /auth and /dashboard routes cleanly", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });

    expect(router.matchRoutes("/auth").at(-1)?.routeId).toBe("/auth");
    expect(router.matchRoutes("/dashboard").at(-1)?.routeId).toBe("/_authenticated/dashboard");
  });

  it("preserves numeric and boolean search flags on /auth such as apk_oauth=1, signup=1, and numeric invite codes", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });

    const apkMatch = router.matchRoutes("/auth", { apk_oauth: 1, signup: 1, code: 123456 });
    const search = apkMatch.at(-1)?.search as Record<string, unknown> | undefined;
    expect(search?.["apk_oauth"]).toBe("1");
    expect(search?.["signup"]).toBe("1");
    expect(search?.["code"]).toBe("123456");
  });
});
