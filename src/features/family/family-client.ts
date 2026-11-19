import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  balance,
  currentWeekKey,
  defaultHouseholdConfig,
  isChoreScheduledOnDay,
  today,
  type Chore,
  type ChoreFrequency,
  type ChoreOverride,
  type Family,
  type FamilyState,
  type Goal,
  type GoalOverride,
  type HouseholdConfig,
  type Member,
  type MemberPreferences,
  type Notice,
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
    ...(override.value !== undefined ? { value: override.value } : {}),
    ...(override.emoji !== undefined ? { emoji: override.emoji } : {}),
    ...(override.description !== undefined ? { description: override.description } : {}),
    ...(override.requirePhoto !== undefined ? { requirePhoto: override.requirePhoto } : {}),
    ...(override.weekKey !== undefined ? { weekKey: override.weekKey } : {}),
    ...(override.seriesId !== undefined ? { seriesId: override.seriesId } : {}),
  };
  if (override.description === "") {
    delete merged.description;
  }
  return merged;
}

function mergeGoalWithOverride(goal: Goal, override?: GoalOverride): Goal | null {
  if (!override) return goal;
  if (override.deleted) return null;
  const merged: Goal = {
    ...goal,
    ...(override.title !== undefined ? { title: override.title } : {}),
    ...(override.emoji !== undefined ? { emoji: override.emoji } : {}),
    ...(override.target !== undefined ? { target: override.target } : {}),
    ...(override.saved !== undefined ? { saved: override.saved } : {}),
    ...(override.achieved !== undefined ? { achieved: override.achieved } : {}),
    ...(override.achievedAt !== undefined ? { achievedAt: override.achievedAt } : {}),
  };
  return merged;
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

  const members: Member[] = (roles ?? []).map((r) => {
    const p = profiles?.find((item) => item.id === r.user_id);
    return {
      id: r.user_id,
      role: r.role,
      name: p?.name ?? "Family member",
      avatar: p?.avatar ?? "🌱",
      preferences: parsePreferences(p?.preferences),
    };
  });

  const parentMembers = members.filter((m) => m.role !== "child");
  const parentConfigs = parentMembers
    .map((m) => m.preferences?.householdConfig)
    .filter((c): c is HouseholdConfig => Boolean(c))
    .sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? ""));

  const latestConfig = parentConfigs[parentConfigs.length - 1];
  const mergedChoreOverrides = collectLatestOverrides<ChoreOverride>(
    parentMembers.map((m) => m.preferences?.householdConfig?.choreOverrides),
  );
  const mergedGoalOverrides = collectLatestOverrides<GoalOverride>([
    ...members.map((m) => m.preferences?.goalOverrides),
    ...parentMembers.map((m) => m.preferences?.householdConfig?.goalOverrides),
  ]);

  const rawState = household.state as unknown as Partial<FamilyState>;
  const rawChores = Array.isArray(rawState.chores) ? rawState.chores : [];
  const rawGoals = Array.isArray(rawState.goals) ? rawState.goals : [];
  const rawLedger = Array.isArray(rawState.ledger) ? rawState.ledger : [];
  const rawNotices = Array.isArray(rawState.notifications) ? rawState.notifications : [];

  const mergedChores: Chore[] = [];
  for (const chore of rawChores) {
    const updated = mergeChoreWithOverride(chore, mergedChoreOverrides[chore.id]);
    if (updated) mergedChores.push(updated);
  }

  const customGoalsMap = new Map<string, Goal>();
  for (const g of rawGoals) {
    customGoalsMap.set(g.id, g);
  }
  for (const m of members) {
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

  const myProfile = members.find((m) => m.id === userId);
  const myPreferences: MemberPreferences = myProfile?.preferences ?? { celebrations: true };
  const clearedAtMs = myPreferences.clearedNotificationsAt
    ? new Date(myPreferences.clearedNotificationsAt).getTime()
    : 0;

  const isChildUser = role.role === "child";
  const filteredNotices = rawNotices.filter((notice) => {
    const noticeMs = new Date(notice.date).getTime();
    if (clearedAtMs && !Number.isNaN(noticeMs) && noticeMs <= clearedAtMs) {
      return false;
    }
    if (isChildUser) {
      return isChildNotification(notice) && notice.childId === userId;
    }
    return isParentNotification(notice);
  });

  const householdConfig: HouseholdConfig = {
    paydayFrequency: latestConfig?.paydayFrequency ?? defaultHouseholdConfig.paydayFrequency,
    paydayDay: latestConfig?.paydayDay ?? defaultHouseholdConfig.paydayDay,
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
      ledger: rawLedger,
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
  const childIds = new Set(family.members.filter((m) => m.role === "child").map((m) => m.id));
  const existingOverrides = family.config?.choreOverrides ?? {};

  const staleChores = family.state.chores.filter((c) => {
    if (c.status !== "approved" || c.frequency === "once") return false;
    if (!childIds.has(c.childId)) return false;
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

  if (staleChores.length === 0) return family;

  if (!activeResetPromise) {
    activeResetPromise = (async () => {
      const nowIso = new Date().toISOString();
      const newOverrides: Record<string, ChoreOverride> = {};
      for (const chore of staleChores) {
        const rpcPayload: Record<string, unknown> = {
          title: chore.title,
          childId: chore.childId,
          value: chore.value,
          day: chore.day,
          emoji: chore.emoji,
          frequency: chore.frequency ?? "weekly",
          days: chore.days && chore.days.length > 0 ? chore.days : [chore.day],
          requirePhoto: Boolean(chore.requirePhoto),
          weekKey: thisWeek,
          seriesId: chore.seriesId ?? chore.id,
        };
        if (chore.description) {
          rpcPayload["description"] = chore.description;
        }
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

      if (Object.keys(newOverrides).length > 0) {
        await updateMyPreferences(family.userId, (prefs) => {
          const prevCfg = prefs.householdConfig ?? {
            paydayFrequency: family.config?.paydayFrequency ?? "weekly",
            paydayDay: family.config?.paydayDay ?? 4,
          };
          return {
            ...prefs,
            householdConfig: {
              ...prevCfg,
              choreOverrides: {
                ...(prevCfg.choreOverrides ?? {}),
                ...newOverrides,
              },
              updatedAt: nowIso,
            },
          };
        });
      }

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

  const rpcPayload: Record<string, unknown> = {
    title: String(payload["title"] ?? "").trim(),
    childId: String(payload["childId"] ?? ""),
    value: Math.round(Number(payload["value"] ?? 0)),
    day: primaryDay,
    days: rawDays,
    frequency,
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

  if (action === "create_chore") {
    const rpcPayload = buildChoreRpcPayload(payload);
    const { error } = await supabase.rpc("family_action", {
      action: "create_chore",
      payload: rpcPayload as Json,
    });
    if (error) throw new Error(error.message);
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
    const nextEmoji = typeof payload["emoji"] === "string" ? payload["emoji"] : existing.emoji;
    const nextDescription =
      typeof payload["description"] === "string"
        ? payload["description"].trim()
        : (existing.description ?? "");
    const nextRequirePhoto =
      typeof payload["requirePhoto"] === "boolean"
        ? payload["requirePhoto"]
        : Boolean(existing.requirePhoto);

    const coreFieldsChanged =
      nextTitle !== existing.title ||
      nextValue !== existing.value ||
      nextChildId !== existing.childId ||
      nextDay !== existing.day;

    if ((existing.status === "todo" || existing.status === "rejected") && coreFieldsChanged) {
      const rpcPayload = buildChoreRpcPayload(
        {
          title: nextTitle,
          childId: nextChildId,
          value: nextValue,
          day: nextDay,
          days: nextDays,
          frequency: nextFrequency,
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

      await updateMyPreferences(family.userId, (prefs) => {
        const prevCfg = prefs.householdConfig ?? {
          paydayFrequency: family.config?.paydayFrequency ?? "weekly",
          paydayDay: family.config?.paydayDay ?? 4,
        };
        return {
          ...prefs,
          householdConfig: {
            ...prevCfg,
            choreOverrides: {
              ...(prevCfg.choreOverrides ?? {}),
              [id]: {
                deleted: true,
                replacedById: `edited-${Date.now()}`,
                updatedAt: nowIso,
              },
            },
            updatedAt: nowIso,
          },
        };
      });
    } else {
      const override: ChoreOverride = {
        title: nextTitle,
        childId: nextChildId,
        day: nextDay,
        days: nextDays,
        frequency: nextFrequency,
        value: nextValue,
        emoji: nextEmoji,
        description: nextDescription,
        requirePhoto: nextRequirePhoto,
        updatedAt: nowIso,
      };
      await updateMyPreferences(family.userId, (prefs) => {
        const prevCfg = prefs.householdConfig ?? {
          paydayFrequency: family.config?.paydayFrequency ?? "weekly",
          paydayDay: family.config?.paydayDay ?? 4,
        };
        return {
          ...prefs,
          householdConfig: {
            ...prevCfg,
            choreOverrides: {
              ...(prevCfg.choreOverrides ?? {}),
              [id]: override,
            },
            updatedAt: nowIso,
          },
        };
      });
    }
  } else if (action === "delete_chore") {
    const id = String(payload["id"] ?? "");
    await updateMyPreferences(family.userId, (prefs) => {
      const prevCfg = prefs.householdConfig ?? {
        paydayFrequency: family.config?.paydayFrequency ?? "weekly",
        paydayDay: family.config?.paydayDay ?? 4,
      };
      return {
        ...prefs,
        householdConfig: {
          ...prevCfg,
          choreOverrides: {
            ...(prevCfg.choreOverrides ?? {}),
            [id]: { deleted: true, updatedAt: nowIso },
          },
          updatedAt: nowIso,
        },
      };
    });
  } else if (action === "reset_chore") {
    const targetId = typeof payload["id"] === "string" ? payload["id"] : null;
    const targets = targetId
      ? family.state.chores.filter((c) => c.id === targetId)
      : family.state.chores.filter((c) => c.status === "approved" && c.frequency !== "once");

    const newOverrides: Record<string, ChoreOverride> = {};
    for (const chore of targets) {
      const rpcPayload = buildChoreRpcPayload({
        title: chore.title,
        childId: chore.childId,
        value: chore.value,
        day: chore.day,
        days: chore.days ?? [chore.day],
        frequency: chore.frequency ?? "weekly",
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

    if (Object.keys(newOverrides).length > 0) {
      await updateMyPreferences(family.userId, (prefs) => {
        const prevCfg = prefs.householdConfig ?? {
          paydayFrequency: family.config?.paydayFrequency ?? "weekly",
          paydayDay: family.config?.paydayDay ?? 4,
        };
        return {
          ...prefs,
          householdConfig: {
            ...prevCfg,
            choreOverrides: {
              ...(prevCfg.choreOverrides ?? {}),
              ...newOverrides,
            },
            updatedAt: nowIso,
          },
        };
      });
    }
  } else if (
    action === "complete" ||
    action === "approve" ||
    action === "reject" ||
    action === "pay"
  ) {
    if (action === "pay") {
      const childId = String(payload["childId"] ?? "");
      if (balance(family.state, childId) <= 0) {
        throw new Error("Nothing to pay");
      }
    }
    const { error } = await supabase.rpc("family_action", {
      action,
      payload: payload as Json,
    });
    if (error) throw new Error(error.message);

    if (action === "complete" || action === "approve" || action === "reject") {
      void notifyHouseholdPush({ data: { action } }).catch(() => undefined);
    }
  } else if (action === "goal") {
    const title = String(payload["title"] ?? "").trim();
    const emoji = String(payload["emoji"] ?? "🎯");
    const target = Math.round(Number(payload["target"] ?? 0));
    const childId = String(payload["childId"] ?? family.userId);
    if (!title || target <= 0) throw new Error("Enter a goal name and target amount");

    if (family.role === "child") {
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

    await updateMyPreferences(family.userId, (prefs) => {
      const prevCfg = prefs.householdConfig ?? {
        paydayFrequency: family.config?.paydayFrequency ?? "weekly",
        paydayDay: family.config?.paydayDay ?? 4,
      };
      return {
        ...prefs,
        householdConfig: {
          ...prevCfg,
          paydayFrequency,
          paydayDay,
          updatedAt: nowIso,
        },
      };
    });
  } else if (action === "clear_notifications") {
    await updateMyPreferences(family.userId, (prefs) => ({
      ...prefs,
      clearedNotificationsAt: nowIso,
    }));
  } else if (action === "update_profile") {
    const name = String(payload["name"] ?? "").trim();
    const avatar = String(payload["avatar"] ?? "🌱");
    const celebrations = Boolean(payload["celebrations"]);

    const { data: currentData, error: fetchErr } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", family.userId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const nextPrefs: MemberPreferences = {
      ...parsePreferences(currentData?.preferences),
      celebrations,
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
