export type ChildThemeColor =
  "sunset" | "berry" | "ocean" | "rose" | "emerald" | "sunshine" | "indigo";

export const CHILD_THEMES: Array<{
  id: ChildThemeColor;
  label: string;
  swatch: string;
  emoji: string;
}> = [
  { id: "sunset", label: "Sunset Coral", swatch: "#f97316", emoji: "🌅" },
  { id: "berry", label: "Berry Plum", swatch: "#9333ea", emoji: "🍇" },
  { id: "ocean", label: "Ocean Teal", swatch: "#0891b2", emoji: "🌊" },
  { id: "rose", label: "Bubblegum Pink", swatch: "#ec4899", emoji: "🌸" },
  { id: "emerald", label: "Forest Mint", swatch: "#16a34a", emoji: "🌿" },
  { id: "sunshine", label: "Honey Gold", swatch: "#eab308", emoji: "🌻" },
  { id: "indigo", label: "Cosmic Blue", swatch: "#4f46e5", emoji: "🚀" },
];

export function isChildThemeColor(value: unknown): value is ChildThemeColor {
  return typeof value === "string" && CHILD_THEMES.some((item) => item.id === value);
}

export function isRunningInApk(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (
      window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("apk") === "1") {
      sessionStorage.setItem("chorepot-apk", "1");
      return true;
    }
    if (sessionStorage.getItem("chorepot-apk") === "1") return true;
    const ua = navigator.userAgent || "";
    if (ua.includes("ChorepotAPK") || ua.includes("; wv)")) return true;
  } catch {
    return false;
  }
  return false;
}

export type ManagedChild = {
  id: string;
  name: string;
  avatar: string;
  role: "child";
  email?: string;
  inviteCode?: string;
  themeColor?: ChildThemeColor;
  isManaged: true;
};

export type PendingInvite = {
  id: string;
  name: string;
  email?: string;
  role: "child" | "co_parent";
  code: string;
  createdAt: string;
};

export type MemberPreferences = {
  celebrations?: boolean;
  clearedNotificationsAt?: string;
  themeColor?: ChildThemeColor;
  customGoals?: Goal[];
  goalOverrides?: Record<string, GoalOverride>;
  householdConfig?: HouseholdConfig;
};

export type Member = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  email?: string;
  inviteCode?: string;
  themeColor?: ChildThemeColor;
  isManaged?: boolean;
  preferences?: MemberPreferences;
};

export type ChoreFrequency = "weekly" | "daily" | "once";

export type StarterChoreTemplate = {
  key: string;
  category:
    | "Homework & Learning"
    | "Bedroom & Daily Routine"
    | "Mealtime & Kitchen Helpers"
    | "Pets, Garden & Weekend Bonus";
  title: string;
  emoji: string;
  value: number;
  frequency: ChoreFrequency;
  day: number;
  days: number[];
  requirePhoto: boolean;
  description: string;
  defaultSelected?: boolean;
};

