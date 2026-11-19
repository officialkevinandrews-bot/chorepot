import { describe, it, expect } from "vitest";
import {
  money,
  demoAction,
  balance,
  demo,
  isChoreScheduledOnDay,
  formatChoreSchedule,
  nextPaydayInfo,
  childWeeklySummary,
  familyWeeklyPotSummary,
  choreRewardMode,
  choreScheduledDaysCount,
  choreWeeklyMax,
  STARTER_CHORES,
  CHORE_CATEGORIES,
  resolveChoreCategory,
  getChoreCategoryInfo,
  CHILD_THEMES,
  isChildThemeColor,
  isRunningInApk,
  type Chore,
} from "../features/family/model";

describe("Pocket money rules", () => {
  it("supports GBP pence and pounds", () => {
    expect(money(50)).toBe("50p");
    expect(money(250)).toBe("£2.50");
    expect(money(0)).toBe("£0.00");
  });

  it("completion does not award money", () => {
    expect(balance(demoAction(demo.state, "complete", { id: "3" }), "oliver")).toBe(2250);
  });

  it("parent approval awards the bounty once", () => {
    const s = demoAction(demo.state, "approve", { id: "1" });
    expect(balance(s, "oliver")).toBe(2400);
    expect(balance(demoAction(s, "approve", { id: "1" }), "oliver")).toBe(2400);
  });

  it("marking as paid settles the virtual balance", () => {
    expect(balance(demoAction(demo.state, "pay", { childId: "oliver" }), "oliver")).toBe(0);
  });

  it("allows Option B savings goal allocation even after payday payout", () => {
    const paidState = demoAction(demo.state, "pay", { childId: "oliver" });
    expect(balance(paidState, "oliver")).toBe(0);

    const updated = demoAction(paidState, "allocate", { id: "g1", amount: 500 });
    const goal = updated.goals.find((g) => g.id === "g1");
    expect(goal?.saved).toBe(2300);
  });

  it("cannot allocate beyond goal target", () => {
    expect(() => demoAction(demo.state, "allocate", { id: "g1", amount: 99999 })).toThrow();
  });

  it("supports withdrawing, editing, achieving, and deleting savings goals", () => {
    let s = demoAction(demo.state, "withdraw_goal", { id: "g1", amount: 300 });
    expect(s.goals.find((g) => g.id === "g1")?.saved).toBe(1500);

    s = demoAction(s, "edit_goal", {
      id: "g1",
      title: "Giant LEGO Castle",
      target: 4000,
    });
    expect(s.goals.find((g) => g.id === "g1")?.title).toBe("Giant LEGO Castle");
    expect(s.goals.find((g) => g.id === "g1")?.target).toBe(4000);

    s = demoAction(s, "achieve_goal", { id: "g1" });
    expect(s.goals.find((g) => g.id === "g1")?.achieved).toBe(true);
    expect(s.goals.find((g) => g.id === "g1")?.saved).toBe(4000);

    s = demoAction(s, "delete_goal", { id: "g1" });
    expect(s.goals.find((g) => g.id === "g1")).toBeUndefined();
  });
});

describe("Chore customization, scheduling, and weekly resets", () => {
  it("supports creating, editing, rejecting, and deleting chores", () => {
    let s = demoAction(demo.state, "create_chore", {
      title: "Practice guitar",
      childId: "oliver",
      day: 0,
      days: [0, 2, 4],
      frequency: "weekly",
      value: 75,
      emoji: "🎸",
      description: "15 minutes practice",
      requirePhoto: true,
    });
    const created = s.chores.find((c) => c.title === "Practice guitar");
    expect(created).toBeDefined();
    expect(created?.days).toEqual([0, 2, 4]);
    expect(created?.requirePhoto).toBe(true);

    s = demoAction(s, "edit_chore", {
      id: created!.id,
      title: "Practice acoustic guitar",
      value: 100,
      days: [1, 3],
    });
    const edited = s.chores.find((c) => c.id === created!.id);
    expect(edited?.title).toBe("Practice acoustic guitar");
    expect(edited?.value).toBe(100);
    expect(edited?.days).toEqual([1, 3]);

    s = demoAction(s, "complete", { id: created!.id });
    s = demoAction(s, "reject", { id: created!.id, note: "Try 5 more minutes" });
    expect(s.chores.find((c) => c.id === created!.id)?.status).toBe("rejected");
    expect(s.chores.find((c) => c.id === created!.id)?.note).toBe("Try 5 more minutes");

    s = demoAction(s, "delete_chore", { id: created!.id });
    expect(s.chores.find((c) => c.id === created!.id)).toBeUndefined();
  });

  it("resets approved weekly chores back to todo while skipping one-off chores", () => {
    let s = demoAction(demo.state, "complete", { id: "7" }); // '7' is 'once'
    s = demoAction(s, "approve", { id: "7" });
    expect(s.chores.find((c) => c.id === "7")?.status).toBe("approved");
    expect(s.chores.find((c) => c.id === "5")?.status).toBe("approved"); // '5' is 'weekly'

    s = demoAction(s, "reset_chore", { all: true });
    expect(s.chores.find((c) => c.id === "5")?.status).toBe("todo");
    expect(s.chores.find((c) => c.id === "7")?.status).toBe("approved");
  });

  it("evaluates multi-day and daily chore scheduling", () => {
    const multiDay: Chore = {
      id: "m1",
      title: "Piano",
      childId: "oliver",
      day: 0,
      days: [0, 2, 4],
      frequency: "weekly",
      value: 50,
      emoji: "🎹",
      status: "todo",
    };
    expect(isChoreScheduledOnDay(multiDay, 0)).toBe(true);
    expect(isChoreScheduledOnDay(multiDay, 1)).toBe(false);
    expect(isChoreScheduledOnDay(multiDay, 4)).toBe(true);
    expect(formatChoreSchedule(multiDay)).toBe("Weekly · Mon, Wed, Fri");

    const daily: Chore = { ...multiDay, frequency: "daily" };
    expect(isChoreScheduledOnDay(daily, 6)).toBe(true);
    expect(formatChoreSchedule(daily)).toBe("Every day");
  });
});

