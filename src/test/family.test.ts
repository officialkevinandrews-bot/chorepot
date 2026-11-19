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
  CHORE_PRIORITIES,
  calculateChildBudgetSplit,
  childWeeklyBonusInfo,
  currentWeekKey,
  choreSplitWeeklyWeight,
  resolveChoreCategory,
  resolveChorePriority,
  getChoreCategoryInfo,
  CHILD_THEMES,
  isChildThemeColor,
  isRunningInApk,
  tryNativeAndroidShare,
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

  it("defaults isRunningInApk and tryNativeAndroidShare to false in normal browser environments", () => {
    expect(isRunningInApk()).toBe(false);
    expect(tryNativeAndroidShare("Join", "Hello", "https://chorepot.app")).toBe(false);
  });

  it("invokes ChorepotAndroid.share bridge when running inside the Android APK WebView", () => {
    let shared: unknown[] | null = null;
    (
      window as unknown as { ChorepotAndroid?: { share: (...a: unknown[]) => void } }
    ).ChorepotAndroid = {
      share: (...args) => {
        shared = args;
      },
    };
    try {
      expect(
        tryNativeAndroidShare("Chorepot", "Join us", "https://chorepot.app/auth?code=123"),
      ).toBe(true);
      expect(shared).toEqual(["Chorepot", "Join us", "https://chorepot.app/auth?code=123"]);
    } finally {
      delete (window as unknown as { ChorepotAndroid?: unknown }).ChorepotAndroid;
    }
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

describe("4-star priority system & exact-1p weekly budget splitter", () => {
  it("provides 4 priority levels and resolves defaults cleanly", () => {
    expect(CHORE_PRIORITIES.map((p) => p.level)).toEqual([1, 2, 3, 4]);
    expect(resolveChorePriority({ title: "Brush teeth morning & night" })).toBe(1);
    expect(resolveChorePriority({ title: "Pack school bag & water bottle the night before" })).toBe(
      1,
    );
    expect(resolveChorePriority({ title: "Lay out school uniform / clothes for tomorrow" })).toBe(
      1,
    );
    expect(resolveChorePriority({ title: "Set the table for dinner" })).toBe(2);
    expect(resolveChorePriority({ title: "Complete English homework" })).toBe(3);
    expect(resolveChorePriority({ title: "Hoover the living room" })).toBe(4);
    expect(STARTER_CHORES.find((t) => t.key === "pack-school-bag")?.rewardMode).toBe("per_day");
    expect(STARTER_CHORES.find((t) => t.key === "lay-out-uniform")?.rewardMode).toBe("per_day");
  });

  it("caps multi-day inflation for Quick Habits while keeping Big Effort uncapped", () => {
    expect(choreSplitWeeklyWeight(1, 5, "per_day")).toBeCloseTo(1.2);
    expect(choreSplitWeeklyWeight(4, 5, "per_day")).toBe(20);

    const chores: Chore[] = [
      {
        id: "bag",
        title: "Pack school bag",
        childId: "child-1",
        day: 0,
        days: [0, 1, 2, 3, 6],
        frequency: "weekly",
        rewardMode: "per_day",
        priority: 1,
        value: 0,
        emoji: "🎒",
        status: "todo",
      },
      {
        id: "maths",
        title: "Complete Maths homework",
        childId: "child-1",
        day: 2,
        days: [2],
        frequency: "weekly",
        priority: 3,
        value: 0,
        emoji: "🔢",
        status: "todo",
      },
      {
        id: "tidy",
        title: "Full bedroom tidy",
        childId: "child-1",
        day: 5,
        days: [5],
        frequency: "weekly",
        priority: 4,
        value: 0,
        emoji: "🧹",
        status: "todo",
      },
    ];

    const res = calculateChildBudgetSplit(chores, "child-1", 500, "overwrite_all");
    expect(res.allocatedWeeklyTotalPence).toBe(500);
    const bag = res.allocations.find((a) => a.choreId === "bag")!;
    const maths = res.allocations.find((a) => a.choreId === "maths")!;
    const tidy = res.allocations.find((a) => a.choreId === "tidy")!;
    expect(bag.newValue).toBeGreaterThan(0);
    expect(bag.newWeeklyMax).toBeLessThan(maths.newWeeklyMax);
    expect(maths.newWeeklyMax).toBeLessThan(tidy.newWeeklyMax);
  });

  it("splits a child weekly budget to the exact 1p weighted by priority and frequency", () => {
    const chores: Chore[] = [
      {
        id: "t1",
        title: "Feed pets",
        childId: "child-1",
        day: 0,
        days: [0, 1, 2, 3, 4, 5, 6],
        frequency: "daily",
        rewardMode: "per_day",
        priority: 1,
        value: 0,
        emoji: "🐈",
        status: "todo",
      },
      {
        id: "t2",
        title: "Maths homework",
        childId: "child-1",
        day: 2,
        days: [2],
        frequency: "weekly",
        priority: 3,
        value: 0,
        emoji: "🔢",
        status: "todo",
      },
      {
        id: "t3",
        title: "Full bedroom tidy",
        childId: "child-1",
        day: 5,
        days: [5],
        frequency: "weekly",
        priority: 4,
        value: 0,
        emoji: "🧹",
        status: "todo",
      },
    ];

    const res = calculateChildBudgetSplit(chores, "child-1", 500, "overwrite_all");
    expect(res.budgetPence).toBe(500);
    expect(res.allocatedWeeklyTotalPence).toBe(500);
    const a1 = res.allocations.find((a) => a.choreId === "t1")!;
    const a2 = res.allocations.find((a) => a.choreId === "t2")!;
    const a3 = res.allocations.find((a) => a.choreId === "t3")!;
    expect(a1.newWeeklyMax).toBe(a1.newValue * 7);
    expect(a3.newValue).toBeGreaterThan(a2.newValue);
  });

  it("preserves existing priced chores in unpriced_only mode and updates via apply_budget_split", () => {
    const chores: Chore[] = [
      {
        id: "p1",
        title: "Locked chore",
        childId: "oliver",
        day: 0,
        days: [0],
        frequency: "weekly",
        priority: 2,
        value: 150,
        emoji: "📚",
        status: "todo",
      },
      {
        id: "p2",
        title: "Unpriced hobby task",
        childId: "oliver",
        day: 3,
        days: [3],
        frequency: "weekly",
        priority: 2,
        value: 0,
        emoji: "🪴",
        status: "todo",
      },
      {
        id: "p3",
        title: "Unpriced big chore",
        childId: "oliver",
        day: 5,
        days: [5],
        frequency: "weekly",
        priority: 4,
        value: 0,
        emoji: "🧹",
        status: "todo",
      },
    ];

    const res = calculateChildBudgetSplit(chores, "oliver", 600, "unpriced_only");
    expect(res.lockedWeeklyPence).toBe(150);
    expect(res.availableToSplitPence).toBe(450);
    expect(res.allocatedWeeklyTotalPence).toBe(600);
    const p1 = res.allocations.find((a) => a.choreId === "p1")!;
    const p2 = res.allocations.find((a) => a.choreId === "p2")!;
    const p3 = res.allocations.find((a) => a.choreId === "p3")!;
    expect(p1.locked).toBe(true);
    expect(p1.newValue).toBe(150);
    expect(p2.newValue).toBe(150);
    expect(p3.newValue).toBe(300);

    const stateAfter = demoAction({ ...demo.state, chores }, "apply_budget_split", {
      updates: res.allocations.map((a) => ({
        id: a.choreId,
        value: a.newValue,
        priority: a.priority,
      })),
    });
    expect(stateAfter.chores.find((c) => c.id === "p2")?.value).toBe(150);
    expect(stateAfter.chores.find((c) => c.id === "p3")?.value).toBe(300);
  });

  it("rebalances unlocked chores around manually edited weekly targets and divides per-day rates", () => {
    const chores: Chore[] = [
      {
        id: "m1",
        title: "Empty dishwasher",
        childId: "oliver",
        day: 0,
        days: [0, 1, 2, 3, 4],
        frequency: "weekly",
        priority: 3,
        rewardMode: "per_day",
        value: 0,
        emoji: "🍽️",
        status: "todo",
      },
      {
        id: "m2",
        title: "Clean rabbit hutch",
        childId: "oliver",
        day: 5,
        days: [5],
        frequency: "weekly",
        priority: 3,
        value: 0,
        emoji: "🐇",
        status: "todo",
      },
      {
        id: "m3",
        title: "Sort washing",
        childId: "oliver",
        day: 6,
        days: [6],
        frequency: "weekly",
        priority: 1,
        value: 0,
        emoji: "🧺",
        status: "todo",
      },
    ];

    // Pin m1 to £2.50/wk (250p) across 5 days => 50p/day, remaining £7.50 split across m2 (prio 3) & m3 (prio 1)
    const res = calculateChildBudgetSplit(chores, "oliver", 1000, "overwrite_all", undefined, {
      m1: 250,
    });
    const a1 = res.allocations.find((a) => a.choreId === "m1")!;
    const a2 = res.allocations.find((a) => a.choreId === "m2")!;
    const a3 = res.allocations.find((a) => a.choreId === "m3")!;

    expect(a1.locked).toBe(true);
    expect(a1.lockType).toBe("manual");
    expect(a1.newValue).toBe(50);
    expect(a1.newWeeklyMax).toBe(250);
    expect(res.lockedWeeklyPence).toBe(250);
    expect(res.availableToSplitPence).toBe(750);
    expect(res.allocatedWeeklyTotalPence).toBe(1000);
    expect(a2.newValue + a3.newValue).toBe(750);
    expect(a2.newValue).toBeGreaterThan(a3.newValue);
  });

  it("reports over-budget locked totals and tracks active weekly bonus + child notifications", () => {
    const chores: Chore[] = [
      {
        id: "b1",
        title: "Mow lawn",
        childId: "oliver",
        day: 5,
        days: [5],
        frequency: "weekly",
        priority: 4,
        value: 400,
        priceLocked: true,
        emoji: "🌿",
        status: "todo",
      },
      {
        id: "b2",
        title: "Wash car",
        childId: "oliver",
        day: 6,
        days: [6],
        frequency: "weekly",
        priority: 4,
        value: 300,
        priceLocked: true,
        emoji: "🚗",
        status: "todo",
      },
    ];

    const overRes = calculateChildBudgetSplit(chores, "oliver", 500, "overwrite_all", undefined, {
      b1: 400,
      b2: 300,
    });
    expect(overRes.lockedWeeklyPence).toBe(700);
    expect(overRes.availableToSplitPence).toBe(0);
    expect(overRes.allocatedWeeklyTotalPence).toBe(700);

    const weekKey = currentWeekKey();
    const stateAfter = demoAction({ ...demo.state, chores }, "apply_budget_split", {
      updates: overRes.allocations.map((a) => ({
        id: a.choreId,
        value: a.newValue,
        priority: a.priority,
        priceLocked: a.lockType === "manual",
      })),
      bonusNotices: [
        {
          childId: "oliver",
          title: "🌟 Bonus pocket money unlocked!",
          message: "Oliver can earn +£2.00 bonus pocket money this week!",
        },
      ],
    });

    expect(stateAfter.chores.every((c) => c.priceLocked === true)).toBe(true);
    expect(
      stateAfter.notifications.some(
        (n) => n.childId === "oliver" && n.targetRole === "child" && n.title.includes("Bonus"),
      ),
    ).toBe(true);

    const bonusInfo = childWeeklyBonusInfo(
      stateAfter,
      {
        ...demo.config!,
        weeklyBudgets: { oliver: 500 },
        weeklyBonusWeeks: {
          oliver: { weekKey, baseBudget: 500, bonusAmount: 200 },
        },
      },
      "oliver",
    );
    expect(bonusInfo.hasBonus).toBe(true);
    expect(bonusInfo.bonusAmount).toBe(200);
    expect(bonusInfo.baseBudget).toBe(500);
  });
});
