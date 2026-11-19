import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  CHILD_THEMES,
  balance,
  choreRewardMode,
  choreScheduledDaysCount,
  currentWeekKey,
  defaultHouseholdConfig,
  isChildThemeColor,
  isChoreScheduledOnDay,
  money,
  nextDayToComplete,
  today,
  type ChildThemeColor,
  type Chore,
  type ChoreFrequency,
  type ChoreOverride,
  type ChoreRewardMode,
  type Entry,
  type Family,
  type FamilyState,
  type Goal,
  type GoalOverride,
  type HouseholdConfig,
  type ManagedChild,
  type Member,
  type MemberPreferences,
  type Notice,
  type PendingInvite,
} from "./model";
import { notifyHouseholdPush } from "./family.functions";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parsePreferences(raw: Json | null | undefined): MemberPreferences {
  const obj = asRecord(raw);
  const prefs: MemberPreferences = {};
  if (typeof obj["celebrations"] === "boolean") {
    prefs.celebrations = obj["celebrations"];
  }
  if (typeof obj["clearedNotificationsAt"] === "string") {
    prefs.clearedNotificationsAt = obj["clearedNotificationsAt"];
  }
  if (isChildThemeColor(obj["themeColor"])) {
    prefs.themeColor = obj["themeColor"];
  }
  if (Array.isArray(obj["customGoals"])) {
    prefs.customGoals = obj["customGoals"] as Goal[];
  }
  if (obj["goalOverrides"] && typeof obj["goalOverrides"] === "object") {
    prefs.goalOverrides = obj["goalOverrides"] as Record<string, GoalOverride>;
  }
  if (obj["householdConfig"] && typeof obj["householdConfig"] === "object") {
    prefs.householdConfig = obj["householdConfig"] as HouseholdConfig;
  }
  return prefs;
}

function isParentNotification(notice: Notice): boolean {
  if (notice.targetRole === "parent") return true;
  if (notice.targetRole === "child") return false;
  return notice.message === "Ready for parent approval";
}

function isChildNotification(notice: Notice): boolean {
  if (notice.targetRole === "child") return true;
  if (notice.targetRole === "parent") return false;
  return notice.message.startsWith("Approved") || notice.message.startsWith("Needs another try");
}

function mergeChoreWithOverride(chore: Chore, override?: ChoreOverride): Chore | null {
  if (!override) return chore;
  if (override.deleted || override.replacedById) return null;
  const merged: Chore = {
    ...chore,
    ...(override.title !== undefined ? { title: override.title } : {}),
    ...(override.childId !== undefined ? { childId: override.childId } : {}),
    ...(override.day !== undefined ? { day: override.day } : {}),
    ...(override.days !== undefined ? { days: override.days } : {}),
    ...(override.frequency !== undefined ? { frequency: override.frequency } : {}),
    ...(override.rewardMode !== undefined ? { rewardMode: override.rewardMode } : {}),
    ...(override.completedDays !== undefined ? { completedDays: override.completedDays } : {}),
    ...(override.value !== undefined ? { value: override.value } : {}),
    ...(override.emoji !== undefined ? { emoji: override.emoji } : {}),
    ...(override.status !== undefined ? { status: override.status } : {}),
    ...(override.proof !== undefined ? { proof: override.proof } : {}),
    ...(override.note !== undefined ? { note: override.note } : {}),
    ...(override.submittedAt !== undefined ? { submittedAt: override.submittedAt } : {}),
    ...(override.description !== undefined ? { description: override.description } : {}),
    ...(override.requirePhoto !== undefined ? { requirePhoto: override.requirePhoto } : {}),
    ...(override.weekKey !== undefined ? { weekKey: override.weekKey } : {}),
    ...(override.seriesId !== undefined ? { seriesId: override.seriesId } : {}),
  };
  if (override.description === "") {
    delete merged.description;
  }
  if (override.note === "") {
    delete merged.note;
  }
  if (override.proof === "") {
    delete merged.proof;
  }
  return merged;
}

function mergeGoalWithOverride(goal: Goal, override?: GoalOverride): Goal | null {
  if (!override) return goal;
  if (override.deleted) return null;
  return {
    ...goal,
    ...(override.title !== undefined ? { title: override.title } : {}),
    ...(override.emoji !== undefined ? { emoji: override.emoji } : {}),
    ...(override.target !== undefined ? { target: override.target } : {}),
    ...(override.saved !== undefined ? { saved: override.saved } : {}),
    ...(override.achieved !== undefined ? { achieved: override.achieved } : {}),
    ...(override.achievedAt !== undefined ? { achievedAt: override.achievedAt } : {}),
  };
}

function collectLatestOverrides<T extends { updatedAt?: string }>(
  maps: Array<Record<string, T> | undefined>,
): Record<string, T> {
  const entries: Array<{ id: string; override: T }> = [];
  for (const map of maps) {
    if (!map) continue;
    for (const [id, override] of Object.entries(map)) {
      entries.push({ id, override });
    }
  }
  entries.sort((a, b) => (a.override.updatedAt ?? "").localeCompare(b.override.updatedAt ?? ""));
  const result: Record<string, T> = {};
  for (const { id, override } of entries) {
    result[id] = { ...(result[id] ?? ({} as T)), ...override };
  }
  return result;
}

function buildNextHouseholdConfig(
  family: Family,
  patch: Partial<HouseholdConfig>,
  nowIso: string,
): HouseholdConfig {
  const base = family.config ?? defaultHouseholdConfig;
  const next: HouseholdConfig = {
    paydayFrequency: patch.paydayFrequency ?? base.paydayFrequency,
    paydayDay: patch.paydayDay ?? base.paydayDay,
    ...(patch.onboardingCompleted !== undefined
      ? { onboardingCompleted: patch.onboardingCompleted }
      : base.onboardingCompleted !== undefined
        ? { onboardingCompleted: base.onboardingCompleted }
        : {}),
    ...(patch.parentPin !== undefined
      ? patch.parentPin
        ? { parentPin: patch.parentPin }
        : {}
      : base.parentPin
        ? { parentPin: base.parentPin }
        : {}),
    managedChildren: patch.managedChildren ?? base.managedChildren ?? [],
    pendingInvites: patch.pendingInvites ?? base.pendingInvites ?? [],
    childThemes: patch.childThemes ?? base.childThemes ?? {},
    customChores: patch.customChores ?? base.customChores ?? [],
    customLedger: patch.customLedger ?? base.customLedger ?? [],
    customNotifications: patch.customNotifications ?? base.customNotifications ?? [],
    choreOverrides: patch.choreOverrides ?? base.choreOverrides ?? {},
    goalOverrides: patch.goalOverrides ?? base.goalOverrides ?? {},
    updatedAt: nowIso,
  };
  return next;
}