describe("Payday schedule & weekly summary", () => {
  it("computes custom weekly and monthly payday labels", () => {
    const sat = nextPaydayInfo(
      { paydayFrequency: "weekly", paydayDay: 5 },
      new Date("2026-11-18T12:00:00Z"), // Wednesday
    );
    expect(sat.label).toBe("Saturday");
    expect(sat.scheduleText).toBe("Weekly payday on Saturday");
    expect(sat.isToday).toBe(false);

    const monthly = nextPaydayInfo(
      { paydayFrequency: "monthly", paydayDay: 1 },
      new Date("2026-11-18T12:00:00Z"),
    );
    expect(monthly.label).toBe("1st of month");
    expect(monthly.scheduleText).toBe("Monthly payday on day 1");
    expect(monthly.isToday).toBe(false);
  });

  it("calculates weekly payday summary breakdown for a child", () => {
    const s = demoAction(demo.state, "approve", { id: "1" }); // +150p for oliver
    const summary = childWeeklySummary(s, "oliver");
    expect(summary.unpaidBalance).toBe(2400);
    expect(summary.earnedThisWeek).toBeGreaterThanOrEqual(150);
    expect(summary.pendingCount).toBe(0);
    expect(summary.totalSaved).toBe(1800);
  });

  it("clears notifications cleanly", () => {
    const s = demoAction(demo.state, "complete", { id: "3" });
    expect(s.notifications.length).toBeGreaterThan(0);
    const cleared = demoAction(s, "clear_notifications", {});
    expect(cleared.notifications.length).toBe(0);
  });
});

describe("Starter chores & 4 colour-coded chore categories", () => {
  it("provides 80 curated starter chores across 4 categories including flat-friendly chores", () => {
    expect(CHORE_CATEGORIES.map((c) => c.id)).toEqual([
      "self_care",
      "house_care",
      "eco_pets_outdoors",
      "learning_family",
    ]);
    expect(STARTER_CHORES.length).toBeGreaterThanOrEqual(75);
    const categories = new Set(STARTER_CHORES.map((c) => c.choreCategory));
    expect(categories.size).toBe(4);
    expect(STARTER_CHORES.some((c) => c.defaultSelected)).toBe(true);
    expect(
      STARTER_CHORES.some(
        (c) => c.choreCategory === "eco_pets_outdoors" && c.key === "energy-detective",
      ),
    ).toBe(true);
    for (const item of STARTER_CHORES) {
      expect(item.value).toBeGreaterThan(0);
      expect(item.day).toBeGreaterThanOrEqual(0);
      expect(item.day).toBeLessThanOrEqual(6);
      expect(item.days.length).toBeGreaterThan(0);
      expect(getChoreCategoryInfo(item.choreCategory).label).toBe(item.category);
    }
  });

  it("supports creating/editing chore categories and infers fallback categories", () => {
    let s = demoAction(demo.state, "create_chore", {
      title: "Sort recycling plastics",
      childId: "oliver",
      day: 2,
      days: [2],
      frequency: "weekly",
      choreCategory: "eco_pets_outdoors",
      value: 50,
      emoji: "♻️",
    });
    const created = s.chores.find((c) => c.title === "Sort recycling plastics");
    expect(created?.choreCategory).toBe("eco_pets_outdoors");

    s = demoAction(s, "edit_chore", {
      id: created!.id,
      choreCategory: "house_care",
    });
    expect(s.chores.find((c) => c.id === created!.id)?.choreCategory).toBe("house_care");

    expect(resolveChoreCategory({ title: "Complete Maths homework" })).toBe("learning_family");
    expect(resolveChoreCategory({ title: "Hoover the hallway" })).toBe("house_care");
    expect(resolveChoreCategory({ title: "Energy Detective lights check" })).toBe(
      "eco_pets_outdoors",
    );
    expect(resolveChoreCategory({ title: "Make your bed" })).toBe("self_care");
  });
});