export const STARTER_CHORES: StarterChoreTemplate[] = [
  {
    key: "english-homework",
    category: "Homework & Learning",
    title: "Complete English homework",
    emoji: "📚",
    value: 50,
    frequency: "weekly",
    day: 2,
    days: [2],
    requirePhoto: true,
    description: "Finish your English worksheet or writing task and snap a photo",
    defaultSelected: true,
  },
  {
    key: "maths-homework",
    category: "Homework & Learning",
    title: "Complete Maths homework",
    emoji: "🔢",
    value: 50,
    frequency: "weekly",
    day: 3,
    days: [3],
    requirePhoto: true,
    description: "Complete your Maths practice and show your working out",
  },
  {
    key: "reading-20m",
    category: "Homework & Learning",
    title: "Read for 20 minutes",
    emoji: "📖",
    value: 50,
    frequency: "weekly",
    day: 0,
    days: [0, 1, 2, 3, 4],
    requirePhoto: false,
    description: "Read your school reading book or a chapter book",
  },
  {
    key: "instrument-practice",
    category: "Homework & Learning",
    title: "Practice instrument or spellings",
    emoji: "🎹",
    value: 50,
    frequency: "weekly",
    day: 0,
    days: [0, 2, 4],
    requirePhoto: false,
    description: "15 minutes of focused practice",
  },
  {
    key: "make-bed",
    category: "Bedroom & Daily Routine",
    title: "Make your bed & tidy floor",
    emoji: "🛏️",
    value: 50,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    requirePhoto: false,
    description: "Straighten duvet and put dirty clothes in the laundry basket",
    defaultSelected: true,
  },
  {
    key: "bedroom-tidy",
    category: "Bedroom & Daily Routine",
    title: "Full bedroom tidy & desk clean",
    emoji: "🧹",
    value: 150,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: true,
    description: "Put toys and books away, clear floor, and take a quick photo",
    defaultSelected: true,
  },
  {
    key: "clean-laundry",
    category: "Bedroom & Daily Routine",
    title: "Put away clean laundry",
    emoji: "🧺",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Fold and put clean clothes neatly into drawers",
  },
  {
    key: "pack-school-bag",
    category: "Bedroom & Daily Routine",
    title: "Pack school bag & lay out uniform",
    emoji: "🎒",
    value: 50,
    frequency: "weekly",
    day: 0,
    days: [0, 1, 2, 3, 6],
    requirePhoto: false,
    description: "Check homework bag, water bottle, and uniform for tomorrow",
  },
  {
    key: "dinner-table",
    category: "Mealtime & Kitchen Helpers",
    title: "Set & clear the dinner table",
    emoji: "🍽️",
    value: 50,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    requirePhoto: false,
    description: "Lay out cutlery before dinner and bring plates to the sink after",
    defaultSelected: true,
  },
  {
    key: "recycling",
    category: "Mealtime & Kitchen Helpers",
    title: "Take out the recycling",
    emoji: "♻️",
    value: 100,
    frequency: "weekly",
    day: 3,
    days: [3],
    requirePhoto: false,
    description: "Sort cardboard and plastics into the recycling bin",
  },
  {
    key: "feed-pets",
    category: "Pets, Garden & Weekend Bonus",
    title: "Feed pets & fresh water",
    emoji: "🐈",
    value: 50,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    requirePhoto: false,
    description: "Give food and refill the fresh water bowl",
  },
  {
    key: "wash-car",
    category: "Pets, Garden & Weekend Bonus",
    title: "Help wash the family car",
    emoji: "🚙",
    value: 250,
    frequency: "once",
    day: 6,
    days: [6],
    requirePhoto: true,
    description: "Sponge, rinse, and help dry the car",
  },
];

export type Chore = {
  id: string;
  title: string;
  childId: string;
  day: number;
  value: number;
  emoji: string;
  status: "todo" | "pending" | "approved" | "rejected";
  proof?: string;
  note?: string;
  description?: string;
  frequency?: ChoreFrequency;
  days?: number[];
  requirePhoto?: boolean;
  weekKey?: string;
  seriesId?: string;
  submittedAt?: string;
};

export type ChoreOverride = Partial<Chore> & {
  deleted?: boolean;
  replacedById?: string;
  updatedAt?: string;
};

export type Goal = {
  id: string;
  childId: string;
  title: string;
  emoji: string;
  target: number;
  saved: number;
  achieved?: boolean;
  achievedAt?: string;
};

export type GoalOverride = Partial<Goal> & {
  deleted?: boolean;
  updatedAt?: string;
};

export type HouseholdConfig = {
  paydayFrequency: "weekly" | "monthly";
  paydayDay: number;
  onboardingCompleted?: boolean;
  parentPin?: string;
  childThemes?: Record<string, ChildThemeColor>;
  managedChildren?: ManagedChild[];
  pendingInvites?: PendingInvite[];
  customChores?: Chore[];
  customLedger?: Entry[];
  customNotifications?: Notice[];
  choreOverrides?: Record<string, ChoreOverride>;
  goalOverrides?: Record<string, GoalOverride>;
  customGoals?: Goal[];
  updatedAt?: string;
};