export async function loadFamilyFromSupabase(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<Family | null> {
  const { data: role, error } = await client
    .from("user_roles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!role) return null;

  const { data: household, error: he } = await client
    .from("households")
    .select("*")
    .eq("id", role.household_id)
    .single();
  if (he) throw he;

  const { data: roles, error: re } = await client
    .from("user_roles")
    .select("*")
    .eq("household_id", household.id);
  if (re) throw re;

  const memberIds = (roles ?? []).map((r) => r.user_id);
  const { data: profiles, error: pe } = await client
    .from("profiles")
    .select("*")
    .in("id", memberIds);
  if (pe) throw pe;

  const realMembers: Member[] = (roles ?? []).map((r) => {
    const p = profiles?.find((item) => item.id === r.user_id);
    const parsed = parsePreferences(p?.preferences);
    return {
      id: r.user_id,
      role: r.role,
      name: p?.name ?? "Family member",
      avatar: p?.avatar ?? "🌱",
      ...(parsed.themeColor ? { themeColor: parsed.themeColor } : {}),
      preferences: parsed,
    };
  });

  const parentMembers = realMembers.filter((m) => m.role !== "child");
  const parentConfigs = parentMembers
    .map((m) => m.preferences?.householdConfig)
    .filter((c): c is HouseholdConfig => Boolean(c))
    .sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? ""));

  const latestConfig = parentConfigs[parentConfigs.length - 1];
  const mergedChildThemes: Record<string, ChildThemeColor> = {
    ...(latestConfig?.childThemes ?? {}),
  };
  for (const m of realMembers) {
    if (m.preferences?.themeColor) {
      mergedChildThemes[m.id] = m.preferences.themeColor;
    }
  }
  const mergedChoreOverrides = collectLatestOverrides<ChoreOverride>(
    parentMembers.map((m) => m.preferences?.householdConfig?.choreOverrides),
  );
  const mergedGoalOverrides = collectLatestOverrides<GoalOverride>([
    ...realMembers.map((m) => m.preferences?.goalOverrides),
    ...parentMembers.map((m) => m.preferences?.householdConfig?.goalOverrides),
  ]);

  const realChildNames = new Set(
    realMembers.filter((m) => m.role === "child").map((m) => m.name.trim().toLowerCase()),
  );
  const realMemberIds = new Set(realMembers.map((m) => m.id));
  const managedChildren = (latestConfig?.managedChildren ?? []).filter(
    (mc) => !realMemberIds.has(mc.id) && !realChildNames.has(mc.name.trim().toLowerCase()),
  );
  let childThemeIdx = 0;
  const members: Member[] = [
    ...realMembers.map((m) => {
      if (m.role !== "child") return m;
      const fallbackTheme = CHILD_THEMES[childThemeIdx++ % CHILD_THEMES.length]?.id ?? "sunset";
      return {
        ...m,
        themeColor: mergedChildThemes[m.id] ?? m.themeColor ?? fallbackTheme,
      };
    }),
    ...managedChildren.map((mc) => {
      const fallbackTheme = CHILD_THEMES[childThemeIdx++ % CHILD_THEMES.length]?.id ?? "sunset";
      return {
        id: mc.id,
        name: mc.name,
        avatar: mc.avatar,
        role: "child",
        isManaged: true as const,
        themeColor: mergedChildThemes[mc.id] ?? mc.themeColor ?? fallbackTheme,
        ...(mc.email ? { email: mc.email } : {}),
        ...(mc.inviteCode ? { inviteCode: mc.inviteCode } : {}),
      };
    }),
  ];

  const rawState = household.state as unknown as Partial<FamilyState>;
  const rawChores = Array.isArray(rawState.chores) ? rawState.chores : [];
  const rawGoals = Array.isArray(rawState.goals) ? rawState.goals : [];
  const rawLedger = Array.isArray(rawState.ledger) ? rawState.ledger : [];
  const rawNotices = Array.isArray(rawState.notifications) ? rawState.notifications : [];

  const customChores = Array.isArray(latestConfig?.customChores) ? latestConfig.customChores : [];
  const customLedger = Array.isArray(latestConfig?.customLedger) ? latestConfig.customLedger : [];
  const customNotices = Array.isArray(latestConfig?.customNotifications)
    ? latestConfig.customNotifications
    : [];

  const seenChoreIds = new Set<string>();
  const mergedChores: Chore[] = [];
  for (const chore of [...rawChores, ...customChores]) {
    if (seenChoreIds.has(chore.id)) continue;
    seenChoreIds.add(chore.id);
    const updated = mergeChoreWithOverride(chore, mergedChoreOverrides[chore.id]);
    if (updated) mergedChores.push(updated);
  }

  const customGoalsMap = new Map<string, Goal>();
  for (const g of rawGoals) {
    customGoalsMap.set(g.id, g);
  }
  for (const m of realMembers) {
    for (const g of m.preferences?.customGoals ?? []) {
      customGoalsMap.set(g.id, g);
    }
    for (const g of m.preferences?.householdConfig?.customGoals ?? []) {
      customGoalsMap.set(g.id, g);
    }
  }

  const mergedGoals: Goal[] = [];
  for (const goal of customGoalsMap.values()) {
    const updated = mergeGoalWithOverride(goal, mergedGoalOverrides[goal.id]);
    if (updated) mergedGoals.push(updated);
  }

  const mergedLedger: Entry[] = [...rawLedger, ...customLedger].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const myProfile = realMembers.find((m) => m.id === userId);
  const myPreferences: MemberPreferences = myProfile?.preferences ?? {
    celebrations: true,
  };
  const clearedAtMs = myPreferences.clearedNotificationsAt
    ? new Date(myPreferences.clearedNotificationsAt).getTime()
    : 0;

  const isChildUser = role.role === "child";
  const filteredNotices = [...rawNotices, ...customNotices].filter((notice) => {
    const noticeMs = new Date(notice.date).getTime();
    if (clearedAtMs && !Number.isNaN(noticeMs) && noticeMs <= clearedAtMs) {
      return false;
    }
    if (isChildUser) {
      return isChildNotification(notice) && notice.childId === userId;
    }
    return isParentNotification(notice);
  });

  const hasAnyChildren = members.some((m) => m.role === "child");
  const hasAnyContent =
    mergedChores.length > 0 || mergedLedger.length > 0 || mergedGoals.length > 0;
  const onboardingCompleted =
    latestConfig?.onboardingCompleted ?? (hasAnyChildren || hasAnyContent);

  const householdConfig: HouseholdConfig = {
    paydayFrequency: latestConfig?.paydayFrequency ?? defaultHouseholdConfig.paydayFrequency,
    paydayDay: latestConfig?.paydayDay ?? defaultHouseholdConfig.paydayDay,
    onboardingCompleted,
    ...(latestConfig?.parentPin ? { parentPin: latestConfig.parentPin } : {}),
    managedChildren: latestConfig?.managedChildren ?? [],
    pendingInvites: latestConfig?.pendingInvites ?? [],
    childThemes: mergedChildThemes,
    customChores,
    customLedger,
    customNotifications: customNotices,
    choreOverrides: mergedChoreOverrides,
    goalOverrides: mergedGoalOverrides,
    ...(latestConfig?.updatedAt ? { updatedAt: latestConfig.updatedAt } : {}),
  };

  return {
    id: household.id,
    name: household.name,
    code: household.code,
    userId,
    role: role.role,
    members,
    config: householdConfig,
    preferences: myPreferences,
    state: {
      chores: mergedChores,
      goals: mergedGoals,
      ledger: mergedLedger,
      notifications: filteredNotices,
    },
  };
}