describe("Child theme colours & APK detection", () => {
  it("validates supported child theme colours", () => {
    expect(CHILD_THEMES.length).toBeGreaterThanOrEqual(7);
    expect(isChildThemeColor("sunset")).toBe(true);
    expect(isChildThemeColor("berry")).toBe(true);
    expect(isChildThemeColor("unknown")).toBe(false);
  });

  it("defaults isRunningInApk to false in normal browser environments", () => {
    expect(isRunningInApk()).toBe(false);
  });
});

describe("Multi-day reward modes and weekly earnings pot", () => {
  it("computes choreWeeklyMax for per_day and all_days schedules", () => {
    const base: Chore = {
      id: "c-base",
      title: "Practice reading",
      childId: "oliver",
      day: 0,
      days: [0, 2, 4],
      frequency: "weekly",
      value: 50,
      emoji: "📖",
      status: "todo",
    };
    expect(choreScheduledDaysCount(base)).toBe(3);
    expect(choreRewardMode(base)).toBe("per_day");
    expect(choreWeeklyMax(base)).toBe(150);

    const allDays: Chore = { ...base, value: 150, rewardMode: "all_days" };
    expect(choreRewardMode(allDays)).toBe("all_days");
    expect(choreWeeklyMax(allDays)).toBe(150);

    const daily: Chore = { ...base, frequency: "daily", rewardMode: "per_day", value: 50 };
    expect(choreScheduledDaysCount(daily)).toBe(7);
    expect(choreWeeklyMax(daily)).toBe(350);

    const once: Chore = { ...base, frequency: "once", value: 250 };
    expect(choreWeeklyMax(once)).toBe(250);
  });

  it("pays an all_days multi-day chore only after all scheduled days are approved", () => {
    let s = demoAction(demo.state, "create_chore", {
      title: "Practice spelling",
      childId: "oliver",
      day: 0,
      days: [0, 2, 4],
      frequency: "weekly",
      rewardMode: "all_days",
      value: 150,
      emoji: "📝",
    });
    const created = s.chores.find((c) => c.title === "Practice spelling");
    expect(created).toBeDefined();
    const startBal = balance(s, "oliver");

    // Day 1 approved -> still todo (1/3), no payout yet
    s = demoAction(s, "complete", { id: created!.id });
    s = demoAction(s, "approve", { id: created!.id });
    const afterDay1 = s.chores.find((c) => c.id === created!.id);
    expect(afterDay1?.status).toBe("todo");
    expect(afterDay1?.completedDays).toHaveLength(1);
    expect(balance(s, "oliver")).toBe(startBal);

    // Day 2 approved -> still todo (2/3), no payout yet
    s = demoAction(s, "complete", { id: created!.id });
    s = demoAction(s, "approve", { id: created!.id });
    const afterDay2 = s.chores.find((c) => c.id === created!.id);
    expect(afterDay2?.status).toBe("todo");
    expect(afterDay2?.completedDays).toHaveLength(2);
    expect(balance(s, "oliver")).toBe(startBal);

    // Day 3 approved -> approved (3/3), pays 150p once
    s = demoAction(s, "complete", { id: created!.id });
    s = demoAction(s, "approve", { id: created!.id });
    const afterDay3 = s.chores.find((c) => c.id === created!.id);
    expect(afterDay3?.status).toBe("approved");
    expect(afterDay3?.completedDays).toEqual([0, 2, 4]);
    expect(balance(s, "oliver")).toBe(startBal + 150);
  });

  it("calculates weeklyMax, earnedPercent, pendingPercent, and remainingToEarn across family", () => {
    const pot = familyWeeklyPotSummary(demo.state, ["oliver", "amelia"]);
    // Oliver: 150 + 350 (daily 50*7) + 100 + 250 = 850p; Amelia: 200 + 100 + 50 = 350p => 1200p total max
    expect(pot.weeklyMax).toBe(1200);
    // Demo week earnings: 100p (Oliver) + 150p (Amelia) = 250p -> 21%
    expect(pot.earnedThisWeek).toBe(250);
    expect(pot.earnedPercent).toBe(21);
    // Pending: 150p (Oliver) + 200p (Amelia) = 350p -> 29%
    expect(pot.pendingAmount).toBe(350);
    expect(pot.pendingPercent).toBe(29);
    expect(pot.remainingToEarn).toBe(600);
  });
});