export type Entry = {
  id: string;
  childId: string;
  title: string;
  amount: number;
  type: string;
  date: string;
};

export type Notice = {
  id: string;
  title: string;
  message: string;
  childId: string;
  date: string;
  targetRole?: "parent" | "child" | "all";
};

export type FamilyState = {
  chores: Chore[];
  goals: Goal[];
  ledger: Entry[];
  notifications: Notice[];
};

export type Family = {
  id: string;
  name: string;
  code: string;
  state: FamilyState;
  members: Member[];
  userId: string;
  role: string;
  config?: HouseholdConfig;
  preferences?: MemberPreferences;
};

export type WeeklySummary = {
  earnedThisWeek: number;
  paidThisWeek: number;
  pendingAmount: number;
  pendingCount: number;
  approvedCount: number;
  unpaidBalance: number;
  totalSaved: number;
};

export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const fullDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const defaultHouseholdConfig: HouseholdConfig = {
  paydayFrequency: "weekly",
  paydayDay: 4,
};

export const money = (p: number): string => {
  if (p < 0) return `-${money(-p)}`;
  return p > 0 && p < 100 ? `${p}p` : `£${(p / 100).toFixed(2)}`;
};

export const balance = (state: FamilyState, id: string): number =>
  state.ledger.filter((e) => e.childId === id).reduce((sum, e) => sum + e.amount, 0);

export const today = (): number => (new Date().getDay() + 6) % 7;

export function currentWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function startOfCurrentWeek(date = new Date()): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function isChoreScheduledOnDay(chore: Chore, dayIndex: number): boolean {
  if (chore.frequency === "daily") return true;
  if (chore.days && chore.days.length > 0) return chore.days.includes(dayIndex);
  return chore.day === dayIndex;
}