function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

let activeResetPromise: Promise<Family | null> | null = null;

export async function ensureWeeklyReset(family: Family): Promise<Family> {
  if (family.role === "child") return family;

  const thisWeek = currentWeekKey();
  const todayDate = localDateKey();
  const todayDayIdx = today();

  const cfg = family.config ?? defaultHouseholdConfig;
  const realChildren = family.members.filter((m) => m.role === "child" && !m.isManaged);
  const storedManaged = cfg.managedChildren ?? [];

  // Auto-link any managed child that now has a matching real user_roles child account
  const linkMappings = new Map<string, string>();
  for (const mc of storedManaged) {
    const byName = realChildren.find(
      (rc) => rc.name.trim().toLowerCase() === mc.name.trim().toLowerCase(),
    );
    if (byName) {
      linkMappings.set(mc.id, byName.id);
    } else if (storedManaged.length === 1 && realChildren.length === 1) {
      const onlyReal = realChildren[0];
      const hasOwnData = family.state.chores.some((c) => c.childId === onlyReal?.id);
      if (onlyReal && !hasOwnData) {
        linkMappings.set(mc.id, onlyReal.id);
      }
    }
  }

  const realChildIds = new Set(realChildren.map((m) => m.id));
  const allChildIds = new Set(family.members.filter((m) => m.role === "child").map((m) => m.id));
  const existingOverrides = cfg.choreOverrides ?? {};
  const customChoreIds = new Set((cfg.customChores ?? []).map((c) => c.id));

  const staleChores = family.state.chores.filter((c) => {
    if (c.status !== "approved" || c.frequency === "once") return false;
    if (!allChildIds.has(c.childId)) return false;
    if (existingOverrides[c.id]?.replacedById || existingOverrides[c.id]?.deleted) {
      return false;
    }
    const choreWeek =
      c.weekKey ?? (c.submittedAt ? currentWeekKey(new Date(c.submittedAt)) : undefined);
    const submittedDate = c.submittedAt ? localDateKey(new Date(c.submittedAt)) : undefined;

    if (c.frequency === "daily") {
      return Boolean(
        (submittedDate && submittedDate < todayDate) || (choreWeek && choreWeek !== thisWeek),
      );
    }
    if (c.days && c.days.length > 1) {
      const dueToday = isChoreScheduledOnDay(c, todayDayIdx);
      return Boolean(
        (choreWeek && choreWeek !== thisWeek) ||
        (dueToday && submittedDate && submittedDate < todayDate),
      );
    }
    return Boolean(choreWeek && choreWeek !== thisWeek);
  });

  if (linkMappings.size === 0 && staleChores.length === 0) return family;

  if (!activeResetPromise) {
    activeResetPromise = (async () => {
      const nowIso = new Date().toISOString();
      let nextManaged = [...storedManaged];
      let nextCustomChores = [...(cfg.customChores ?? [])];
      let nextCustomLedger = [...(cfg.customLedger ?? [])];
      let nextCustomNotices = [...(cfg.customNotifications ?? [])];
      const nextChildThemes: Record<string, ChildThemeColor> = {
        ...(cfg.childThemes ?? {}),
      };
      const newOverrides: Record<string, ChoreOverride> = {};

      // 1. Remap linked managed children to real user_roles accounts
      if (linkMappings.size > 0) {
        for (const [oldId, realId] of linkMappings.entries()) {
          const oldMc = storedManaged.find((m) => m.id === oldId);
          const inheritedTheme = nextChildThemes[oldId] ?? oldMc?.themeColor;
          if (inheritedTheme && !nextChildThemes[realId]) {
            nextChildThemes[realId] = inheritedTheme;
          }
        }
        nextManaged = nextManaged.filter((mc) => !linkMappings.has(mc.id));

        const remainingCustomChores: Chore[] = [];
        for (const chore of nextCustomChores) {
          const mappedId = linkMappings.get(chore.childId);
          if (!mappedId) {
            remainingCustomChores.push(chore);
            continue;
          }
          if (chore.status === "todo" || chore.status === "rejected") {
            const rpcPayload = buildChoreRpcPayload({
              ...chore,
              childId: mappedId,
            });
            const { error } = await supabase.rpc("family_action", {
              action: "create_chore",
              payload: rpcPayload as Json,
            });
            if (error) {
              remainingCustomChores.push({ ...chore, childId: mappedId });
            }
          } else {
            remainingCustomChores.push({ ...chore, childId: mappedId });
          }
        }
        nextCustomChores = remainingCustomChores;

        nextCustomLedger = nextCustomLedger.map((e) => {
          const mappedId = linkMappings.get(e.childId);
          return mappedId ? { ...e, childId: mappedId } : e;
        });
        nextCustomNotices = nextCustomNotices.map((n) => {
          const mappedId = linkMappings.get(n.childId);
          return mappedId ? { ...n, childId: mappedId } : n;
        });
      }

      // 2. Auto-reset stale recurring chores
      for (const chore of staleChores) {
        const choreWeek =
          chore.weekKey ??
          (chore.submittedAt ? currentWeekKey(new Date(chore.submittedAt)) : undefined);
        const isNewWeek = Boolean(choreWeek && choreWeek !== thisWeek);
        const nextCompletedDays = isNewWeek ? [] : (chore.completedDays ?? []);
        const isManagedTarget = !realChildIds.has(chore.childId) || customChoreIds.has(chore.id);
        if (isManagedTarget) {
          nextCustomChores = nextCustomChores.map((c) => {
            if (c.id !== chore.id) return c;
            const resetChore: Chore = {
              ...c,
              status: "todo",
              weekKey: thisWeek,
              completedDays: nextCompletedDays,
            };
            delete resetChore.proof;
            delete resetChore.note;
            delete resetChore.submittedAt;
            return resetChore;
          });
        } else {
          const rpcPayload = buildChoreRpcPayload(
            {
              title: chore.title,
              childId: chore.childId,
              value: chore.value,
              day: chore.day,
              days: chore.days && chore.days.length > 0 ? chore.days : [chore.day],
              frequency: chore.frequency ?? "weekly",
              rewardMode: chore.rewardMode ?? "per_day",
              completedDays: nextCompletedDays,
              emoji: chore.emoji,
              description: chore.description ?? "",
              requirePhoto: Boolean(chore.requirePhoto),
              seriesId: chore.seriesId ?? chore.id,
            },
            thisWeek,
          );
          const { error } = await supabase.rpc("family_action", {
            action: "create_chore",
            payload: rpcPayload as Json,
          });
          if (!error) {
            newOverrides[chore.id] = {
              deleted: true,
              replacedById: `week-${thisWeek}`,
              updatedAt: nowIso,
            };
          }
        }
      }

      await updateMyPreferences(family.userId, (prefs) => ({
        ...prefs,
        customGoals: (prefs.customGoals ?? []).map((g) => {
          const mappedId = linkMappings.get(g.childId);
          return mappedId ? { ...g, childId: mappedId } : g;
        }),
        householdConfig: buildNextHouseholdConfig(
          family,
          {
            managedChildren: nextManaged,
            childThemes: nextChildThemes,
            customChores: nextCustomChores,
            customLedger: nextCustomLedger,
            customNotifications: nextCustomNotices,
            choreOverrides: {
              ...(cfg.choreOverrides ?? {}),
              ...newOverrides,
            },
          },
          nowIso,
        ),
      }));

      return loadFamilyFromSupabase(supabase, family.userId);
    })().finally(() => {
      activeResetPromise = null;
    });
  }

  const refreshed = await activeResetPromise;
  return refreshed ?? family;
}

