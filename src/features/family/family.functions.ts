import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { Family, FamilyState } from "./model";

async function sendPushNotificationsForAction(
  supabase: {
    from: (table: "user_roles") => {
      select: (columns: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          single: () => Promise<{ data: { household_id: string } | null }>;
        } & PromiseLike<{ data: Array<{ user_id: string; role: string }> | null }>;
      };
    };
  },
  userId: string,
  action: string,
): Promise<number> {
  if (!["complete", "approve", "reject"].includes(action)) return 0;

  const { data: mine } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!mine) return 0;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("*")
    .eq("household_id", mine.household_id);

  const ids = (roles ?? [])
    .filter((r) => (action === "complete" ? r.role !== "child" : r.role === "child"))
    .map((r) => r.user_id);

  if (!ids.length) return 0;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: devices } = await supabaseAdmin.from("push_devices").select("*").in("user_id", ids);

  const key = process.env["FIREBASE_MESSAGING_API_KEY"];
  const api = process.env["LOVABLE_API_KEY"];
  if (!key || !api) return 0;

  let sent = 0;
  await Promise.all(
    (devices ?? []).map(async (device) => {
      try {
        const res = await fetch(
          "https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${api}`,
              "X-Connection-Api-Key": key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: device.token,
                notification: {
                  title: "Chorepot",
                  body:
                    action === "complete"
                      ? "A chore is ready for your approval!"
                      : "Your chore has been reviewed.",
                },
                data: { path: "/dashboard" },
              },
            }),
          },
        );
        if (res.ok) {
          sent += 1;
        } else {
          const body = await res.text();
          console.error("Push failed", res.status, body);
          if (body.includes("UNREGISTERED")) {
            await supabaseAdmin.from("push_devices").delete().eq("token", device.token);
          }
        }
      } catch (e) {
        console.error("Push unavailable", e);
      }
    }),
  );
  return sent;
}

export const getFamily = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: role, error } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!role) return null;
    const { data: h, error: he } = await supabase
      .from("households")
      .select("*")
      .eq("id", role.household_id)
      .single();
    if (he) throw he;
    const { data: roles, error: re } = await supabase
      .from("user_roles")
      .select("*")
      .eq("household_id", h.id);
    if (re) throw re;
    const { data: profiles, error: pe } = await supabase
      .from("profiles")
      .select("*")
      .in(
        "id",
        (roles ?? []).map((r) => r.user_id),
      );
    if (pe) throw pe;
    return {
      id: h.id,
      name: h.name,
      code: h.code,
      state: h.state as unknown as FamilyState,
      userId,
      role: role.role,
      members: (roles ?? []).map((r) => {
        const p = profiles?.find((item) => item.id === r.user_id);
        return {
          id: r.user_id,
          role: r.role,
          name: p?.name ?? "Family member",
          avatar: p?.avatar ?? "🌱",
        };
      }),
    } satisfies Family;
  });

export const performAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { action: string; payload: Record<string, string | number> }) => d)
  .handler(async ({ data, context }) => {
    const { data: state, error } = await context.supabase.rpc("family_action", {
      action: data.action,
      payload: data.payload as Json,
    });
    if (error) throw new Error(error.message);

    await sendPushNotificationsForAction(
      context.supabase as unknown as Parameters<typeof sendPushNotificationsForAction>[0],
      context.userId,
      data.action,
    );

    return state as unknown as FamilyState;
  });

export const notifyHouseholdPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { action: string }) => d)
  .handler(async ({ data, context }) => {
    const sent = await sendPushNotificationsForAction(
      context.supabase as unknown as Parameters<typeof sendPushNotificationsForAction>[0],
      context.userId,
      data.action,
    );
    return { sent };
  });
