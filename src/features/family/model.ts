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

/** Triggers the native Android share sheet when hosted inside the Chorepot APK WebView. */
export function tryNativeAndroidShare(title: string, text: string, url: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const bridge = (
      window as unknown as {
        ChorepotAndroid?: { share?: (t: string, body: string, u: string) => void };
      }
    ).ChorepotAndroid;
    if (typeof bridge?.share === "function") {
      bridge.share(title, text, url);
      return true;
    }
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

export type ChoreRewardMode = "per_day" | "all_days";

export type ChoreCategory = "self_care" | "house_care" | "eco_pets_outdoors" | "learning_family";

export type ChoreCategoryInfo = {
  id: ChoreCategory;
  label: string;
  shortLabel: string;
  emoji: string;
  description: string;
};

export const CHORE_CATEGORIES: ChoreCategoryInfo[] = [
  {
    id: "self_care",
    label: "Self Care & Personal Space",
    shortLabel: "Self Care",
    emoji: "🛏️",
    description: "Looking after yourself, your bedroom, belongings, and school kit",
  },
  {
    id: "house_care",
    label: "House Care & Shared Spaces",
    shortLabel: "House Care",
    emoji: "🏠",
    description: "Helping keep shared living rooms, kitchen, and bathroom tidy",
  },
  {
    id: "eco_pets_outdoors",
    label: "Eco, Plants, Pets & Outings",
    shortLabel: "Eco, Pets & Outings",
    emoji: "🌱",
    description:
      "Flat-friendly recycling, energy saving, indoor plants, post, plus pets & outdoors",
  },
  {
    id: "learning_family",
    label: "Learning, Life Skills & Family",
    shortLabel: "Learning & Family",
    emoji: "📚",
    description: "Homework, reading, cooking together, and helping younger siblings",
  },
];

export function isChoreCategory(value: unknown): value is ChoreCategory {
  return (
    value === "self_care" ||
    value === "house_care" ||
    value === "eco_pets_outdoors" ||
    value === "learning_family"
  );
}

export function getChoreCategoryInfo(category: ChoreCategory): ChoreCategoryInfo {
  return CHORE_CATEGORIES.find((c) => c.id === category) ?? CHORE_CATEGORIES[0]!;
}

export function resolveChoreCategory(chore: {
  choreCategory?: ChoreCategory;
  category?: string;
  title?: string;
}): ChoreCategory {
  if (isChoreCategory(chore.choreCategory)) return chore.choreCategory;
  const text = `${chore.category ?? ""} ${chore.title ?? ""}`.toLowerCase();
  if (
    /pet|dog|cat|luna|hamster|rabbit|fish|litter|cage|plant|garden|balcony|weed|patio|car|bike|recycl|compost|energy|lights|charger|post|letterbox|reusable|scooter|wellies|kerb|wheelie|eco|outdoor/.test(
      text,
    )
  ) {
    return "eco_pets_outdoors";
  }
  if (
    /homework|english|math|read|spelling|times table|instrument|piano|guitar|coding|revision|sibling|younger|packed lunch|breakfast|dinner|bake|card|meal plan|shopping list|pe kit|swimming|learning|skill|teamwork/.test(
      text,
    )
  ) {
    return "learning_family";
  }
  if (
    /table|dish|wash up|hoover|vacuum|mop|dust|bathroom|sink|mirror|sofa|cushion|hallway|stair|worktop|kitchen|door|sort laundry|sock|airer|line|rubbish|floor|house/.test(
      text,
    )
  ) {
    return "house_care";
  }
  return "self_care";
}

export type ChorePriority = 1 | 2 | 3 | 4;

export type ChorePriorityInfo = {
  level: ChorePriority;
  stars: string;
  label: string;
  shortLabel: string;
  description: string;
};

export const CHORE_PRIORITIES: ChorePriorityInfo[] = [
  {
    level: 1,
    stars: "⭐",
    label: "1× Quick Habit (capped multi-day)",
    shortLabel: "Quick Habit",
    description: "1–2 min routine (bag, uniform, teeth, bed) — capped weekly share",
  },
  {
    level: 2,
    stars: "⭐⭐",
    label: "2× Light Chore",
    shortLabel: "Light Chore",
    description: "5–10 min task (table, pets, plants, bins) — moderate daily boost",
  },
  {
    level: 3,
    stars: "⭐⭐⭐",
    label: "3× Solid Effort",
    shortLabel: "Solid Effort",
    description: "15–20 min task (homework, reading, dishwasher) — strong daily boost",
  },
  {
    level: 4,
    stars: "⭐⭐⭐⭐",
    label: "4× Big Effort (uncapped)",
    shortLabel: "Big Effort",
    description: "30+ min big job (bedroom tidy, hoover, car) — full uncapped daily pay",
  },
];

export function isChorePriority(value: unknown): value is ChorePriority {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function getChorePriorityInfo(priority?: ChorePriority): ChorePriorityInfo {
  const level = isChorePriority(priority) ? priority : 2;
  return CHORE_PRIORITIES.find((p) => p.level === level) ?? CHORE_PRIORITIES[1]!;
}

export function resolveChorePriority(chore: {
  priority?: ChorePriority;
  value?: number;
  frequency?: ChoreFrequency;
  title?: string;
}): ChorePriority {
  if (isChorePriority(chore.priority)) return chore.priority;
  const t = (chore.title ?? "").toLowerCase();
  if (/hoover|mop|wash.*car|car.*inside|charity|bedroom tidy|litter|weed/.test(t)) {
    return 4;
  }
  if (
    /make.*bed|brush teeth|dirty clothes|basket|pack school bag|lay out.*uniform|unpack school bag|wet towel|brush hair|pe kit|sofa cushion|energy detective|close curtain|collect post|on charge downstairs|reusable.*bag|empty bedroom bin|pack.*club kit/.test(
      t,
    )
  ) {
    return 1;
  }
  if (
    /homework|math|english|dishwasher|recycl|prepare dinner|cook|bake|quiz|coding|foodbank|bedsheets|instrument|read a book/.test(
      t,
    )
  ) {
    return 3;
  }
  if (typeof chore.value === "number" && chore.value >= 200) return 4;
  if (typeof chore.value === "number" && chore.value >= 125) return 3;
  if (
    typeof chore.value === "number" &&
    chore.value > 0 &&
    chore.value <= 20 &&
    chore.frequency === "daily"
  ) {
    return 1;
  }
  return 2;
}

export type StarterChoreTemplate = {
  key: string;
  choreCategory: ChoreCategory;
  category: string;
  title: string;
  emoji: string;
  value: number;
  frequency: ChoreFrequency;
  day: number;
  days: number[];
  rewardMode?: ChoreRewardMode;
  priority?: ChorePriority;
  requirePhoto: boolean;
  description: string;
  defaultSelected?: boolean;
};

export const STARTER_CHORES: StarterChoreTemplate[] = [
  // 1. Self Care & Personal Space (18)
  {
    key: "make-bed",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Make your bed neatly",
    emoji: "🛏️",
    value: 10,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Pull up the duvet, fluff your pillow, and straighten teddies",
    defaultSelected: true,
  },
  {
    key: "brush-teeth",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Brush teeth morning & night without reminders",
    emoji: "🦷",
    value: 10,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "2 minutes morning and bedtime every single day",
  },
  {
    key: "dirty-clothes-basket",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Put dirty clothes in the laundry basket",
    emoji: "🧺",
    value: 10,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Turn clothes the right way out and pop them in the basket",
  },
  {
    key: "put-away-laundry",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Put clean folded laundry away in drawers",
    emoji: "👕",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Put tops, socks, and trousers neatly into the right drawers",
  },
  {
    key: "full-bedroom-tidy",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Full bedroom tidy & clear the floor",
    emoji: "🧹",
    value: 150,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: true,
    description: "Put toys, books, and games away so the whole floor is clear",
    defaultSelected: true,
  },
  {
    key: "tidy-desk",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Tidy and wipe down your desk",
    emoji: "🖥️",
    value: 75,
    frequency: "weekly",
    day: 4,
    days: [4],
    requirePhoto: false,
    description: "Put pens in pot, stack notebooks, and wipe the desk surface",
  },
  {
    key: "organise-bookshelf",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Organise bookshelf and toy boxes",
    emoji: "🧸",
    value: 100,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Stand books upright and sort blocks or craft bits into boxes",
  },
  {
    key: "pack-school-bag",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Pack school bag & water bottle the night before",
    emoji: "🎒",
    value: 10,
    frequency: "weekly",
    day: 0,
    days: [0, 1, 2, 3, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Check homework folder, reading book, and washed water bottle",
  },
  {
    key: "lay-out-uniform",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Lay out school uniform / clothes for tomorrow",
    emoji: "👔",
    value: 10,
    frequency: "weekly",
    day: 0,
    days: [0, 1, 2, 3, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Set out jumper, trousers/skirt, socks, and shoes before bed",
  },
  {
    key: "unpack-school-bag",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Unpack school bag & lunchbox after school",
    emoji: "🥪",
    value: 20,
    frequency: "weekly",
    day: 0,
    days: [0, 1, 2, 3, 4],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Put lunchbox in the sink, recycle wrappers, and hand over letters",
  },
  {
    key: "strip-bedsheets",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Strip bedsheets and pillowcase for wash day",
    emoji: "🛌",
    value: 100,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Take off fitted sheet, duvet cover, and pillowcases ready to wash",
  },
  {
    key: "fresh-bedsheets",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Help put fresh bedsheets back on bed",
    emoji: "✨",
    value: 100,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Fit corners tightly and put fresh pillowcases on",
  },
  {
    key: "clean-shoes",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Wipe and polish school shoes or trainers",
    emoji: "👞",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Brush off mud and scuff marks and line up shoes neatly",
  },
  {
    key: "empty-bedroom-bin",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Empty bedroom bin into the main bin",
    emoji: "🗑️",
    value: 50,
    frequency: "weekly",
    day: 4,
    days: [4],
    requirePhoto: false,
    description: "Tip bedroom paper and rubbish out and replace the liner",
  },
  {
    key: "outgrown-charity-sort",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Sort outgrown clothes or toys for charity",
    emoji: "📦",
    value: 250,
    frequency: "once",
    day: 6,
    days: [6],
    requirePhoto: true,
    description: "Try on or check old items and pack a tidy bag to donate",
  },
  {
    key: "hang-wet-towel",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Shower/bath and hang up wet towel properly",
    emoji: "🚿",
    value: 10,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Hang your towel on the rail to dry instead of leaving it on the floor",
  },
  {
    key: "morning-ready-on-time",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Brush hair & get dressed on time every morning",
    emoji: "🪮",
    value: 10,
    frequency: "weekly",
    day: 0,
    days: [0, 1, 2, 3, 4],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Ready with hair brushed and shoes on before leaving time",
  },
  {
    key: "wash-pe-kit-washbag",
    choreCategory: "self_care",
    category: "Self Care & Personal Space",
    title: "Bring PE kit & sports bag out for washing",
    emoji: "👟",
    value: 50,
    frequency: "weekly",
    day: 4,
    days: [4],
    requirePhoto: false,
    description: "Empty PE bag after club or Friday games and pop kit in the wash",
  },

  // 2. House Care & Shared Spaces (19)
  {
    key: "set-dinner-table",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Set the table for dinner",
    emoji: "🍽️",
    value: 25,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Lay out placemats, cutlery, and water glasses for everyone",
    defaultSelected: true,
  },
  {
    key: "clear-dinner-table",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Clear the table & wipe placemats after meals",
    emoji: "🧽",
    value: 25,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Scrape plates, carry dishes to kitchen, and wipe down table mats",
  },
  {
    key: "load-dishwasher",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Load dirty dishes into the dishwasher",
    emoji: "🫧",
    value: 50,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Rinse plates and stack mugs, bowls, and cutlery neatly",
  },
  {
    key: "empty-dishwasher",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Empty clean dishwasher and put dishes away",
    emoji: "🥣",
    value: 50,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Put dry plates, cups, and utensils back in their cupboards",
  },
  {
    key: "wash-dry-dishes",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Wash up and dry pots or dishes by hand",
    emoji: "🧤",
    value: 100,
    frequency: "weekly",
    day: 2,
    days: [2, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Wash non-dishwasher pans cleanly and dry with a tea towel",
  },
  {
    key: "hoover-living-hall",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Hoover the living room and hallway",
    emoji: "🧹",
    value: 150,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: true,
    description: "Move dining chairs out, hoover corners carefully, and tidy cables",
  },
  {
    key: "hoover-stairs",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Hoover the stairs",
    emoji: "🪜",
    value: 150,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Work safely from top to bottom getting dust out of stair corners",
  },
  {
    key: "mop-kitchen-floor",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Sweep and mop the kitchen or bathroom floor",
    emoji: "🪣",
    value: 150,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: true,
    description: "Sweep up crumbs first, then mop cleanly around edges",
  },
  {
    key: "dust-surfaces",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Dust living room shelves, TV unit & windowsills",
    emoji: "🪶",
    value: 100,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Gently lift ornaments, dust underneath, and put them back neatly",
  },
  {
    key: "wipe-bathroom-sink",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Wipe bathroom sink, taps & polish mirror",
    emoji: "🪞",
    value: 100,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Clean toothpaste marks off the basin, taps, and mirror",
  },
  {
    key: "take-kitchen-rubbish",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Tie up kitchen rubbish bag & replace liner",
    emoji: "🗑️",
    value: 50,
    frequency: "weekly",
    day: 2,
    days: [2, 5],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Tie bin bag tightly, pop it by the door/outside, and put a fresh bag in",
  },
  {
    key: "empty-small-bins",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Empty bathroom and study bins into main bag",
    emoji: "🚮",
    value: 100,
    frequency: "weekly",
    day: 3,
    days: [3],
    requirePhoto: false,
    description: "Collect small bin bags from each room and reline the bins",
  },
  {
    key: "tidy-sofa-cushions",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Fluff sofa cushions & fold living room throws",
    emoji: "🛋️",
    value: 10,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Straighten sofa cushions, fold blankets, and gather remotes",
  },
  {
    key: "tidy-hallway-shoes",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Tidy shoes and coats on the hallway rack",
    emoji: "🧥",
    value: 75,
    frequency: "weekly",
    day: 4,
    days: [4],
    requirePhoto: false,
    description: "Hang coats on hooks and pair everyone’s shoes neatly by the door",
  },
  {
    key: "sort-laundry-lights-darks",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Help sort family laundry into lights and darks",
    emoji: "🧺",
    value: 75,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Check pockets for tissues/coins and divide into wash piles",
  },
  {
    key: "hang-washing-airer",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Hang wet washing on the airer or clothes line",
    emoji: "👚",
    value: 100,
    frequency: "weekly",
    day: 1,
    days: [1, 5],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Shake items flat and space them neatly so they dry well",
  },
  {
    key: "pair-family-socks",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Pair up clean socks for the whole family",
    emoji: "🧦",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Match all socks from the dry laundry basket into tidy pairs",
  },
  {
    key: "wipe-kitchen-counters",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Wipe kitchen worktops & dining table after tea",
    emoji: "✨",
    value: 30,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Clear crumbs and give counters a clean wipe with cloth",
  },
  {
    key: "clean-doors-switches",
    choreCategory: "house_care",
    category: "House Care & Shared Spaces",
    title: "Wipe fingerprints off internal doors & switches",
    emoji: "🚪",
    value: 150,
    frequency: "once",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Give door handles, light switches, and skirting boards a quick wipe",
  },

  // 3. Eco, Plants, Pets & Outings (26 — 14 Flat-Friendly Eco/Plants/Errands + 12 Pet/Balcony/Garden/Car)
  {
    key: "sort-recycling",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Sort paper, tins & plastics into recycling",
    emoji: "♻️",
    value: 50,
    frequency: "weekly",
    day: 2,
    days: [2, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Works in flats & houses — rinse pots and sort recycling properly",
    defaultSelected: true,
  },
  {
    key: "flatten-cardboard",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Flatten cardboard boxes & delivery packaging",
    emoji: "📦",
    value: 75,
    frequency: "weekly",
    day: 4,
    days: [4],
    requirePhoto: false,
    description: "Peel off tape and squash parcel boxes flat for the recycling store",
  },
  {
    key: "communal-bins-trip",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Take rubbish & recycling to bin store / wheelie bins",
    emoji: "🗑️",
    value: 100,
    frequency: "weekly",
    day: 3,
    days: [3],
    requirePhoto: false,
    description: "Carry tied recycling or rubbish safely to your block bin store or kerb",
  },
  {
    key: "energy-detective",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Energy Detective: switch off lights & chargers before bed",
    emoji: "💡",
    value: 10,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Do an evening check around every room to save electricity",
  },
  {
    key: "close-curtains-dusk",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Close curtains & blinds at dusk to keep warmth in",
    emoji: "🌇",
    value: 10,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Draw curtains around the flat or house before it gets dark",
  },
  {
    key: "water-houseplants",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Water indoor houseplants & windowsill herbs",
    emoji: "🪴",
    value: 75,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Check soil moisture and water indoor plants without overflowing saucers",
  },
  {
    key: "mist-dust-plant-leaves",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Gently wipe dust off indoor houseplant leaves",
    emoji: "🌿",
    value: 100,
    frequency: "once",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Give leafy plants a clean wipe and mist them so they thrive indoors",
  },
  {
    key: "collect-post-parcels",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Collect post from lobby letterbox / doormat",
    emoji: "📬",
    value: 25,
    frequency: "weekly",
    day: 0,
    days: [0, 2, 4],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Check postbox or front mat and place letters neatly on the counter",
  },
  {
    key: "carry-shopping-up",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Carry grocery bags from door/lift & help unpack",
    emoji: "🛍️",
    value: 100,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Be a lift/stairs helper carrying shopping bags indoors and sorting",
  },
  {
    key: "pack-reusable-tote-bags",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Fold & pack reusable shopping bags by front door",
    emoji: "🧺",
    value: 50,
    frequency: "weekly",
    day: 4,
    days: [4],
    requirePhoto: false,
    description: "Make sure clean tote bags are tucked together ready for the next shop",
  },
  {
    key: "sort-food-caddy",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Relocate food waste caddy & wash the lid",
    emoji: "🍎",
    value: 50,
    frequency: "weekly",
    day: 1,
    days: [1, 4],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Empty food peelings caddy, rinse lid, and pop in a compostable liner",
  },
  {
    key: "clean-scooters-wellies",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Wipe mud off scooters, buggy wheels or wellies",
    emoji: "🛴",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Keep muddy outdoor kit clean before storing indoors or in the hall",
  },
  {
    key: "donate-foodbank-bag",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Help check cupboard tins & pack foodbank bag",
    emoji: "🥫",
    value: 150,
    frequency: "once",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Check use-by dates and pack extra tins or toiletries to donate locally",
  },
  {
    key: "library-book-return",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Gather local library books & pack for return trip",
    emoji: "🏛️",
    value: 75,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Find all borrowed books around the flat/house and put them in the book bag",
  },
  {
    key: "sweep-balcony-doorstep",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Sweep the balcony, patio or front doorstep",
    emoji: "🍂",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Brush away fallen leaves and grit on balcony, porch, or terrace",
  },
  {
    key: "feed-pets",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Feed pets & refill fresh water bowl",
    emoji: "🐈",
    value: 50,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Give the right portion of food and rinse & refill clean water",
  },
  {
    key: "walk-dog",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Help walk the dog or join family park walk",
    emoji: "🐕",
    value: 75,
    frequency: "weekly",
    day: 0,
    days: [0, 2, 4, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Clip lead, carry poo bags, and help give the dog good exercise",
  },
  {
    key: "groom-pet",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Brush & groom pet’s coat gently",
    emoji: "🪮",
    value: 100,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Give your cat, dog, or rabbit a calm brush to catch loose fur",
  },
  {
    key: "clean-litter-cage",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Clean out litter tray or small pet cage",
    emoji: "🐹",
    value: 150,
    frequency: "weekly",
    day: 2,
    days: [2, 5],
    rewardMode: "per_day",
    requirePhoto: true,
    description: "Scoop, wash tray cleanly, and add fresh bedding",
  },
  {
    key: "water-outdoor-plants",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Water balcony planters or garden flower beds",
    emoji: "🌻",
    value: 50,
    frequency: "weekly",
    day: 0,
    days: [0, 2, 4, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Water roots carefully in the morning or evening",
  },
  {
    key: "pull-weeds",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Pull weeds from flower pots, beds or path",
    emoji: "🌱",
    value: 200,
    frequency: "once",
    day: 6,
    days: [6],
    requirePhoto: true,
    description: "Wear gardening gloves and pull weeds out from the roots",
  },
  {
    key: "wheel-bins-out",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Wheel the bins out for collection & bring back",
    emoji: "🚛",
    value: 100,
    frequency: "weekly",
    day: 3,
    days: [3],
    requirePhoto: false,
    description: "Put the right bin out for collection night and tuck it back after",
  },
  {
    key: "wash-car",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Help wash & dry the family car",
    emoji: "🚙",
    value: 250,
    frequency: "once",
    day: 6,
    days: [6],
    requirePhoto: true,
    description: "Sponge soapy suds, rinse wheels, and buff windows dry",
  },
  {
    key: "tidy-car-inside",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Clear rubbish & vacuum inside the car",
    emoji: "🚗",
    value: 200,
    frequency: "once",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Gather wrappers, empty bottles, and shake out floor mats",
  },
  {
    key: "tidy-outdoor-toys",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Put bikes, footballs & outdoor kit away neatly",
    emoji: "🚲",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Lock or tuck bikes, balls, and chalks into storage",
  },
  {
    key: "wash-football-boots",
    choreCategory: "eco_pets_outdoors",
    category: "Eco, Plants, Pets & Outings",
    title: "Clean muddy bike or football boots",
    emoji: "⚽",
    value: 125,
    frequency: "once",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Brush off dry mud outside and wipe laces/frame clean",
  },

  // 4. Learning, Life Skills & Family (17)
  {
    key: "english-homework",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Complete English homework",
    emoji: "📚",
    value: 100,
    frequency: "weekly",
    day: 1,
    days: [1],
    requirePhoto: true,
    description: "Finish your English worksheet or writing task and snap a photo",
    defaultSelected: true,
  },
  {
    key: "maths-homework",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Complete Maths homework",
    emoji: "🔢",
    value: 100,
    frequency: "weekly",
    day: 2,
    days: [2],
    requirePhoto: true,
    description: "Complete your Maths questions and show clear working out",
  },
  {
    key: "reading-20m",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Read a book for 20 minutes",
    emoji: "📖",
    value: 30,
    frequency: "weekly",
    day: 0,
    days: [0, 1, 2, 3, 4],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Quiet independent reading or reading aloud to an adult",
  },
  {
    key: "instrument-practice",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Practice musical instrument for 15 minutes",
    emoji: "🎹",
    value: 50,
    frequency: "weekly",
    day: 0,
    days: [0, 2, 4],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Focused warm-ups and practice pieces without skipping",
  },
  {
    key: "spellings-times-tables",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Practice weekly spellings or times tables",
    emoji: "✏️",
    value: 25,
    frequency: "weekly",
    day: 0,
    days: [0, 1, 2, 3],
    rewardMode: "per_day",
    priority: 2,
    requirePhoto: false,
    description: "Complete 10 minutes of spelling or TT Rockstars/maths facts",
  },
  {
    key: "help-prepare-dinner",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Help prepare dinner (peeling veg, salad, stirring)",
    emoji: "🥕",
    value: 100,
    frequency: "weekly",
    day: 2,
    days: [2, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Wash hands first and team up in the kitchen as sous-chef",
  },
  {
    key: "make-own-lunch",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Make your own packed lunch & snack box",
    emoji: "🥪",
    value: 40,
    frequency: "weekly",
    day: 0,
    days: [0, 1, 2, 3, 6],
    rewardMode: "per_day",
    requirePhoto: false,
    description: "Build a balanced sandwich/wrap, chop fruit, and chill overnight",
  },
  {
    key: "weekend-family-breakfast",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Help make weekend breakfast for the family",
    emoji: "🥞",
    value: 125,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Toast, fruit bowls, smoothies, or flipping pancakes with a parent",
  },
  {
    key: "story-with-sibling",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Read a story or play kindly with younger sibling",
    emoji: "🤝",
    value: 100,
    frequency: "weekly",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Share turns nicely or read a picture book together before bed",
  },
  {
    key: "help-sibling-toys",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Help a younger sibling tidy up toys together",
    emoji: "🧩",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Teamwork bonus for putting shared board games and toys away",
  },
  {
    key: "screens-off-charge-station",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Put tablet/phone on charge downstairs before bed",
    emoji: "📱",
    value: 15,
    frequency: "daily",
    day: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Plug screens in outside the bedroom 30 minutes before sleep",
  },
  {
    key: "write-thank-you-cards",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Write thank-you or birthday cards for relatives",
    emoji: "💌",
    value: 150,
    frequency: "once",
    day: 6,
    days: [6],
    requirePhoto: true,
    description: "Handwrite a thoughtful message and address the envelope neatly",
  },
  {
    key: "plan-meals-shopping-list",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Help plan 3 family dinners & write shopping list",
    emoji: "📝",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Check fridge & cupboards first so nothing gets wasted or bought twice",
  },
  {
    key: "bake-with-parent",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Bake a cake or healthy snack with a parent",
    emoji: "🧁",
    value: 100,
    frequency: "once",
    day: 5,
    days: [5],
    requirePhoto: true,
    description: "Measure ingredients carefully and help wash mixing bowls afterwards",
  },
  {
    key: "extra-revision-coding",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Complete an extra quiz, coding puzzle or worksheet",
    emoji: "💻",
    value: 150,
    frequency: "once",
    day: 5,
    days: [5],
    requirePhoto: false,
    description: "Stretch your brain with a bonus learning challenge at home",
  },
  {
    key: "pack-club-kit",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Check calendar & pack swimming/club kit night before",
    emoji: "🏊",
    value: 25,
    frequency: "weekly",
    day: 0,
    days: [0, 3],
    rewardMode: "per_day",
    priority: 1,
    requirePhoto: false,
    description: "Pack towel, goggles, shin pads, or kit bag without a morning rush",
  },
  {
    key: "ring-grandparents",
    choreCategory: "learning_family",
    category: "Learning, Life Skills & Family",
    title: "Call or video-chat grandparents/relatives to catch up",
    emoji: "📞",
    value: 100,
    frequency: "weekly",
    day: 6,
    days: [6],
    requirePhoto: false,
    description: "Tell them the best part of your week and ask how they are",
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
  choreCategory?: ChoreCategory;
  priority?: ChorePriority;
  proof?: string;
  note?: string;
  description?: string;
  frequency?: ChoreFrequency;
  days?: number[];
  rewardMode?: ChoreRewardMode;
  completedDays?: number[];
  priceLocked?: boolean;
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

export type WeeklyBonusWeek = {
  weekKey: string;
  baseBudget: number;
  bonusAmount: number;
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
  weeklyBudgets?: Record<string, number>;
  weeklyBonusWeeks?: Record<string, WeeklyBonusWeek>;
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
  weeklyMax: number;
  remainingToEarn: number;
  earnedPercent: number;
  pendingPercent: number;
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

export function choreScheduledDays(chore: Chore): number[] {
  if (chore.frequency === "daily") return [0, 1, 2, 3, 4, 5, 6];
  if (chore.frequency === "once") return [chore.day ?? 0];
  if (chore.days && chore.days.length > 0) {
    return Array.from(new Set(chore.days)).sort((a, b) => a - b);
  }
  return [chore.day ?? 0];
}

export function choreScheduledDaysCount(chore: Chore): number {
  return Math.max(1, choreScheduledDays(chore).length);
}

export function choreRewardMode(chore: Chore): ChoreRewardMode {
  if (chore.frequency === "once" || choreScheduledDaysCount(chore) <= 1) {
    return "all_days";
  }
  return chore.rewardMode === "all_days" ? "all_days" : "per_day";
}

export function choreWeeklyMax(chore: Chore): number {
  const count = choreScheduledDaysCount(chore);
  if (count > 1 && choreRewardMode(chore) === "per_day") {
    return chore.value * count;
  }
  return chore.value;
}

export function nextDayToComplete(chore: Chore, preferDay = today()): number {
  const scheduled = choreScheduledDays(chore);
  const done = new Set(chore.completedDays ?? []);
  if (scheduled.includes(preferDay) && !done.has(preferDay)) {
    return preferDay;
  }
  return scheduled.find((d) => !done.has(d)) ?? preferDay;
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
  let rawChoreMax = 0;
  for (const chore of state.chores) {
    if (chore.childId !== childId) continue;
    rawChoreMax += choreWeeklyMax(chore);
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

  const weeklyMax = Math.max(rawChoreMax, earnedThisWeek);
  const earnedPercent =
    weeklyMax > 0 ? Math.min(100, Math.round((earnedThisWeek / weeklyMax) * 100)) : 0;
  const pendingPercent =
    weeklyMax > 0
      ? Math.min(100 - earnedPercent, Math.round((pendingAmount / weeklyMax) * 100))
      : 0;
  const remainingToEarn = Math.max(0, weeklyMax - earnedThisWeek - pendingAmount);

  return {
    earnedThisWeek,
    paidThisWeek,
    pendingAmount,
    pendingCount,
    approvedCount,
    unpaidBalance: balance(state, childId),
    totalSaved,
    weeklyMax,
    remainingToEarn,
    earnedPercent,
    pendingPercent,
  };
}

export function familyWeeklyPotSummary(
  state: FamilyState,
  childIds: string[],
  now = new Date(),
): WeeklySummary {
  const targetIds =
    childIds.length > 0
      ? childIds
      : Array.from(
          new Set([...state.chores.map((c) => c.childId), ...state.ledger.map((e) => e.childId)]),
        );

  let earnedThisWeek = 0;
  let paidThisWeek = 0;
  let pendingAmount = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  let unpaidBalance = 0;
  let totalSaved = 0;
  let weeklyMax = 0;

  for (const id of targetIds) {
    const sub = childWeeklySummary(state, id, now);
    earnedThisWeek += sub.earnedThisWeek;
    paidThisWeek += sub.paidThisWeek;
    pendingAmount += sub.pendingAmount;
    pendingCount += sub.pendingCount;
    approvedCount += sub.approvedCount;
    unpaidBalance += sub.unpaidBalance;
    totalSaved += sub.totalSaved;
    weeklyMax += sub.weeklyMax;
  }

  weeklyMax = Math.max(weeklyMax, earnedThisWeek);
  const earnedPercent =
    weeklyMax > 0 ? Math.min(100, Math.round((earnedThisWeek / weeklyMax) * 100)) : 0;
  const pendingPercent =
    weeklyMax > 0
      ? Math.min(100 - earnedPercent, Math.round((pendingAmount / weeklyMax) * 100))
      : 0;
  const remainingToEarn = Math.max(0, weeklyMax - earnedThisWeek - pendingAmount);

  return {
    earnedThisWeek,
    paidThisWeek,
    pendingAmount,
    pendingCount,
    approvedCount,
    unpaidBalance,
    totalSaved,
    weeklyMax,
    remainingToEarn,
    earnedPercent,
    pendingPercent,
  };
}

export type BudgetSplitMode = "overwrite_all" | "unpriced_only";

export type ChoreLockType = "none" | "manual" | "pending" | "existing_price";

export type ChoreSplitAllocation = {
  choreId: string;
  priority: ChorePriority;
  locked: boolean;
  lockType: ChoreLockType;
  oldValue: number;
  newValue: number;
  newWeeklyMax: number;
  daysCount: number;
  rewardMode: ChoreRewardMode;
};

export function childWeeklyBonusInfo(
  state: FamilyState,
  config: HouseholdConfig | undefined,
  childId: string,
  now = new Date(),
): { bonusAmount: number; baseBudget: number; hasBonus: boolean } {
  const thisWeek = currentWeekKey(now);
  const entry = config?.weeklyBonusWeeks?.[childId];
  if (!entry || entry.weekKey !== thisWeek || entry.bonusAmount <= 0) {
    return {
      bonusAmount: 0,
      baseBudget: config?.weeklyBudgets?.[childId] ?? 0,
      hasBonus: false,
    };
  }
  const summary = childWeeklySummary(state, childId, now);
  const liveBonus = Math.max(0, summary.weeklyMax - entry.baseBudget);
  return {
    bonusAmount: liveBonus,
    baseBudget: entry.baseBudget,
    hasBonus: liveBonus > 0,
  };
}

export type ChildBudgetSplitResult = {
  childId: string;
  budgetPence: number;
  lockedWeeklyPence: number;
  availableToSplitPence: number;
  allocatedWeeklyTotalPence: number;
  allocations: ChoreSplitAllocation[];
};

export function choreSplitWeeklyWeight(
  priority: ChorePriority,
  daysCount: number,
  rewardMode: ChoreRewardMode,
): number {
  const extraDays = Math.max(0, daysCount - 1);
  if (daysCount <= 1) return priority;
  if (rewardMode === "per_day") {
    const scaleByPriority: Record<ChorePriority, number> = {
      1: 0.05,
      2: 0.35,
      3: 0.75,
      4: 1.0,
    };
    return priority * (1 + scaleByPriority[priority] * extraDays);
  }
  const streakScaleByPriority: Record<ChorePriority, number> = {
    1: 0.03,
    2: 0.15,
    3: 0.3,
    4: 0.5,
  };
  return priority * (1 + streakScaleByPriority[priority] * extraDays);
}

export function calculateChildBudgetSplit(
  chores: Chore[],
  childId: string,
  budgetPence: number,
  mode: BudgetSplitMode,
  priorityOverrides?: Record<string, ChorePriority>,
  manualLocks?: Record<string, number>,
): ChildBudgetSplitResult {
  const targetBudget = Math.max(0, Math.round(budgetPence));
  const childChores = chores.filter((c) => c.childId === childId);

  let lockedWeeklyPence = 0;
  const lockedAllocs: ChoreSplitAllocation[] = [];

  type WorkingAlloc = {
    choreId: string;
    priority: ChorePriority;
    oldValue: number;
    daysCount: number;
    rewardMode: ChoreRewardMode;
    isPerDay: boolean;
    weight: number;
    exactWeekly: number;
    newValue: number;
    newWeeklyMax: number;
    remainderScore: number;
  };
  const working: WorkingAlloc[] = [];

  for (const c of childChores) {
    const priority = priorityOverrides?.[c.id] ?? resolveChorePriority(c);
    const daysCount = choreScheduledDaysCount(c);
    const rMode = choreRewardMode(c);
    const isPerDay = daysCount > 1 && rMode === "per_day";

    if (c.status === "pending") {
      const wMax = choreWeeklyMax(c);
      lockedWeeklyPence += wMax;
      lockedAllocs.push({
        choreId: c.id,
        priority,
        locked: true,
        lockType: "pending",
        oldValue: c.value,
        newValue: c.value,
        newWeeklyMax: wMax,
        daysCount,
        rewardMode: rMode,
      });
    } else if (manualLocks !== undefined && c.id in manualLocks) {
      const weeklyTarget = Math.max(0, Math.round(manualLocks[c.id] ?? 0));
      const nextVal = isPerDay ? Math.max(0, Math.round(weeklyTarget / daysCount)) : weeklyTarget;
      const wMax = isPerDay ? nextVal * daysCount : nextVal;
      lockedWeeklyPence += wMax;
      lockedAllocs.push({
        choreId: c.id,
        priority,
        locked: true,
        lockType: "manual",
        oldValue: c.value,
        newValue: nextVal,
        newWeeklyMax: wMax,
        daysCount,
        rewardMode: rMode,
      });
    } else if (manualLocks === undefined && c.priceLocked) {
      const wMax = choreWeeklyMax(c);
      lockedWeeklyPence += wMax;
      lockedAllocs.push({
        choreId: c.id,
        priority,
        locked: true,
        lockType: "manual",
        oldValue: c.value,
        newValue: c.value,
        newWeeklyMax: wMax,
        daysCount,
        rewardMode: rMode,
      });
    } else if (mode === "unpriced_only" && c.value > 0) {
      const wMax = choreWeeklyMax(c);
      lockedWeeklyPence += wMax;
      lockedAllocs.push({
        choreId: c.id,
        priority,
        locked: true,
        lockType: "existing_price",
        oldValue: c.value,
        newValue: c.value,
        newWeeklyMax: wMax,
        daysCount,
        rewardMode: rMode,
      });
    } else {
      const weight = choreSplitWeeklyWeight(priority, daysCount, rMode);
      working.push({
        choreId: c.id,
        priority,
        oldValue: c.value,
        daysCount,
        rewardMode: rMode,
        isPerDay,
        weight,
        exactWeekly: 0,
        newValue: 0,
        newWeeklyMax: 0,
        remainderScore: 0,
      });
    }
  }

  const availableToSplitPence = Math.max(0, targetBudget - lockedWeeklyPence);
  const totalWeight = working.reduce((sum, item) => sum + item.weight, 0);

  if (working.length > 0 && totalWeight > 0 && availableToSplitPence > 0) {
    for (const item of working) {
      item.exactWeekly = (availableToSplitPence * item.weight) / totalWeight;
      if (item.isPerDay) {
        const perDayExact = item.exactWeekly / item.daysCount;
        const rounded = Math.round(perDayExact);
        item.newValue = Math.max(availableToSplitPence >= item.daysCount ? 1 : 0, rounded);
        item.newWeeklyMax = item.newValue * item.daysCount;
        item.remainderScore = perDayExact - item.newValue;
      } else {
        const rounded = Math.round(item.exactWeekly);
        item.newValue = Math.max(1, rounded);
        item.newWeeklyMax = item.newValue;
        item.remainderScore = item.exactWeekly - item.newValue;
      }
    }

    const currentUnlockedTotal = working.reduce((sum, item) => sum + item.newWeeklyMax, 0);
    let diff = availableToSplitPence - currentUnlockedTotal;

    const singles = working.filter((item) => !item.isPerDay);
    const perDays = working.filter((item) => item.isPerDay);

    let guard = 0;
    while (diff > 0 && singles.length > 0 && guard < 10000) {
      guard += 1;
      singles.sort(
        (a, b) =>
          b.remainderScore - a.remainderScore || b.priority - a.priority || a.newValue - b.newValue,
      );
      for (const s of singles) {
        if (diff <= 0) break;
        s.newValue += 1;
        s.newWeeklyMax += 1;
        s.remainderScore -= 1;
        diff -= 1;
      }
    }

    while (diff < 0 && singles.length > 0 && guard < 20000) {
      guard += 1;
      const minKeep = singles.length <= availableToSplitPence ? 1 : 0;
      const decreasable = singles.filter((s) => s.newValue > minKeep);
      if (decreasable.length === 0) break;
      decreasable.sort(
        (a, b) =>
          a.remainderScore - b.remainderScore || a.priority - b.priority || b.newValue - a.newValue,
      );
      for (const s of decreasable) {
        if (diff >= 0) break;
        if (s.newValue <= minKeep) continue;
        s.newValue -= 1;
        s.newWeeklyMax -= 1;
        s.remainderScore += 1;
        diff += 1;
      }
    }

    // Reconcile remaining difference using multi-day per_day chores if still non-zero
    if (diff !== 0 && perDays.length > 0) {
      while (diff > 0 && guard < 25000) {
        guard += 1;
        const candidates = perDays
          .filter((p) => p.daysCount <= diff)
          .sort((a, b) => b.priority - a.priority || b.remainderScore - a.remainderScore);
        const pick = candidates[0];
        if (!pick) break;
        pick.newValue += 1;
        pick.newWeeklyMax += pick.daysCount;
        diff -= pick.daysCount;
      }
      while (diff < 0 && guard < 30000) {
        guard += 1;
        const candidates = perDays
          .filter((p) => p.newValue > 0 && Math.abs(diff + p.daysCount) < Math.abs(diff))
          .sort((a, b) => a.priority - b.priority || a.remainderScore - b.remainderScore);
        const pick = candidates[0];
        if (!pick) break;
        pick.newValue -= 1;
        pick.newWeeklyMax -= pick.daysCount;
        diff += pick.daysCount;
      }
    }
  }

  const byId = new Map<string, ChoreSplitAllocation>();
  for (const l of lockedAllocs) {
    byId.set(l.choreId, l);
  }
  for (const w of working) {
    byId.set(w.choreId, {
      choreId: w.choreId,
      priority: w.priority,
      locked: false,
      lockType: "none",
      oldValue: w.oldValue,
      newValue: w.newValue,
      newWeeklyMax: w.newWeeklyMax,
      daysCount: w.daysCount,
      rewardMode: w.rewardMode,
    });
  }

  const allocations = childChores
    .map((c) => byId.get(c.id))
    .filter((a): a is ChoreSplitAllocation => Boolean(a));
  const allocatedWeeklyTotalPence = allocations.reduce((sum, a) => sum + a.newWeeklyMax, 0);

  return {
    childId,
    budgetPence: targetBudget,
    lockedWeeklyPence,
    availableToSplitPence,
    allocatedWeeklyTotalPence,
    allocations,
  };
}

const stamp = new Date().toISOString();
const prevWeekStamp = new Date(Date.now() - 10 * 86400000).toISOString();

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
        choreCategory: "self_care",
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
        choreCategory: "learning_family",
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
        choreCategory: "eco_pets_outdoors",
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
        choreCategory: "house_care",
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
        choreCategory: "eco_pets_outdoors",
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
        choreCategory: "eco_pets_outdoors",
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
        choreCategory: "eco_pets_outdoors",
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
        amount: 100,
        type: "earning",
        date: stamp,
      },
      {
        id: "e2",
        childId: "amelia",
        title: "This week’s chores",
        amount: 150,
        type: "earning",
        date: stamp,
      },
      {
        id: "e3",
        childId: "oliver",
        title: "Previous savings",
        amount: 2150,
        type: "earning",
        date: prevWeekStamp,
      },
      {
        id: "e4",
        childId: "amelia",
        title: "Previous savings",
        amount: 1750,
        type: "earning",
        date: prevWeekStamp,
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
    const rewardMode: ChoreRewardMode =
      payload["rewardMode"] === "all_days" ? "all_days" : "per_day";
    const choreCategory = isChoreCategory(payload["choreCategory"])
      ? payload["choreCategory"]
      : resolveChoreCategory({ title: String(payload["title"] ?? "") });
    const value = Number(payload["value"] ?? 0);
    const priority = isChorePriority(payload["priority"])
      ? payload["priority"]
      : resolveChorePriority({
          title: String(payload["title"] ?? ""),
          frequency,
          value,
        });
    const newChore: Chore = {
      id: crypto.randomUUID(),
      title: String(payload["title"] ?? ""),
      childId: String(payload["childId"] ?? ""),
      day: rawDays[0] ?? Number(payload["day"] ?? 0),
      days: rawDays,
      frequency,
      choreCategory,
      priority,
      rewardMode,
      completedDays: [],
      value,
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
    if (isChoreCategory(payload["choreCategory"])) {
      chore.choreCategory = payload["choreCategory"];
    }
    if (isChorePriority(payload["priority"])) {
      chore.priority = payload["priority"];
    }
    if (Array.isArray(payload["days"])) {
      const nextDays = (payload["days"] as number[]).map(Number);
      chore.days = nextDays;
      chore.day = nextDays[0] ?? chore.day;
    } else if (typeof payload["day"] === "number") {
      chore.day = payload["day"];
    }
    if (payload["rewardMode"] === "all_days" || payload["rewardMode"] === "per_day") {
      chore.rewardMode = payload["rewardMode"];
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
      chore.completedDays = [];
      delete chore.proof;
      delete chore.note;
      delete chore.submittedAt;
    } else {
      for (const c of s.chores) {
        if (c.status === "approved" && c.frequency !== "once") {
          c.status = "todo";
          c.weekKey = currentWeekKey();
          c.completedDays = [];
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
    const totalDays = choreScheduledDaysCount(chore);
    const mode = choreRewardMode(chore);
    const dayDone = nextDayToComplete(chore);
    const nextCompletedDays = Array.from(new Set([...(chore.completedDays ?? []), dayDone])).sort(
      (a, b) => a - b,
    );
    chore.completedDays = nextCompletedDays;

    if (totalDays > 1 && mode === "all_days" && nextCompletedDays.length < totalDays) {
      chore.status = "todo";
      delete chore.proof;
      delete chore.note;
      delete chore.submittedAt;
      s.notifications.push({
        id: crypto.randomUUID(),
        title: chore.title,
        message: `Day confirmed (${nextCompletedDays.length}/${totalDays}) — complete all ${totalDays} days to earn ${money(chore.value)}!`,
        childId: chore.childId,
        date: new Date().toISOString(),
        targetRole: "child",
      });
    } else {
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
    }
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
  } else if (action === "apply_budget_split") {
    const updates = Array.isArray(payload["updates"])
      ? (payload["updates"] as Array<Record<string, unknown>>)
      : [];
    for (const item of updates) {
      const target = s.chores.find((c) => c.id === item["id"]);
      if (!target) continue;
      if (typeof item["value"] === "number" && item["value"] >= 0) {
        target.value = Math.round(item["value"]);
      }
      if (isChorePriority(item["priority"])) {
        target.priority = item["priority"];
      }
      if (typeof item["priceLocked"] === "boolean") {
        target.priceLocked = item["priceLocked"];
      }
    }
    const bonusNotifications = Array.isArray(payload["bonusNotices"])
      ? (payload["bonusNotices"] as Array<Record<string, unknown>>)
      : [];
    for (const n of bonusNotifications) {
      s.notifications.push({
        id: crypto.randomUUID(),
        title: String(n["title"] ?? "🌟 Bonus pocket money unlocked!"),
        message: String(n["message"] ?? ""),
        childId: String(n["childId"] ?? ""),
        date: new Date().toISOString(),
        targetRole: "child",
      });
    }
  } else if (action === "clear_notifications") {
    s.notifications = [];
  }

  return s;
}