export async function fetchAuthenticatedFamily(): Promise<Family | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const family = await loadFamilyFromSupabase(supabase, data.user.id);
  if (!family) return null;
  if (family.role !== "child") {
    return ensureWeeklyReset(family);
  }
  return family;
}

async function updateMyPreferences(
  userId: string,
  updater: (current: MemberPreferences) => MemberPreferences,
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);

  const current = parsePreferences(data?.preferences);
  const next = updater(current);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ preferences: next as unknown as Json })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);
}

function buildChoreRpcPayload(
  payload: Record<string, unknown>,
  fallbackWeekKey = currentWeekKey(),
): Record<string, unknown> {
  const rawDays = Array.isArray(payload["days"])
    ? (payload["days"] as number[]).map(Number)
    : [Number(payload["day"] ?? 0)];
  const primaryDay = rawDays[0] ?? Number(payload["day"] ?? 0);
  const frequency = (payload["frequency"] as ChoreFrequency | undefined) ?? "weekly";
  const rewardMode: ChoreRewardMode = payload["rewardMode"] === "all_days" ? "all_days" : "per_day";
  const completedDays = Array.isArray(payload["completedDays"])
    ? (payload["completedDays"] as number[]).map(Number)
    : [];

  const rpcPayload: Record<string, unknown> = {
    title: String(payload["title"] ?? "").trim(),
    childId: String(payload["childId"] ?? ""),
    value: Math.round(Number(payload["value"] ?? 0)),
    day: primaryDay,
    days: rawDays,
    frequency,
    rewardMode,
    completedDays,
    emoji: String(payload["emoji"] ?? "🧹"),
    requirePhoto: Boolean(payload["requirePhoto"]),
    weekKey: String(payload["weekKey"] ?? fallbackWeekKey),
  };

  if (typeof payload["description"] === "string" && payload["description"].trim()) {
    rpcPayload["description"] = payload["description"].trim();
  }
  if (typeof payload["seriesId"] === "string" && payload["seriesId"]) {
    rpcPayload["seriesId"] = payload["seriesId"];
  }
  return rpcPayload;
}

function buildChoreObject(payload: Record<string, unknown>): Chore {
  const rawDays = Array.isArray(payload["days"])
    ? (payload["days"] as number[]).map(Number)
    : [Number(payload["day"] ?? 0)];
  const primaryDay = rawDays[0] ?? Number(payload["day"] ?? 0);
  const frequency = (payload["frequency"] as ChoreFrequency | undefined) ?? "weekly";
  const rewardMode: ChoreRewardMode = payload["rewardMode"] === "all_days" ? "all_days" : "per_day";
  const completedDays = Array.isArray(payload["completedDays"])
    ? (payload["completedDays"] as number[]).map(Number)
    : [];

  const chore: Chore = {
    id: String(payload["id"] ?? crypto.randomUUID()),
    title: String(payload["title"] ?? "").trim(),
    childId: String(payload["childId"] ?? ""),
    day: primaryDay,
    days: rawDays,
    frequency,
    rewardMode,
    completedDays,
    value: Math.round(Number(payload["value"] ?? 0)),
    emoji: String(payload["emoji"] ?? "🧹"),
    status: "todo",
    requirePhoto: Boolean(payload["requirePhoto"]),
    weekKey: currentWeekKey(),
  };
  if (typeof payload["description"] === "string" && payload["description"].trim()) {
    chore.description = payload["description"].trim();
  }
  return chore;
}

export async function compressPhotoProof(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the selected photo"));
    reader.readAsDataURL(file);
  });

  const compressedDataUrl = await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 800;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

  return compressedDataUrl;
}

export async function uploadOrEncodePhotoProof(
  userId: string,
  file: File,
  isDemo: boolean,
): Promise<string> {
  const compressed = await compressPhotoProof(file);
  if (isDemo) return compressed;

  try {
    const res = await fetch(compressed);
    const blob = await res.blob();
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("chore-proof")
      .upload(path, blob, { contentType: "image/jpeg" });
    if (!error) return path;
  } catch {
    // Fallback cleanly to compressed inline JPEG data URL if storage bucket is unavailable
  }

  return compressed;
}

export async function resolveProofUrl(proof: string, isDemo: boolean): Promise<string> {
  if (!proof) return "";
  if (
    isDemo ||
    proof.startsWith("data:") ||
    proof.startsWith("blob:") ||
    proof.startsWith("http://") ||
    proof.startsWith("https://")
  ) {
    return proof;
  }
  const { data } = await supabase.storage.from("chore-proof").createSignedUrl(proof, 600);
  return data?.signedUrl ?? "";
}