export function formatChoreSchedule(chore: Chore): string {
  if (chore.frequency === "daily") return "Every day";
  if (chore.frequency === "once") return `One-off · ${days[chore.day] ?? "Mon"}`;
  const selectedDays = chore.days && chore.days.length > 0 ? chore.days : [chore.day];
  const uniqueSorted = Array.from(new Set(selectedDays)).sort((a, b) => a - b);
  if (uniqueSorted.length === 7) return "Every day";
  return `Weekly · ${uniqueSorted.map((d) => days[d] ?? "Mon").join(", ")}`;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function nextPaydayInfo(
  config?: HouseholdConfig,
  now = new Date(),
): { label: string; scheduleText: string; isToday: boolean } {
  const cfg = config ?? defaultHouseholdConfig;
  if (cfg.paydayFrequency === "monthly") {
    const dayOfMonth = Math.max(1, Math.min(28, Math.round(cfg.paydayDay || 1)));
    const isToday = now.getDate() === dayOfMonth;
    return {
      label: `${dayOfMonth}${ordinal(dayOfMonth)} of month`,
      scheduleText: `Monthly payday on day ${dayOfMonth}`,
      isToday,
    };
  }
  const dayIndex = Math.max(0, Math.min(6, Math.round(cfg.paydayDay ?? 4)));
  const dayName = fullDays[dayIndex] ?? "Friday";
  const isToday = (now.getDay() + 6) % 7 === dayIndex;
  return {
    label: dayName,
    scheduleText: `Weekly payday on ${dayName}`,
    isToday,
  };
}

export function childWeeklySummary(
  state: FamilyState,
  childId: string,
  now = new Date(),
): WeeklySummary {
  const weekStartMs = startOfCurrentWeek(now).getTime();
  let earnedThisWeek = 0;
  let paidThisWeek = 0;

  for (const entry of state.ledger) {
    if (entry.childId !== childId) continue;
    const entryMs = new Date(entry.date).getTime();
    if (Number.isNaN(entryMs) || entryMs < weekStartMs) continue;
    if (entry.type === "earning" && entry.amount > 0) {
      earnedThisWeek += entry.amount;
    } else if (entry.type === "payment") {
      paidThisWeek += Math.abs(entry.amount);
    }
  }

  let pendingAmount = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  for (const chore of state.chores) {
    if (chore.childId !== childId) continue;
    if (chore.status === "pending") {
      pendingCount += 1;
      pendingAmount += chore.value;
    } else if (chore.status === "approved") {
      approvedCount += 1;
    }
  }

  const totalSaved = state.goals
    .filter((g) => g.childId === childId)
    .reduce((sum, g) => sum + g.saved, 0);

  return {
    earnedThisWeek,
    paidThisWeek,
    pendingAmount,
    pendingCount,
    approvedCount,
    unpaidBalance: balance(state, childId),
    totalSaved,
  };
}

const stamp = new Date().toISOString();

export const demo: Family = {
  id: "demo",
  name: "The Thompson family",
  code: "FAM246",
  userId: "parent",
  role: "primary_parent",
  config: { ...defaultHouseholdConfig },
  preferences: { celebrations: true },
  members: [
    { id: "parent", name: "Sarah", avatar: "👩🏻", role: "primary_parent" },
    { id: "coparent", name: "James", avatar: "👨🏻", role: "co_parent" },
    {
      id: "oliver",
      name: "Oliver",
      avatar: "🧑🏼‍🚀",
      role: "child",
      themeColor: "ocean",
    },
    {
      id: "amelia",
      name: "Amelia",
      avatar: "👩🏻‍🎨",
      role: "child",
      themeColor: "berry",
    },
  ],
  state: {
    chores: [
      {
        id: "1",
        title: "Tidy your bedroom",
        childId: "oliver",
        day: today(),
        days: [today()],
        frequency: "weekly",
        value: 150,
        emoji: "🛏️",
        status: "pending",
        weekKey: currentWeekKey(),
      },
      {
        id: "2",
        title: "Finish English homework",
        childId: "amelia",
        day: today(),
        days: [today()],
        frequency: "weekly",
        requirePhoto: true,
        description: "Snap a photo of your finished worksheet!",
        value: 200,
        emoji: "📚",
        status: "pending",
        weekKey: currentWeekKey(),
      },
      {
        id: "3",
        title: "Feed Luna",
        childId: "oliver",
        day: today(),
        frequency: "daily",
        value: 50,
        emoji: "🐈",
        status: "todo",
        weekKey: currentWeekKey(),
      },
      {
        id: "4",
        title: "Set the dinner table",
        childId: "amelia",
        day: today(),
        days: [today()],
        frequency: "weekly",
        value: 100,
        emoji: "🍽️",
        status: "todo",
        weekKey: currentWeekKey(),
      },
      {
        id: "5",
        title: "Put the recycling out",
        childId: "oliver",
        day: today(),
        days: [today()],
        frequency: "weekly",
        value: 100,
        emoji: "♻️",
        status: "approved",
        weekKey: currentWeekKey(),
      },
      {
        id: "6",
        title: "Water the plants",
        childId: "amelia",
        day: 5,
        days: [5],
        frequency: "weekly",
        value: 50,
        emoji: "🪴",
        status: "todo",
        weekKey: currentWeekKey(),
      },
      {
        id: "7",
        title: "Help wash the car",
        childId: "oliver",
        day: 6,
        days: [6],
        frequency: "once",
        value: 250,
        emoji: "🚙",
        status: "todo",
        weekKey: currentWeekKey(),
      },
    ],
    goals: [
      {
        id: "g1",
        childId: "oliver",
        title: "New LEGO set",
        emoji: "🧱",
        target: 3500,
        saved: 1800,
      },
      {
        id: "g2",
        childId: "amelia",
        title: "Art supplies",
        emoji: "🎨",
        target: 2000,
        saved: 1250,
      },
    ],
    ledger: [
      {
        id: "e1",
        childId: "oliver",
        title: "This week’s chores",
        amount: 850,
        type: "earning",
        date: stamp,
      },
      {
        id: "e2",
        childId: "amelia",
        title: "This week’s chores",
        amount: 650,
        type: "earning",
        date: stamp,
      },
      {
        id: "e3",
        childId: "oliver",
        title: "Previous savings",
        amount: 1400,
        type: "earning",
        date: stamp,
      },
      {
        id: "e4",
        childId: "amelia",
        title: "Previous savings",
        amount: 1250,
        type: "earning",
        date: stamp,
      },
    ],
    notifications: [],
  },
};

export function demoAction(
  state: FamilyState,
  action: string,
  payload: Record<string, unknown>,
): FamilyState {
  const s = structuredClone(state);
  const chore = s.chores.find((c) => c.id === payload["id"]);

  if (action === "create_chore") {
    const rawDays = Array.isArray(payload["days"])
      ? (payload["days"] as number[]).map(Number)
      : [Number(payload["day"] ?? 0)];
    const frequency = (payload["frequency"] as ChoreFrequency | undefined) ?? "weekly";
    const newChore: Chore = {
      id: crypto.randomUUID(),
      title: String(payload["title"] ?? ""),
      childId: String(payload["childId"] ?? ""),
      day: rawDays[0] ?? Number(payload["day"] ?? 0),
      days: rawDays,
      frequency,
      value: Number(payload["value"] ?? 0),
      emoji: String(payload["emoji"] ?? "🧹"),
      status: "todo",
      weekKey: currentWeekKey(),
      requirePhoto: Boolean(payload["requirePhoto"]),
    };
    if (typeof payload["description"] === "string" && payload["description"].trim()) {
      newChore.description = payload["description"].trim();
    }
    s.chores.push(newChore);
  } else if (action === "edit_chore" && chore) {
    if (typeof payload["title"] === "string") chore.title = payload["title"];
    if (typeof payload["childId"] === "string") chore.childId = payload["childId"];
    if (typeof payload["value"] === "number") chore.value = payload["value"];
    if (typeof payload["emoji"] === "string") chore.emoji = payload["emoji"];
    if (typeof payload["frequency"] === "string") {
      chore.frequency = payload["frequency"] as ChoreFrequency;
    }
    if (Array.isArray(payload["days"])) {
      const nextDays = (payload["days"] as number[]).map(Number);
      chore.days = nextDays;
      chore.day = nextDays[0] ?? chore.day;
    } else if (typeof payload["day"] === "number") {
      chore.day = payload["day"];
    }
    if (typeof payload["description"] === "string") {
      if (payload["description"].trim()) chore.description = payload["description"].trim();
      else delete chore.description;
    }
    if (typeof payload["requirePhoto"] === "boolean") {
      chore.requirePhoto = payload["requirePhoto"];
    }
  } else if (action === "delete_chore") {
    s.chores = s.chores.filter((c) => c.id !== payload["id"]);
  } else if (action === "reset_chore") {
    if (payload["id"] && chore) {
      chore.status = "todo";
      chore.weekKey = currentWeekKey();
      delete chore.proof;
      delete chore.note;
      delete chore.submittedAt;
    } else {
      for (const c of s.chores) {
        if (c.status === "approved" && c.frequency !== "once") {
          c.status = "todo";
          c.weekKey = currentWeekKey();
          delete c.proof;
          delete c.note;
          delete c.submittedAt;
        }
      }
    }
  } else if (chore && action === "complete") {
    chore.status = "pending";
    if (typeof payload["proof"] === "string" && payload["proof"]) {
      chore.proof = payload["proof"];
    }
    chore.submittedAt = new Date().toISOString();
    s.notifications.push({
      id: crypto.randomUUID(),
      title: chore.title,
      message: "Ready for parent approval",
      childId: chore.childId,
      date: new Date().toISOString(),
      targetRole: "parent",
    });
  } else if (chore && action === "approve" && chore.status === "pending") {
    chore.status = "approved";
    s.ledger.push({
      id: crypto.randomUUID(),
      childId: chore.childId,
      title: chore.title,
      amount: chore.value,
      type: "earning",
      date: new Date().toISOString(),
    });
    s.notifications.push({
      id: crypto.randomUUID(),
      title: chore.title,
      message: "Approved — pocket money earned!",
      childId: chore.childId,
      date: new Date().toISOString(),
      targetRole: "child",
    });
  } else if (chore && action === "reject") {
    chore.status = "rejected";
    chore.note = String(payload["note"] ?? "");
    s.notifications.push({
      id: crypto.randomUUID(),
      title: chore.title,
      message: `Needs another try: ${chore.note}`,
      childId: chore.childId,
      date: new Date().toISOString(),
      targetRole: "child",
    });
  } else if (action === "pay") {
    const id = String(payload["childId"] ?? "");
    const current = balance(s, id);
    const requested =
      typeof payload["amount"] === "number" && payload["amount"] > 0
        ? Math.min(current, payload["amount"])
        : current;
    if (requested > 0) {
      s.ledger.push({
        id: crypto.randomUUID(),
        childId: id,
        title: "Pocket money paid",
        amount: -requested,
        type: "payment",
        date: new Date().toISOString(),
      });
    }
  } else if (action === "goal") {
    s.goals.push({
      id: crypto.randomUUID(),
      childId: String(payload["childId"] ?? ""),
      title: String(payload["title"] ?? ""),
      emoji: String(payload["emoji"] ?? "🎯"),
      target: Number(payload["target"] ?? 0),
      saved: 0,
    });
  } else if (action === "edit_goal") {
    const g = s.goals.find((item) => item.id === payload["id"]);
    if (g) {
      if (typeof payload["title"] === "string") g.title = payload["title"];
      if (typeof payload["emoji"] === "string") g.emoji = payload["emoji"];
      if (typeof payload["target"] === "number" && payload["target"] > 0) {
        g.target = payload["target"];
      }
      if (typeof payload["saved"] === "number" && payload["saved"] >= 0) {
        g.saved = Math.min(g.target, payload["saved"]);
      }
      g.achieved = g.saved >= g.target;
      if (g.achieved && !g.achievedAt) g.achievedAt = new Date().toISOString();
    }
  } else if (action === "delete_goal") {
    s.goals = s.goals.filter((g) => g.id !== payload["id"]);
  } else if (action === "allocate") {
    const g = s.goals.find((item) => item.id === payload["id"]);
    if (!g) throw new Error("Goal not found");
    const amount = Number(payload["amount"] ?? 0);
    const remaining = g.target - g.saved;
    if (amount <= 0 || remaining <= 0 || amount > remaining) {
      throw new Error("Amount exceeds goal target");
    }
    g.saved = Math.min(g.target, g.saved + amount);
    if (g.saved >= g.target) {
      g.achieved = true;
      g.achievedAt = new Date().toISOString();
    }
  } else if (action === "withdraw_goal") {
    const g = s.goals.find((item) => item.id === payload["id"]);
    if (!g) throw new Error("Goal not found");
    const amount = Number(payload["amount"] ?? 0);
    if (amount <= 0) throw new Error("Enter an amount above £0.00");
    g.saved = Math.max(0, g.saved - amount);
    if (g.saved < g.target) {
      g.achieved = false;
      delete g.achievedAt;
    }
  } else if (action === "achieve_goal") {
    const g = s.goals.find((item) => item.id === payload["id"]);
    if (g) {
      g.saved = g.target;
      g.achieved = true;
      g.achievedAt = new Date().toISOString();
    }
  } else if (action === "clear_notifications") {
    s.notifications = [];
  }

  return s;
}