export async function executeFamilyAction(
  family: Family,
  action: string,
  payload: Record<string, unknown>,
): Promise<Family> {
  const nowIso = new Date().toISOString();
  const cfg = family.config ?? defaultHouseholdConfig;
  const customChores = cfg.customChores ?? [];
  const customLedger = cfg.customLedger ?? [];
  const customNotices = cfg.customNotifications ?? [];
  const realChildIds = new Set(
    family.members.filter((m) => m.role === "child" && !m.isManaged).map((m) => m.id),
  );

  if (action === "complete_onboarding") {
    const parentName = String(payload["parentName"] ?? "").trim();
    const parentAvatar = String(payload["parentAvatar"] ?? "👩🏻");
    const paydayFrequency = payload["paydayFrequency"] === "monthly" ? "monthly" : "weekly";
    const paydayDay = Number(payload["paydayDay"] ?? 4);
    const parentPin = typeof payload["parentPin"] === "string" ? payload["parentPin"].trim() : "";
    const managedChildren = Array.isArray(payload["managedChildren"])
      ? (payload["managedChildren"] as ManagedChild[])
      : (cfg.managedChildren ?? []);
    const pendingInvites = Array.isArray(payload["pendingInvites"])
      ? (payload["pendingInvites"] as PendingInvite[])
      : (cfg.pendingInvites ?? []);
    const starterChores = Array.isArray(payload["starterChores"])
      ? (payload["starterChores"] as Array<Record<string, unknown>>)
      : [];

    const newCustomChores: Chore[] = [...customChores];
    for (const sc of starterChores) {
      const targetChildId = String(sc["childId"] ?? "");
      if (!targetChildId) continue;
      if (realChildIds.has(targetChildId)) {
        const rpcPayload = buildChoreRpcPayload(sc);
        const { error } = await supabase.rpc("family_action", {
          action: "create_chore",
          payload: rpcPayload as Json,
        });
        if (error) throw new Error(error.message);
      } else {
        newCustomChores.push(buildChoreObject(sc));
      }
    }

    const { data: currentData, error: fetchErr } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", family.userId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const parsedPrefs = parsePreferences(currentData?.preferences);
    const onboardingThemes: Record<string, ChildThemeColor> = {
      ...(cfg.childThemes ?? {}),
    };
    for (const mc of managedChildren) {
      if (mc.themeColor) onboardingThemes[mc.id] = mc.themeColor;
    }
    const nextConfig = buildNextHouseholdConfig(
      family,
      {
        paydayFrequency,
        paydayDay,
        onboardingCompleted: true,
        parentPin,
        managedChildren,
        pendingInvites,
        childThemes: onboardingThemes,
        customChores: newCustomChores,
      },
      nowIso,
    );

    const nextPrefs: MemberPreferences = {
      ...parsedPrefs,
      celebrations: parsedPrefs.celebrations ?? true,
      householdConfig: nextConfig,
    };

    const { error } = await supabase
      .from("profiles")
      .update({
        ...(parentName ? { name: parentName } : {}),
        avatar: parentAvatar,
        preferences: nextPrefs as unknown as Json,
      })
      .eq("id", family.userId);
    if (error) throw new Error(error.message);
  } else if (action === "add_managed_child") {
    const name = String(payload["name"] ?? "").trim();
    const avatar = String(payload["avatar"] ?? "🦊");
    const email = typeof payload["email"] === "string" ? payload["email"].trim() : "";
    const inviteCode =
      typeof payload["inviteCode"] === "string" ? payload["inviteCode"].trim() : "";
    const themeColor: ChildThemeColor = isChildThemeColor(payload["themeColor"])
      ? payload["themeColor"]
      : "sunset";
    if (!name) throw new Error("Please enter the child's name");

    const newChild: ManagedChild = {
      id: `child-${crypto.randomUUID()}`,
      name,
      avatar,
      role: "child",
      themeColor,
      isManaged: true,
      ...(email ? { email } : {}),
      ...(inviteCode ? { inviteCode } : {}),
    };

    const nextInvites = [...(cfg.pendingInvites ?? [])];
    if (inviteCode) {
      nextInvites.push({
        id: crypto.randomUUID(),
        name,
        ...(email ? { email } : {}),
        role: "child",
        code: inviteCode,
        createdAt: nowIso,
      });
    }

    await updateMyPreferences(family.userId, (prefs) => ({
      ...prefs,
      householdConfig: buildNextHouseholdConfig(
        family,
        {
          managedChildren: [...(cfg.managedChildren ?? []), newChild],
          pendingInvites: nextInvites,
          childThemes: {
            ...(cfg.childThemes ?? {}),
            [newChild.id]: themeColor,
          },
        },
        nowIso,
      ),
    }));
  } else if (action === "remove_managed_child") {
    const id = String(payload["id"] ?? "");
    await updateMyPreferences(family.userId, (prefs) => ({
      ...prefs,
      customGoals: (prefs.customGoals ?? []).filter((g) => g.childId !== id),
      householdConfig: buildNextHouseholdConfig(
        family,
        {
          managedChildren: (cfg.managedChildren ?? []).filter((mc) => mc.id !== id),
          customChores: customChores.filter((c) => c.childId !== id),
          customLedger: customLedger.filter((e) => e.childId !== id),
        },
        nowIso,
      ),
    }));
  } else if (action === "save_pending_invite") {
    const invite: PendingInvite = {
      id: crypto.randomUUID(),
      name: String(payload["name"] ?? "").trim() || "Family member",
      ...(typeof payload["email"] === "string" && payload["email"].trim()
        ? { email: payload["email"].trim() }
        : {}),
      role: payload["role"] === "co_parent" ? "co_parent" : "child",
      code: String(payload["code"] ?? ""),
      createdAt: nowIso,
    };
    await updateMyPreferences(family.userId, (prefs) => ({
      ...prefs,
      householdConfig: buildNextHouseholdConfig(
        family,
        {
          pendingInvites: [...(cfg.pendingInvites ?? []), invite],
        },
        nowIso,
      ),
    }));
  } else if (action === "create_chore") {
    const childId = String(payload["childId"] ?? "");
    if (realChildIds.has(childId)) {
      const rpcPayload = buildChoreRpcPayload(payload);
      const { error } = await supabase.rpc("family_action", {
        action: "create_chore",
        payload: rpcPayload as Json,
      });
      if (error) throw new Error(error.message);
    } else {
      const nextChore = buildChoreObject(payload);
      await updateMyPreferences(family.userId, (prefs) => ({
        ...prefs,
        householdConfig: buildNextHouseholdConfig(
          family,
          { customChores: [...customChores, nextChore] },
          nowIso,
        ),
      }));
    }
  } else if (action === "edit_chore") {
    const id = String(payload["id"] ?? "");
    const existing = family.state.chores.find((c) => c.id === id);
    if (!existing) throw new Error("Chore not found");

    const nextTitle =
      typeof payload["title"] === "string" ? payload["title"].trim() : existing.title;
    const nextChildId =
      typeof payload["childId"] === "string" ? payload["childId"] : existing.childId;
    const nextValue =
      typeof payload["value"] === "number" ? Math.round(payload["value"]) : existing.value;
    const nextDays = Array.isArray(payload["days"])
      ? (payload["days"] as number[]).map(Number)
      : (existing.days ?? [existing.day]);
    const nextDay = nextDays[0] ?? Number(payload["day"] ?? existing.day);
    const nextFrequency =
      (payload["frequency"] as ChoreFrequency | undefined) ?? existing.frequency ?? "weekly";
    const nextRewardMode: ChoreRewardMode =
      payload["rewardMode"] === "all_days"
        ? "all_days"
        : payload["rewardMode"] === "per_day"
          ? "per_day"
          : (existing.rewardMode ?? "per_day");
    const nextEmoji = typeof payload["emoji"] === "string" ? payload["emoji"] : existing.emoji;
    const nextDescription =
      typeof payload["description"] === "string"
        ? payload["description"].trim()
        : (existing.description ?? "");
    const nextRequirePhoto =
      typeof payload["requirePhoto"] === "boolean"
        ? payload["requirePhoto"]
        : Boolean(existing.requirePhoto);

    const isCustom = customChores.some((c) => c.id === id);
    if (isCustom || !realChildIds.has(nextChildId)) {
      let nextCustomChores = customChores.map((c) => {
        if (c.id !== id) return c;
        const updated: Chore = {
          ...c,
          title: nextTitle,
          childId: nextChildId,
          value: nextValue,
          day: nextDay,
          days: nextDays,
          frequency: nextFrequency,
          rewardMode: nextRewardMode,
          emoji: nextEmoji,
          requirePhoto: nextRequirePhoto,
        };
        if (nextDescription) updated.description = nextDescription;
        else delete updated.description;
        return updated;
      });

      const nextOverrides = { ...(cfg.choreOverrides ?? {}) };
      if (!isCustom) {
        // Migrating a DB chore reassigned to a managed child into customChores
        const migrated: Chore = {
          ...existing,
          id: crypto.randomUUID(),
          title: nextTitle,
          childId: nextChildId,
          value: nextValue,
          day: nextDay,
          days: nextDays,
          frequency: nextFrequency,
          rewardMode: nextRewardMode,
          emoji: nextEmoji,
          requirePhoto: nextRequirePhoto,
          ...(nextDescription ? { description: nextDescription } : {}),
        };
        nextCustomChores = [...nextCustomChores, migrated];
        nextOverrides[id] = {
          deleted: true,
          replacedById: migrated.id,
          updatedAt: nowIso,
        };
      }

      await updateMyPreferences(family.userId, (prefs) => ({
        ...prefs,
        householdConfig: buildNextHouseholdConfig(
          family,
          {
            customChores: nextCustomChores,
            choreOverrides: nextOverrides,
          },
          nowIso,
        ),
      }));
    } else {
      const coreFieldsChanged =
        nextTitle !== existing.title ||
        nextValue !== existing.value ||
        nextChildId !== existing.childId ||
        nextDay !== existing.day ||
        nextRewardMode !== (existing.rewardMode ?? "per_day");

      if ((existing.status === "todo" || existing.status === "rejected") && coreFieldsChanged) {
        const rpcPayload = buildChoreRpcPayload(
          {
            title: nextTitle,
            childId: nextChildId,
            value: nextValue,
            day: nextDay,
            days: nextDays,
            frequency: nextFrequency,
            rewardMode: nextRewardMode,
            completedDays: existing.completedDays ?? [],
            emoji: nextEmoji,
            description: nextDescription,
            requirePhoto: nextRequirePhoto,
            seriesId: existing.seriesId ?? existing.id,
          },
          existing.weekKey ?? currentWeekKey(),
        );
        const { error } = await supabase.rpc("family_action", {
          action: "create_chore",
          payload: rpcPayload as Json,
        });
        if (error) throw new Error(error.message);

        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              choreOverrides: {
                ...(cfg.choreOverrides ?? {}),
                [id]: {
                  deleted: true,
                  replacedById: `edited-${Date.now()}`,
                  updatedAt: nowIso,
                },
              },
            },
            nowIso,
          ),
        }));
      } else {
        const override: ChoreOverride = {
          title: nextTitle,
          childId: nextChildId,
          day: nextDay,
          days: nextDays,
          frequency: nextFrequency,
          rewardMode: nextRewardMode,
          value: nextValue,
          emoji: nextEmoji,
          description: nextDescription,
          requirePhoto: nextRequirePhoto,
          updatedAt: nowIso,
        };
        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              choreOverrides: {
                ...(cfg.choreOverrides ?? {}),
                [id]: override,
              },
            },
            nowIso,
          ),
        }));
      }
    }
  } else if (action === "delete_chore") {
    const id = String(payload["id"] ?? "");
    const isCustom = customChores.some((c) => c.id === id);
    await updateMyPreferences(family.userId, (prefs) => ({
      ...prefs,
      householdConfig: buildNextHouseholdConfig(
        family,
        isCustom
          ? { customChores: customChores.filter((c) => c.id !== id) }
          : {
              choreOverrides: {
                ...(cfg.choreOverrides ?? {}),
                [id]: { deleted: true, updatedAt: nowIso },
              },
            },
        nowIso,
      ),
    }));
  } else if (action === "reset_chore") {
    const targetId = typeof payload["id"] === "string" ? payload["id"] : null;
    const targets = targetId
      ? family.state.chores.filter((c) => c.id === targetId)
      : family.state.chores.filter((c) => c.status === "approved" && c.frequency !== "once");

    const newOverrides: Record<string, ChoreOverride> = {};
    let nextCustomChores = [...customChores];

    for (const chore of targets) {
      const isCustom = nextCustomChores.some((c) => c.id === chore.id);
      if (isCustom || !realChildIds.has(chore.childId)) {
        nextCustomChores = nextCustomChores.map((c) => {
          if (c.id !== chore.id) return c;
          const resetChore: Chore = {
            ...c,
            status: "todo",
            weekKey: currentWeekKey(),
            completedDays: [],
          };
          delete resetChore.proof;
          delete resetChore.note;
          delete resetChore.submittedAt;
          return resetChore;
        });
      } else {
        const rpcPayload = buildChoreRpcPayload({
          title: chore.title,
          childId: chore.childId,
          value: chore.value,
          day: chore.day,
          days: chore.days ?? [chore.day],
          frequency: chore.frequency ?? "weekly",
          rewardMode: chore.rewardMode ?? "per_day",
          completedDays: [],
          emoji: chore.emoji,
          description: chore.description ?? "",
          requirePhoto: Boolean(chore.requirePhoto),
          seriesId: chore.seriesId ?? chore.id,
        });
        const { error } = await supabase.rpc("family_action", {
          action: "create_chore",
          payload: rpcPayload as Json,
        });
        if (error) throw new Error(error.message);
        newOverrides[chore.id] = {
          deleted: true,
          replacedById: `reset-${Date.now()}`,
          updatedAt: nowIso,
        };
      }
    }

    await updateMyPreferences(family.userId, (prefs) => ({
      ...prefs,
      householdConfig: buildNextHouseholdConfig(
        family,
        {
          customChores: nextCustomChores,
          choreOverrides: {
            ...(cfg.choreOverrides ?? {}),
            ...newOverrides,
          },
        },
        nowIso,
      ),
    }));
  } else if (action === "complete") {
    const id = String(payload["id"] ?? "");
    const proof = typeof payload["proof"] === "string" ? payload["proof"] : "";
    const chore = family.state.chores.find((c) => c.id === id);
    if (!chore) throw new Error("Chore not found");

    const isCustom = customChores.some((c) => c.id === id);
    const canUseSql = !isCustom && family.role === "child" && chore.childId === family.userId;

    if (canUseSql) {
      const { error } = await supabase.rpc("family_action", {
        action: "complete",
        payload: payload as Json,
      });
      if (error) throw new Error(error.message);
      void notifyHouseholdPush({ data: { action: "complete" } }).catch(() => undefined);
    } else {
      // Managed child or Parent Kid Mode submission
      const notice: Notice = {
        id: crypto.randomUUID(),
        title: chore.title,
        message: "Ready for parent approval",
        childId: chore.childId,
        date: nowIso,
        targetRole: "parent",
      };
      if (isCustom) {
        const nextCustomChores = customChores.map((c) =>
          c.id === id
            ? {
                ...c,
                status: "pending" as const,
                ...(proof ? { proof } : {}),
                submittedAt: nowIso,
              }
            : c,
        );
        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              customChores: nextCustomChores,
              customNotifications: [...customNotices, notice],
            },
            nowIso,
          ),
        }));
      } else {
        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              choreOverrides: {
                ...(cfg.choreOverrides ?? {}),
                [id]: {
                  ...(cfg.choreOverrides?.[id] ?? {}),
                  status: "pending",
                  ...(proof ? { proof } : {}),
                  submittedAt: nowIso,
                  updatedAt: nowIso,
                },
              },
              customNotifications: [...customNotices, notice],
            },
            nowIso,
          ),
        }));
      }
    }
  } else if (action === "approve" || action === "reject") {
    const id = String(payload["id"] ?? "");
    const chore = family.state.chores.find((c) => c.id === id);
    if (!chore) throw new Error("Chore not found");

    const isCustom = customChores.some((c) => c.id === id);
    const hasLocalPendingOverride = cfg.choreOverrides?.[id]?.status === "pending";
    const totalDays = choreScheduledDaysCount(chore);
    const mode = choreRewardMode(chore);
    const dayDone = nextDayToComplete(chore);
    const nextCompletedDays = Array.from(new Set([...(chore.completedDays ?? []), dayDone])).sort(
      (a, b) => a - b,
    );
    const isIntermediateAllDays =
      action === "approve" &&
      totalDays > 1 &&
      mode === "all_days" &&
      nextCompletedDays.length < totalDays;

    if (isIntermediateAllDays) {
      const progressNotice: Notice = {
        id: crypto.randomUUID(),
        title: chore.title,
        message: `Day confirmed (${nextCompletedDays.length}/${totalDays}) — complete all ${totalDays} days to earn ${money(chore.value)}!`,
        childId: chore.childId,
        date: nowIso,
        targetRole: "child",
      };
      if (isCustom) {
        const nextCustomChores = customChores.map((c) => {
          if (c.id !== id) return c;
          const updated: Chore = {
            ...c,
            status: "todo",
            completedDays: nextCompletedDays,
          };
          delete updated.proof;
          delete updated.note;
          delete updated.submittedAt;
          return updated;
        });
        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              customChores: nextCustomChores,
              customNotifications: [...customNotices, progressNotice],
            },
            nowIso,
          ),
        }));
      } else if (hasLocalPendingOverride) {
        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              choreOverrides: {
                ...(cfg.choreOverrides ?? {}),
                [id]: {
                  ...(cfg.choreOverrides?.[id] ?? {}),
                  status: "todo",
                  completedDays: nextCompletedDays,
                  proof: "",
                  note: "",
                  updatedAt: nowIso,
                },
              },
              customNotifications: [...customNotices, progressNotice],
            },
            nowIso,
          ),
        }));
      } else {
        const rpcPayload = buildChoreRpcPayload({
          title: chore.title,
          childId: chore.childId,
          value: chore.value,
          day: chore.day,
          days: chore.days ?? [chore.day],
          frequency: chore.frequency ?? "weekly",
          rewardMode: chore.rewardMode ?? "all_days",
          completedDays: nextCompletedDays,
          emoji: chore.emoji,
          description: chore.description ?? "",
          requirePhoto: Boolean(chore.requirePhoto),
          seriesId: chore.seriesId ?? chore.id,
        });
        const { error } = await supabase.rpc("family_action", {
          action: "create_chore",
          payload: rpcPayload as Json,
        });
        if (error) throw new Error(error.message);

        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              choreOverrides: {
                ...(cfg.choreOverrides ?? {}),
                [id]: {
                  deleted: true,
                  replacedById: `all-days-${Date.now()}`,
                  updatedAt: nowIso,
                },
              },
              customNotifications: [...customNotices, progressNotice],
            },
            nowIso,
          ),
        }));
      }
      void notifyHouseholdPush({ data: { action: "approve" } }).catch(() => undefined);
    } else if (!isCustom && !hasLocalPendingOverride) {
      const { error } = await supabase.rpc("family_action", {
        action,
        payload: payload as Json,
      });
      if (error) throw new Error(error.message);
      if (action === "approve" && totalDays > 1) {
        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              choreOverrides: {
                ...(cfg.choreOverrides ?? {}),
                [id]: {
                  ...(cfg.choreOverrides?.[id] ?? {}),
                  completedDays: nextCompletedDays,
                  updatedAt: nowIso,
                },
              },
            },
            nowIso,
          ),
        }));
      }
      void notifyHouseholdPush({ data: { action } }).catch(() => undefined);
    } else {
      const note = typeof payload["note"] === "string" ? payload["note"] : "";
      const nextStatus = action === "approve" ? ("approved" as const) : ("rejected" as const);
      const nextNotice: Notice = {
        id: crypto.randomUUID(),
        title: chore.title,
        message:
          action === "approve" ? "Approved — pocket money earned!" : `Needs another try: ${note}`,
        childId: chore.childId,
        date: nowIso,
        targetRole: "child",
      };
      const nextLedger =
        action === "approve"
          ? [
              ...customLedger,
              {
                id: crypto.randomUUID(),
                childId: chore.childId,
                title: chore.title,
                amount: chore.value,
                type: "earning",
                date: nowIso,
              },
            ]
          : customLedger;

      if (isCustom) {
        const nextCustomChores = customChores.map((c) => {
          if (c.id !== id) return c;
          return {
            ...c,
            status: nextStatus,
            ...(action === "approve" ? { completedDays: nextCompletedDays } : {}),
            ...(action === "reject" ? { note } : {}),
          };
        });
        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              customChores: nextCustomChores,
              customLedger: nextLedger,
              customNotifications: [...customNotices, nextNotice],
            },
            nowIso,
          ),
        }));
      } else {
        await updateMyPreferences(family.userId, (prefs) => ({
          ...prefs,
          householdConfig: buildNextHouseholdConfig(
            family,
            {
              choreOverrides: {
                ...(cfg.choreOverrides ?? {}),
                [id]: {
                  ...(cfg.choreOverrides?.[id] ?? {}),
                  status: nextStatus,
                  ...(action === "approve" ? { completedDays: nextCompletedDays } : {}),
                  ...(action === "reject" ? { note } : {}),
                  updatedAt: nowIso,
                },
              },
              customLedger: nextLedger,
              customNotifications: [...customNotices, nextNotice],
            },
            nowIso,
          ),
        }));
      }
    }
  } else if (action === "pay") {
    const childId = String(payload["childId"] ?? "");
    const totalDue = balance(family.state, childId);
    if (totalDue <= 0) {
      throw new Error("Nothing to pay");
    }

    const customBalance = customLedger
      .filter((e) => e.childId === childId)
      .reduce((sum, e) => sum + e.amount, 0);
    const dbBalance = totalDue - customBalance;

    if (dbBalance > 0 && realChildIds.has(childId)) {
      const { error } = await supabase.rpc("family_action", {
        action: "pay",
        payload: { childId } as Json,
      });
      if (error) throw new Error(error.message);
    }

    if (customBalance > 0) {
      const paymentEntry: Entry = {
        id: crypto.randomUUID(),
        childId,
        title: "Pocket money paid",
        amount: -customBalance,
        type: "payment",
        date: nowIso,
      };
      await updateMyPreferences(family.userId, (prefs) => ({
        ...prefs,
        householdConfig: buildNextHouseholdConfig(
          family,
          { customLedger: [...customLedger, paymentEntry] },
          nowIso,
        ),
      }));
    }
  } else if (action === "goal") {
    const title = String(payload["title"] ?? "").trim();
    const emoji = String(payload["emoji"] ?? "🎯");
    const target = Math.round(Number(payload["target"] ?? 0));
    const childId = String(payload["childId"] ?? family.userId);
    if (!title || target <= 0) {
      throw new Error("Enter a goal name and target amount");
    }

    if (family.role === "child" && childId === family.userId) {
      const { error } = await supabase.rpc("family_action", {
        action: "goal",
        payload: { title, emoji, target } as Json,
      });
      if (error) throw new Error(error.message);
    } else {
      const newGoal: Goal = {
        id: crypto.randomUUID(),
        childId,
        title,
        emoji,
        target,
        saved: 0,
      };
      await updateMyPreferences(family.userId, (prefs) => ({
        ...prefs,
        customGoals: [...(prefs.customGoals ?? []), newGoal],
      }));
    }
  } else if (
    action === "allocate" ||
    action === "withdraw_goal" ||
    action === "edit_goal" ||
    action === "delete_goal" ||
    action === "achieve_goal"
  ) {
    const id = String(payload["id"] ?? "");
    const g = family.state.goals.find((item) => item.id === id);
    if (!g) throw new Error("Goal not found");

    let nextOverride: GoalOverride;
    if (action === "allocate") {
      const amount = Math.round(Number(payload["amount"] ?? 0));
      const remaining = g.target - g.saved;
      if (amount <= 0 || remaining <= 0 || amount > remaining) {
        throw new Error("Amount exceeds goal target");
      }
      const nextSaved = Math.min(g.target, g.saved + amount);
      const achieved = nextSaved >= g.target;
      nextOverride = {
        saved: nextSaved,
        achieved,
        ...(achieved ? { achievedAt: nowIso } : {}),
        updatedAt: nowIso,
      };
    } else if (action === "withdraw_goal") {
      const amount = Math.round(Number(payload["amount"] ?? 0));
      if (amount <= 0) throw new Error("Enter an amount above £0.00");
      const nextSaved = Math.max(0, g.saved - amount);
      nextOverride = {
        saved: nextSaved,
        achieved: nextSaved >= g.target,
        updatedAt: nowIso,
      };
    } else if (action === "edit_goal") {
      const nextTitle = typeof payload["title"] === "string" ? payload["title"].trim() : g.title;
      const nextEmoji = typeof payload["emoji"] === "string" ? payload["emoji"] : g.emoji;
      const nextTarget =
        typeof payload["target"] === "number" && payload["target"] > 0
          ? Math.round(payload["target"])
          : g.target;
      const nextSaved =
        typeof payload["saved"] === "number" && payload["saved"] >= 0
          ? Math.min(nextTarget, Math.round(payload["saved"]))
          : Math.min(nextTarget, g.saved);
      const achieved = nextSaved >= nextTarget;
      nextOverride = {
        title: nextTitle,
        emoji: nextEmoji,
        target: nextTarget,
        saved: nextSaved,
        achieved,
        ...(achieved ? { achievedAt: g.achievedAt ?? nowIso } : {}),
        updatedAt: nowIso,
      };
    } else if (action === "achieve_goal") {
      nextOverride = {
        saved: g.target,
        achieved: true,
        achievedAt: nowIso,
        updatedAt: nowIso,
      };
    } else {
      nextOverride = {
        deleted: true,
        updatedAt: nowIso,
      };
    }

    await updateMyPreferences(family.userId, (prefs) => ({
      ...prefs,
      goalOverrides: {
        ...(prefs.goalOverrides ?? {}),
        [id]: { ...(prefs.goalOverrides?.[id] ?? {}), ...nextOverride },
      },
    }));
  } else if (action === "update_config") {
    const paydayFrequency = payload["paydayFrequency"] === "monthly" ? "monthly" : "weekly";
    const paydayDay = Number(payload["paydayDay"] ?? 4);
    const hasPinField = "parentPin" in payload;
    const parentPin =
      hasPinField && typeof payload["parentPin"] === "string"
        ? payload["parentPin"].trim()
        : undefined;

    await updateMyPreferences(family.userId, (prefs) => ({
      ...prefs,
      householdConfig: buildNextHouseholdConfig(
        family,
        {
          paydayFrequency,
          paydayDay,
          ...(hasPinField ? { parentPin: parentPin ?? "" } : {}),
        },
        nowIso,
      ),
    }));
  } else if (action === "clear_notifications") {
    await updateMyPreferences(family.userId, (prefs) => ({
      ...prefs,
      clearedNotificationsAt: nowIso,
    }));
  } else if (action === "set_child_theme") {
    const childId = String(payload["childId"] ?? "");
    const themeColor: ChildThemeColor = isChildThemeColor(payload["themeColor"])
      ? payload["themeColor"]
      : "sunset";

    if (family.role === "child" && childId === family.userId) {
      await updateMyPreferences(family.userId, (prefs) => ({
        ...prefs,
        themeColor,
      }));
    } else {
      const nextManaged = (cfg.managedChildren ?? []).map((mc) =>
        mc.id === childId ? { ...mc, themeColor } : mc,
      );
      await updateMyPreferences(family.userId, (prefs) => ({
        ...prefs,
        householdConfig: buildNextHouseholdConfig(
          family,
          {
            managedChildren: nextManaged,
            childThemes: {
              ...(cfg.childThemes ?? {}),
              [childId]: themeColor,
            },
          },
          nowIso,
        ),
      }));
    }
  } else if (action === "update_profile") {
    const name = String(payload["name"] ?? "").trim();
    const avatar = String(payload["avatar"] ?? "🌱");
    const celebrations = Boolean(payload["celebrations"]);
    const themeColor = isChildThemeColor(payload["themeColor"]) ? payload["themeColor"] : undefined;

    const { data: currentData, error: fetchErr } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", family.userId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const nextPrefs: MemberPreferences = {
      ...parsePreferences(currentData?.preferences),
      celebrations,
      ...(themeColor ? { themeColor } : {}),
    };

    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        avatar,
        preferences: nextPrefs as unknown as Json,
      })
      .eq("id", family.userId);
    if (error) throw new Error(error.message);
  } else {
    throw new Error(`Unsupported action: ${action}`);
  }

  const updated = await loadFamilyFromSupabase(supabase, family.userId);
  if (!updated) throw new Error("Could not reload family state");
  return updated;
}
