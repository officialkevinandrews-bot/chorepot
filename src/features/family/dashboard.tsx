import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  Wallet,
  Users,
  Settings,
  Bell,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUpRight,
  Check,
  Clock,
  Camera,
  X,
  LogOut,
  Copy,
  Sprout,
  Heart,
  Target,
  CheckCheck,
  Menu,
  Pencil,
  Trash2,
  RotateCcw,
  Share2,
  MessageCircle,
  Mail,
  Trophy,
  Minus,
  Lock,
  Tablet,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { executeFamilyAction, resolveProofUrl, uploadOrEncodePhotoProof } from "./family-client";
import { enablePush } from "./push";
import {
  money,
  balance,
  days,
  fullDays,
  today,
  defaultHouseholdConfig,
  isChoreScheduledOnDay,
  formatChoreSchedule,
  nextPaydayInfo,
  childWeeklySummary,
  type Family,
  type Chore,
  type ChoreFrequency,
  type Goal,
} from "./model";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Chores", icon: ListChecks },
  { name: "Weekly schedule", icon: CalendarDays },
  { name: "Pocket money", icon: Wallet },
  { name: "Our family", icon: Users },
];

const choreEmojis = [
  "🧹",
  "🛏️",
  "📚",
  "🐈",
  "🐕",
  "🍽️",
  "♻️",
  "🪴",
  "🚙",
  "🧺",
  "🦷",
  "🎹",
  "🎒",
  "🧸",
];

const goalEmojis = ["🧱", "🎨", "🎮", "🚲", "🧸", "⚽", "🎧", "📚", "🛹"];
const childAvatars = ["👧🏼", "🧑🏼‍🚀", "👩🏻‍🎨", "🦊", "🐼", "🦁", "🐸", "🦄"];
const rewardPresets = [20, 50, 100, 200, 500];

const modalTitles: Record<string, string> = {
  chore: "A new little mission",
  edit_chore: "Edit chore",
  review: "A little check, a big well done",
  reject: "Let’s give it another go",
  complete: "You did it! 🎉",
  invite: "Add or invite family member",
  goal: "What are you dreaming of?",
  edit_goal: "Edit savings goal",
  allocate: "Add to your savings",
  withdraw_goal: "Take out from savings",
  notifications: "Your family’s updates",
  settings: "Your family profile",
  payday: "Choose payday schedule",
  pay: "It’s pocket money time!",
  unlock_pin: "Enter Parent PIN",
};

export function Dashboard({ family, onRefresh }: { family: Family; onRefresh?: () => void }) {
  const [data, setData] = useState<Family>(family);
  const [view, setView] = useState("Overview");
  const [child, setChild] = useState("all");
  const [kidModeChildId, setKidModeChildId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Chore | Goal | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [invite, setInvite] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTab, setInviteTab] = useState<"direct_child" | "link">("direct_child");
  const [newChildName, setNewChildName] = useState("");
  const [newChildAvatar, setNewChildAvatar] = useState("👧🏼");
  const [newChildEmail, setNewChildEmail] = useState("");
  const [newChildWithCode, setNewChildWithCode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(today());
  const [mobile, setMobile] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // Chore form state
  const [choreFrequency, setChoreFrequency] = useState<ChoreFrequency>("weekly");
  const [choreDays, setChoreDays] = useState<number[]>([today()]);
  const [choreValueStr, setChoreValueStr] = useState("1.00");
  const [choreRequirePhoto, setChoreRequirePhoto] = useState(false);

  // Payday & PIN form state
  const [paydayFreq, setPaydayFreq] = useState<"weekly" | "monthly">("weekly");
  const [paydayDay, setPaydayDay] = useState<number>(4);
  const [settingsPin, setSettingsPin] = useState("");

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isChildAccount = data.role === "child";
  const inKidMode = !isChildAccount && Boolean(kidModeChildId);
  const isChild = isChildAccount || inKidMode;
  const activeChild = isChildAccount ? data.userId : kidModeChildId;
  const children = data.members.filter((m) => m.role === "child");
  const profile =
    data.members.find((m) => m.id === (isChild ? activeChild : data.userId)) ?? data.members[0];
  const pending = data.state.chores.filter((c) => c.status === "pending");
  const filtered = data.state.chores.filter((c) =>
    isChild ? c.childId === activeChild : child === "all" || c.childId === child,
  );
  const todays = filtered.filter((c) => isChoreScheduledOnDay(c, day));
  const total = children.reduce((sum, m) => sum + balance(data.state, m.id), 0);
  const completed = (isChild ? filtered : data.state.chores).filter(
    (c) => c.status === "approved",
  ).length;
  const totalChoresCount = (isChild ? filtered : data.state.chores).length;
  const hasApprovedRecurring = data.state.chores.some(
    (c) => c.status === "approved" && c.frequency !== "once",
  );
  const paydayInfo = nextPaydayInfo(data.config);
  const celebrationsEnabled = data.preferences?.celebrations !== false;
  const visibleNotifications = inKidMode ? [] : data.state.notifications;

  useEffect(() => {
    setData(family);
  }, [family]);

  useEffect(() => {
    if (typeof window === "undefined" || data.role === "child") return;
    const saved = localStorage.getItem("chorepot-kid-mode") ?? "";
    if (saved && data.members.some((m) => m.id === saved && m.role === "child")) {
      setKidModeChildId(saved);
    } else if (saved) {
      localStorage.removeItem("chorepot-kid-mode");
      setKidModeChildId("");
    }
  }, [data.role, data.members]);

  useEffect(() => {
    let active = true;
    if (selected && "proof" in selected && selected.proof) {
      void resolveProofUrl(selected.proof, false).then((url) => {
        if (active) setProofUrl(url);
      });
    } else {
      setProofUrl("");
    }
    return () => {
      active = false;
    };
  }, [selected]);

  function triggerCelebration() {
    if (!celebrationsEnabled) return;
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 2200);
  }

  function handleModeChange(nextId: string) {
    if (nextId === "") {
      if (data.config?.parentPin) {
        setPinInput("");
        setModal("unlock_pin");
      } else {
        setKidModeChildId("");
        if (typeof window !== "undefined") {
          localStorage.removeItem("chorepot-kid-mode");
        }
        setView("Overview");
      }
    } else {
      setKidModeChildId(nextId);
      if (typeof window !== "undefined") {
        localStorage.setItem("chorepot-kid-mode", nextId);
      }
      setView("Overview");
    }
  }

  async function act(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const updatedFamily = await executeFamilyAction(data, action, payload);
      setData(updatedFamily);
      onRefresh?.();

      const successMsg =
        action === "approve"
          ? "Approved! Pocket money added."
          : action === "complete"
            ? "Amazing work! Sent for approval."
            : action === "pay"
              ? "Payday recorded."
              : action === "reject"
                ? "Sent back with your note."
                : action === "delete_chore"
                  ? "Chore deleted."
                  : action === "reset_chore"
                    ? "Chores reset to To do."
                    : action === "delete_goal"
                      ? "Savings goal removed."
                      : action === "remove_managed_child"
                        ? "Child profile removed."
                        : action === "clear_notifications"
                          ? "Notifications cleared."
                          : "All saved!";
      toast.success(successMsg);

      if (["complete", "allocate", "achieve_goal"].includes(action)) {
        triggerCelebration();
      }
      setModal(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function open(kind: string, item?: Chore | Goal) {
    setSelected(item ?? null);
    setProof(null);
    setInvite("");
    setInviteEmail("");

    if (kind === "invite") {
      setInviteTab("direct_child");
      setNewChildName("");
      setNewChildAvatar("👧🏼");
      setNewChildEmail("");
      setNewChildWithCode(true);
    } else if (kind === "chore") {
      setChoreFrequency("weekly");
      setChoreDays([today()]);
      setChoreValueStr("1.00");
      setChoreRequirePhoto(false);
    } else if (kind === "edit_chore" && item && "value" in item) {
      setChoreFrequency(item.frequency ?? "weekly");
      setChoreDays(item.days && item.days.length > 0 ? item.days : [item.day ?? today()]);
      setChoreValueStr((item.value / 100).toFixed(2));
      setChoreRequirePhoto(Boolean(item.requirePhoto));
    } else if (kind === "payday" || kind === "settings") {
      const cfg = data.config ?? defaultHouseholdConfig;
      setPaydayFreq(cfg.paydayFrequency);
      setPaydayDay(cfg.paydayDay);
      setSettingsPin(cfg.parentPin ?? "");
    }

    setModal(kind);
  }

  function toggleChoreDay(dayIndex: number) {
    setChoreDays((prev) => {
      if (prev.includes(dayIndex)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayIndex);
      }
      return [...prev, dayIndex].sort((a, b) => a - b);
    });
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = (key: string) => String(f.get(key) ?? "");

    if (modal === "unlock_pin") {
      if (pinInput === (data.config?.parentPin ?? "")) {
        setKidModeChildId("");
        if (typeof window !== "undefined") {
          localStorage.removeItem("chorepot-kid-mode");
        }
        setModal(null);
        setView("Overview");
        toast.success("Back in Parent view");
      } else {
        toast.error("Incorrect Parent PIN");
      }
      return;
    }

    if (modal === "chore" || modal === "edit_chore") {
      const selectedDays =
        choreFrequency === "daily"
          ? [0, 1, 2, 3, 4, 5, 6]
          : choreFrequency === "once"
            ? [Number(value("singleDay") || choreDays[0] || today())]
            : choreDays.length > 0
              ? choreDays
              : [today()];
      const pence = Math.round(Number(choreValueStr) * 100);
      if (Number.isNaN(pence) || pence < 0 || pence > 100000) {
        toast.error("Please enter a reward between £0.00 and £1000.00");
        return;
      }

      if (modal === "chore") {
        await act("create_chore", {
          title: value("title"),
          description: value("description"),
          childId: value("childId"),
          value: pence,
          day: selectedDays[0] ?? 0,
          days: selectedDays,
          frequency: choreFrequency,
          emoji: value("emoji"),
          requirePhoto: choreRequirePhoto,
        });
      } else if (selected && "value" in selected) {
        await act("edit_chore", {
          id: selected.id,
          title: selected.status === "pending" ? selected.title : value("title"),
          description: value("description"),
          childId: selected.status === "pending" ? selected.childId : value("childId"),
          value: selected.status === "pending" ? selected.value : pence,
          day: selectedDays[0] ?? 0,
          days: selectedDays,
          frequency: choreFrequency,
          emoji: value("emoji"),
          requirePhoto: choreRequirePhoto,
        });
      }
    } else if (modal === "reject" && selected) {
      await act("reject", { id: selected.id, note: value("note") });
    } else if (modal === "goal") {
      const goalChild = isChild ? activeChild : value("childId") || activeChild;
      await act("goal", {
        childId: goalChild,
        title: value("title"),
        emoji: value("emoji"),
        target: Math.round(Number(value("target")) * 100),
      });
    } else if (modal === "edit_goal" && selected && "target" in selected) {
      await act("edit_goal", {
        id: selected.id,
        title: value("title"),
        emoji: value("emoji"),
        target: Math.round(Number(value("target")) * 100),
        saved: Math.round(Number(value("saved")) * 100),
      });
    } else if (modal === "allocate" && selected) {
      await act("allocate", {
        id: selected.id,
        amount: Math.round(Number(value("amount")) * 100),
      });
    } else if (modal === "withdraw_goal" && selected) {
      await act("withdraw_goal", {
        id: selected.id,
        amount: Math.round(Number(value("amount")) * 100),
      });
    } else if (modal === "complete" && selected && "value" in selected) {
      if (selected.requirePhoto && !proof) {
        toast.error("Please attach a photo proof for this chore.");
        return;
      }
      setBusy(true);
      let path = "";
      try {
        if (proof) {
          path = await uploadOrEncodePhotoProof(data.userId, proof, false);
        }
      } catch (err) {
        setBusy(false);
        toast.error(err instanceof Error ? err.message : "Photo upload failed");
        return;
      }
      await act("complete", { id: selected.id, proof: path });
    } else if (modal === "invite") {
      setBusy(true);
      try {
        if (inviteTab === "direct_child") {
          const email = newChildEmail.trim();
          let code = "";
          if (newChildWithCode) {
            const { data: generated, error } = await supabase.rpc("family_invite", {
              invite_role: "child",
              invite_email: email,
            });
            if (error) throw new Error(error.message);
            code = generated ?? "";
          }
          const updated = await executeFamilyAction(data, "add_managed_child", {
            name: newChildName,
            avatar: newChildAvatar,
            email,
            inviteCode: code,
          });
          setData(updated);
          onRefresh?.();
          toast.success(`${newChildName.trim()} added to your family!`);
          if (code) {
            setInviteEmail(email);
            setInvite(code);
          } else {
            setModal(null);
          }
        } else {
          const email = value("email").trim();
          const role = value("role");
          const inviteName = value("inviteName").trim();
          setInviteEmail(email);
          const { data: code, error } = await supabase.rpc("family_invite", {
            invite_role: role,
            invite_email: email,
          });
          if (error) throw new Error(error.message);
          if (code) {
            const updated = await executeFamilyAction(data, "save_pending_invite", {
              name: inviteName || (role === "co_parent" ? "Co-parent" : "Child"),
              email,
              role,
              code,
            });
            setData(updated);
            onRefresh?.();
            setInvite(code);
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save invite");
      } finally {
        setBusy(false);
      }
    } else if (modal === "payday") {
      await act("update_config", {
        paydayFrequency: paydayFreq,
        paydayDay: paydayDay,
      });
    } else if (modal === "settings") {
      if (settingsPin && !/^\d{4}$/.test(settingsPin)) {
        toast.error("Parent PIN must be 4 digits (or leave it blank)");
        return;
      }
      const celebrationsChecked = f.get("celebrations") === "on";
      setBusy(true);
      try {
        let latestFamily = await executeFamilyAction(data, "update_profile", {
          name: value("name"),
          avatar: value("avatar"),
          celebrations: celebrationsChecked,
        });
        if (!isChild) {
          latestFamily = await executeFamilyAction(latestFamily, "update_config", {
            paydayFrequency: paydayFreq,
            paydayDay: paydayDay,
            parentPin: settingsPin,
          });
        }
        setData(latestFamily);
        onRefresh?.();
        toast.success("Profile updated");
        setModal(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update profile");
      } finally {
        setBusy(false);
      }
    }
  }

  const member = (id: string) => data.members.find((m) => m.id === id);

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    if (typeof window !== "undefined") {
      localStorage.removeItem("chorepot-kid-mode");
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function shareInvite(code: string, channel: "whatsapp" | "native" | "email", email = "") {
    const origin = typeof window === "undefined" ? "https://chorepot.app" : window.location.origin;
    const link = `${origin}/auth?code=${code}`;
    const message = `Join our family on Chorepot! Tap this link to sign up: ${link} (or enter invite code: ${code})`;

    if (channel === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    if (channel === "email") {
      const subject = encodeURIComponent(`Join ${data.name} on Chorepot`);
      const body = encodeURIComponent(
        `Hi!\n\nYou've been invited to join ${data.name} on Chorepot.\n\nClick this link to create your account:\n${link}\n\nOr enter the 6-character invite code: ${code}`,
      );
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
      return;
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator
        .share({
          title: `Join ${data.name} on Chorepot`,
          text: `Use invite code ${code} to join our family on Chorepot:`,
          url: link,
        })
        .catch(() => undefined);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard
        .writeText(message)
        .then(() => toast.success("Invite message copied to share!"));
    }
  }

  function choreRow(c: Chore) {
    const m = member(c.childId);
    return (
      <div className="chore-row" key={c.id}>
        <div className="chore-emoji">{c.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{c.title}</div>
          {c.description && (
            <div className="mt-0.5 text-xs text-muted-foreground">{c.description}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {!isChild && (
              <span>
                {m?.avatar} {m?.name}
              </span>
            )}
            <span>{formatChoreSchedule(c)}</span>
            {c.requirePhoto && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Camera size={11} /> Photo required
              </span>
            )}
            {c.note && <span className="text-destructive">Note: {c.note}</span>}
          </div>
        </div>
        <span className="money-tag">{money(c.value)}</span>
        <div className="chore-row-actions">
          {c.status === "approved" ? (
            <>
              <span className="status approved">
                <Check size={13} /> Approved
              </span>
              {!isChild && c.frequency !== "once" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  title="Reset chore to To do"
                  onClick={() => act("reset_chore", { id: c.id })}
                >
                  <RotateCcw size={13} /> Reset
                </Button>
              )}
            </>
          ) : c.status === "pending" ? (
            isChild ? (
              <span className="status pending">
                <Clock size={13} /> Pending
              </span>
            ) : (
              <div className="inline-review-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => open("review", c)}
                  title="Review chore"
                >
                  <Camera size={13} /> Review
                </Button>
                <Button size="sm" disabled={busy} onClick={() => act("approve", { id: c.id })}>
                  <Check size={13} /> Approve
                </Button>
              </div>
            )
          ) : isChild ? (
            <Button variant="outline" size="sm" onClick={() => open("complete", c)}>
              <Check />
              {c.status === "rejected" ? "Try again" : "Done"}
            </Button>
          ) : (
            <span className="status todo">{c.status === "rejected" ? "Sent back" : "To do"}</span>
          )}
          {!isChild && (
            <div className="chore-manage-icons">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${c.title}`}
                onClick={() => open("edit_chore", c)}
              >
                <Pencil size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${c.title}`}
                disabled={busy}
                onClick={() => act("delete_chore", { id: c.id })}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const familyInviteOrigin =
    typeof window === "undefined" ? "https://chorepot.app" : window.location.origin;

  return (
    <div className="app-shell">
      {celebrate && (
        <div className="celebration" aria-hidden="true">
          {["⭐", "🎉", "✨", "🌟", "💚", "🎊"].map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
      )}

      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Sprout />
          </span>
          chorepot<span className="brand-dot">.</span>
        </Link>
        <div className="household">
          <span className="family-icon">🏡</span>
          <div>
            <strong>{data.name.replace("The ", "").replace(" family", "")}</strong>
            <small>Our happy little team</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">FAMILY SPACE</div>
        <nav>
          {navigation.map((n) => (
            <Button
              key={n.name}
              variant="ghost"
              className={`nav-button ${view === n.name ? "active" : ""}`}
              onClick={() => {
                setView(n.name);
                setMobile(false);
              }}
            >
              <n.icon size={18} />
              {n.name}
              {n.name === "Chores" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </Button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="together">
            <span>🌱</span>
            <strong>
              Little chores.
              <br />
              Big life lessons.
            </strong>
            <p>Growing good habits, together.</p>
          </div>
          {!inKidMode && (
            <Button variant="ghost" className="nav-button" onClick={() => open("settings")}>
              <Settings />
              Settings
            </Button>
          )}
          <div className="sidebar-profile">
            <span className="avatar">{profile?.avatar}</span>
            <div>
              <strong>{profile?.name}</strong>
              <small>
                {inKidMode ? "Kid Mode active" : isChild ? "Super helper" : "Parent account"}
              </small>
            </div>
            {!inKidMode && (
              <Button variant="ghost" size="icon" aria-label="Sign out" onClick={logout}>
                <LogOut />
              </Button>
            )}
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              className="mobile-menu"
              variant="ghost"
              size="icon"
              aria-label="Menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </Button>
            <span className="breadcrumb">
              Family space <ChevronRight size={13} /> <strong>{view}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {data.role !== "child" ? (
              <select
                className="mode-select"
                aria-label="Switch view"
                value={kidModeChildId}
                onChange={(e) => handleModeChange(e.target.value)}
              >
                <option value="">Parent view</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}’s view (Kid Mode)
                  </option>
                ))}
              </select>
            ) : (
              <span className="parent-chip">Child view</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="bell-button"
              aria-label="Notifications"
              onClick={() => open("notifications")}
            >
              <Bell />
              {(visibleNotifications.length > 0 || (!isChild && pending.length > 0)) && <span />}
            </Button>
            <span className="top-avatar">{profile?.avatar}</span>
          </div>
        </header>

        <main className="dashboard">
          {inKidMode && (
            <div className="demo-banner">
              <span>
                <Tablet size={14} /> Kid Mode: Viewing as <strong>{profile?.name}</strong>
              </span>
              <button
                type="button"
                className="font-bold underline"
                onClick={() => handleModeChange("")}
              >
                {data.config?.parentPin ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock size={12} /> Exit Kid Mode
                  </span>
                ) : (
                  "Return to Parent view"
                )}
              </button>
            </div>
          )}

          <div className="page-heading">
            <div>
              <div className="eyebrow">A LITTLE TEAMWORK GOES A LONG WAY</div>
              <h1>
                {view === "Overview"
                  ? `Hey ${profile?.name ?? "there"}! ${isChild ? "🌟" : "👋"}`
                  : view}
              </h1>
              <p>
                {view === "Overview"
                  ? isChild
                    ? "Little steps today. Big dreams tomorrow."
                    : "Here’s how your family is getting on today."
                  : "Your family’s little wins, all in one place."}
              </p>
            </div>
            {!isChild && (
              <Button onClick={() => open("chore")} className="add-chore">
                <Plus /> Add a chore
              </Button>
            )}
            {isChild && view === "Pocket money" && (
              <Button onClick={() => open("goal")}>
                <Plus />
                New savings goal
              </Button>
            )}
          </div>

          {view === "Overview" && (
            <>
              <section className="stats-grid">
                <div className="stat">
                  <span className="stat-icon mint">
                    <CheckCheck />
                  </span>
                  <span className="stat-label">Chores completed</span>
                  <div className="stat-number">
                    {completed}
                    <small>/ {totalChoresCount}</small>
                  </div>
                  <span className="stat-foot">
                    <span className="text-primary">Lovely progress</span> this week
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-icon amber">
                    <Clock />
                  </span>
                  <span className="stat-label">Waiting for approval</span>
                  <div className="stat-number">
                    {isChild
                      ? filtered.filter((c) => c.status === "pending").length
                      : pending.length}
                    <small>chores</small>
                  </div>
                  <span className="stat-foot">
                    {pending.length ? "A little check goes a long way" : "All caught up!"}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-icon lavender">
                    <Wallet />
                  </span>
                  <span className="stat-label">
                    {isChild ? "My pocket money" : "Family pocket money"}
                  </span>
                  <div className="stat-number">
                    {money(isChild ? balance(data.state, activeChild) : total)}
                  </div>
                  <span className="stat-foot">Earned with a little elbow grease</span>
                </div>
                <div className="stat">
                  <span className="stat-icon peach">
                    <CalendarDays />
                  </span>
                  <span className="stat-label">Next payday</span>
                  <div className="stat-number">
                    {paydayInfo.isToday ? "Today!" : paydayInfo.label}
                    <small>💸</small>
                  </div>
                  <span className="stat-foot">{paydayInfo.scheduleText}</span>
                </div>
              </section>

              <div className="overview-grid">
                <div className="left-column">
                  {!isChild && (
                    <section className="approval-section">
                      <div className="section-heading">
                        <h2>
                          <span className="heading-icon amber">
                            <Clock size={17} />
                          </span>
                          Ready for your thumbs up{" "}
                          <span className="count-badge">{pending.length}</span>
                        </h2>
                        <span className="tiny-label">A little encouragement matters</span>
                      </div>
                      {pending.length === 0 ? (
                        <div className="empty-state">
                          <CheckCheck /> All caught up. Great teamwork!
                        </div>
                      ) : (
                        pending.map((c) => (
                          <div className="approval-card" key={c.id}>
                            <div className="approval-main">
                              <div className="chore-emoji">{c.emoji}</div>
                              <div className="flex-1">
                                <strong>{c.title}</strong>
                                <div className="approval-detail">
                                  {member(c.childId)?.avatar} {member(c.childId)?.name}
                                  <span>·</span> Ready for review {c.proof && <Camera size={13} />}
                                </div>
                              </div>
                              <span className="money-tag">{money(c.value)}</span>
                            </div>
                            <div className="approval-actions">
                              <Button variant="ghost" size="sm" onClick={() => open("review", c)}>
                                <Camera /> {c.proof ? "View photo proof" : "Review chore"}
                              </Button>
                              <div>
                                <Button variant="ghost" size="sm" onClick={() => open("reject", c)}>
                                  <X />
                                  Not quite
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => act("approve", { id: c.id })}
                                >
                                  <Check />
                                  Approve
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </section>
                  )}

                  <section className="today-section">
                    <div className="section-heading">
                      <h2>
                        {isChild ? "Your missions today" : "Today’s chores"}{" "}
                        <span className="sun">☀️</span>
                      </h2>
                      <span className="tiny-label">
                        {new Date().toLocaleDateString("en-GB", {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    {!isChild && (
                      <div className="filter-tabs">
                        <Button
                          variant="ghost"
                          className={child === "all" ? "selected" : ""}
                          onClick={() => setChild("all")}
                        >
                          Everyone
                        </Button>
                        {children.map((m) => (
                          <Button
                            variant="ghost"
                            key={m.id}
                            className={child === m.id ? "selected" : ""}
                            onClick={() => setChild(m.id)}
                          >
                            {m.avatar} {m.name}
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="chore-list">
                      {todays.length ? (
                        todays.map(choreRow)
                      ) : (
                        <div className="empty-state">
                          No chores scheduled today. Enjoy a little family time!
                        </div>
                      )}
                    </div>
                    <Button variant="link" className="all-chores" onClick={() => setView("Chores")}>
                      See all chores <ChevronRight />
                    </Button>
                  </section>
                </div>

                <div className="right-column">
                  <section className="children-section">
                    <div className="section-heading">
                      <h2>{isChild ? "Your pocket money" : "Little helpers, big wins"}</h2>
                      <Heart size={17} className="text-primary" />
                    </div>
                    {children
                      .filter((c) => !isChild || c.id === activeChild)
                      .map((m, i) => (
                        <div className={`child-card ${i % 2 ? "pink" : "mint"}`} key={m.id}>
                          <div className="child-top">
                            <span className="child-avatar">{m.avatar}</span>
                            <div className="flex-1">
                              <strong>{m.name}</strong>
                              <p>
                                {
                                  data.state.chores.filter(
                                    (c) => c.childId === m.id && c.status === "approved",
                                  ).length
                                }{" "}
                                chores completed this week
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`View ${m.name}'s pocket money`}
                              onClick={() => {
                                setChild(m.id);
                                setView("Pocket money");
                              }}
                            >
                              <ArrowUpRight />
                            </Button>
                          </div>
                          <div className="child-balance">
                            <span>Pocket money balance</span>
                            <strong>{money(balance(data.state, m.id))}</strong>
                          </div>
                          <div className="child-goal">
                            {data.state.goals
                              .filter((g) => g.childId === m.id)
                              .slice(0, 1)
                              .map((g) => (
                                <div key={g.id}>
                                  <div className="goal-caption">
                                    <span>
                                      {g.emoji} Saving for {g.title}
                                    </span>
                                    <span>{Math.round((g.saved / g.target) * 100)}%</span>
                                  </div>
                                  <progress max={g.target} value={g.saved} />
                                  <div className="goal-amount">
                                    {money(g.saved)} of {money(g.target)}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    {children.length === 0 && !isChild && (
                      <div className="empty-state">
                        Add your first child in Our family to start tracking pocket money.
                      </div>
                    )}
                  </section>

                  <section className="piggy-banner">
                    <img
                      src="/piggy-bank.png"
                      alt="Pink piggy bank with gold coins and a growing sprout"
                    />
                    <div>
                      <span className="piggy-eyebrow">SMALL SAVINGS, BIG DREAMS</span>
                      <h3>
                        A little today.
                        <br />A lot tomorrow.
                      </h3>
                      <p>Watch their good habits grow.</p>
                      <Button variant="link" onClick={() => setView("Pocket money")}>
                        Explore savings goals <ArrowUpRight />
                      </Button>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}

          {(view === "Chores" || view === "Weekly schedule") && (
            <section className="full-section">
              <div className="section-heading">
                <h2>{view === "Chores" ? "The family chore board" : "A week of little wins"}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {!isChild && hasApprovedRecurring && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => act("reset_chore", { all: true })}
                    >
                      <RotateCcw size={14} /> Reset completed weekly chores
                    </Button>
                  )}
                  {!isChild && (
                    <select
                      aria-label="Filter child"
                      value={child}
                      onChange={(e) => setChild(e.target.value)}
                    >
                      <option value="all">Everyone</option>
                      {children.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {view === "Weekly schedule" && (
                <div className="week-tabs">
                  {days.map((d, i) => (
                    <Button
                      variant={day === i ? "default" : "ghost"}
                      key={d}
                      onClick={() => setDay(i)}
                    >
                      {d}
                      <small>{filtered.filter((c) => isChoreScheduledOnDay(c, i)).length}</small>
                    </Button>
                  ))}
                </div>
              )}
              {(view === "Chores" ? filtered : todays).map(choreRow)}
              {(view === "Chores" ? filtered : todays).length === 0 && (
                <div className="empty-state">
                  Your chore board is ready for its first little mission.
                </div>
              )}
            </section>
          )}

          {view === "Pocket money" && (
            <>
              <div className="payday-bar">
                <div>
                  <strong>{paydayInfo.scheduleText}</strong>
                  <span>
                    Savings goals track what’s set aside independently and stay safe after payday.
                  </span>
                </div>
                {!isChild && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Filter child pocket money"
                      className="inline-select"
                      value={child}
                      onChange={(e) => setChild(e.target.value)}
                    >
                      <option value="all">Everyone</option>
                      {children.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="outline" size="sm" onClick={() => open("payday")}>
                      <CalendarDays size={14} /> Change payday
                    </Button>
                  </div>
                )}
              </div>

              <section className="money-grid">
                {children
                  .filter((m) =>
                    isChild ? m.id === activeChild : child === "all" || child === m.id,
                  )
                  .map((m) => {
                    const summary = childWeeklySummary(data.state, m.id);
                    return (
                      <div className="pay-card" key={m.id}>
                        <div className="flex items-center gap-3">
                          <span className="child-avatar">{m.avatar}</span>
                          <div>
                            <h2>{m.name}’s payday summary</h2>
                            <p className="m-0 text-xs text-muted-foreground">
                              {paydayInfo.scheduleText}
                            </p>
                          </div>
                        </div>

                        <div className="summary-breakdown">
                          <div className="summary-cell">
                            <span>Earned this week</span>
                            <strong>{money(summary.earnedThisWeek)}</strong>
                          </div>
                          <div className="summary-cell">
                            <span>Awaiting approval</span>
                            <strong>
                              {money(summary.pendingAmount)} ({summary.pendingCount})
                            </strong>
                          </div>
                          <div className="summary-cell">
                            <span>Paid out this week</span>
                            <strong>{money(summary.paidThisWeek)}</strong>
                          </div>
                          <div className="summary-cell highlight">
                            <span>Unpaid balance due</span>
                            <strong>{money(summary.unpaidBalance)}</strong>
                          </div>
                        </div>

                        {!isChild && (
                          <Button
                            disabled={busy || summary.unpaidBalance <= 0}
                            onClick={() => {
                              setChild(m.id);
                              open("pay");
                            }}
                          >
                            <Check />
                            Mark as paid ({money(summary.unpaidBalance)})
                          </Button>
                        )}
                      </div>
                    );
                  })}
              </section>

              <section className="full-section">
                <div className="section-heading">
                  <h2>
                    <Target /> Savings goals
                  </h2>
                  {(isChild || children.length > 0) && (
                    <Button variant="outline" onClick={() => open("goal")}>
                      <Plus />
                      New goal
                    </Button>
                  )}
                </div>
                <div className="goals-grid">
                  {data.state.goals
                    .filter((g) =>
                      isChild ? g.childId === activeChild : child === "all" || g.childId === child,
                    )
                    .map((g) => {
                      const pct = Math.min(
                        100,
                        Math.round((g.saved / Math.max(1, g.target)) * 100),
                      );
                      const reached = g.achieved || g.saved >= g.target;
                      return (
                        <div className={`goal-card ${reached ? "goal-reached" : ""}`} key={g.id}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="goal-emoji">{g.emoji}</span>
                            <div className="flex items-center gap-1">
                              {reached && (
                                <span className="goal-badge">
                                  <Trophy size={12} /> Goal Reached!
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${g.title}`}
                                onClick={() => open("edit_goal", g)}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${g.title}`}
                                disabled={busy}
                                onClick={() => act("delete_goal", { id: g.id })}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                          <h3>{g.title}</h3>
                          <p>
                            {member(g.childId)?.name}’s savings tracker · {pct}%
                          </p>
                          <progress max={g.target} value={g.saved} />
                          <div className="goal-caption">
                            <strong>{money(g.saved)}</strong>
                            <span>of {money(g.target)}</span>
                          </div>
                          <div className="goal-actions">
                            {!reached && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => open("allocate", g)}
                              >
                                <Plus size={13} /> Add savings
                              </Button>
                            )}
                            {g.saved > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => open("withdraw_goal", g)}
                              >
                                <Minus size={13} /> Take out
                              </Button>
                            )}
                            {!reached && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => act("achieve_goal", { id: g.id })}
                              >
                                <Trophy size={13} /> Mark achieved
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                {!data.state.goals.length && (
                  <div className="empty-state">Every big dream starts with a little goal.</div>
                )}
              </section>

              <section className="full-section">
                <h2>Activity & earnings</h2>
                <div className="ledger">
                  {[...data.state.ledger]
                    .reverse()
                    .filter((e) =>
                      isChild ? e.childId === activeChild : child === "all" || e.childId === child,
                    )
                    .map((e) => (
                      <div key={e.id}>
                        <span className="heading-icon mint">
                          {e.type === "payment" ? <Wallet size={16} /> : <Check size={16} />}
                        </span>
                        <div className="flex-1">
                          <strong>{e.title}</strong>
                          <small>
                            {member(e.childId)?.name} ·{" "}
                            {new Date(e.date).toLocaleDateString("en-GB")}
                          </small>
                        </div>
                        <strong className={e.amount > 0 ? "text-primary" : ""}>
                          {e.amount > 0 ? "+" : ""}
                          {money(e.amount)}
                        </strong>
                      </div>
                    ))}
                </div>
              </section>
            </>
          )}

          {view === "Our family" && (
            <section className="full-section">
              <div className="section-heading">
                <h2>{data.name}</h2>
                {!isChild && (
                  <Button onClick={() => open("invite")}>
                    <Plus />
                    Add or invite member
                  </Button>
                )}
              </div>
              <div className="family-grid">
                {data.members.map((m) => (
                  <div className="member-card" key={m.id}>
                    <div className="flex items-start justify-between">
                      <span className="child-avatar">{m.avatar}</span>
                      {!isChild && m.isManaged && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${m.name}`}
                          disabled={busy}
                          onClick={() => act("remove_managed_child", { id: m.id })}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                    <h3>{m.name}</h3>
                    <p>
                      {m.role === "child"
                        ? m.isManaged
                          ? "Little helper · Kid Mode"
                          : "Little helper · Own device"
                        : m.role === "co_parent"
                          ? "Co-parent"
                          : "Primary parent"}
                    </p>
                    {!isChild && m.isManaged && m.inviteCode && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="code-pill">{m.inviteCode}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => shareInvite(m.inviteCode!, "whatsapp", m.email ?? "")}
                        >
                          <MessageCircle size={13} /> Share
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!isChild && (data.config?.pendingInvites?.length ?? 0) > 0 && (
                <div className="mt-6">
                  <h3 className="mb-3">Pending invites</h3>
                  <div className="added-list">
                    {(data.config?.pendingInvites ?? []).map((inv) => (
                      <div className="added-chip" key={inv.id}>
                        <div className="min-w-0 flex-1">
                          <strong>
                            {inv.name} ({inv.role === "co_parent" ? "Co-parent" : "Child"})
                          </strong>
                          <small>
                            {inv.email || "Share link or code"} · Code: <strong>{inv.code}</strong>
                          </small>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shareInvite(inv.code, "whatsapp", inv.email ?? "")}
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shareInvite(inv.code, "email", inv.email ?? "")}
                        >
                          <Mail size={13} /> Email
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isChild && (
                <div className="family-code">
                  <QRCodeSVG value={`${familyInviteOrigin}/auth?code=${data.code}`} size={100} />
                  <div className="flex-1">
                    <h3>Everyone belongs here</h3>
                    <p>Your family’s quick child invite code</p>
                    <div className="flex items-center gap-2">
                      <strong>{data.code}</strong>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Copy family code"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(data.code)
                            .then(() => toast.success("Family code copied"))
                        }
                      >
                        <Copy />
                      </Button>
                    </div>
                    <div className="share-buttons mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => shareInvite(data.code, "whatsapp")}
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => shareInvite(data.code, "native")}
                      >
                        <Share2 size={14} /> Share
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => shareInvite(data.code, "email")}
                      >
                        <Mail size={14} /> Email
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          <footer className="dashboard-footer">
            <span>
              <Sprout size={14} /> Made for little wins and happy families.
            </span>
            <span>
              All amounts in GBP (£) <span className="footer-dot">·</span> A little better,
              together.
            </span>
          </footer>
        </main>
      </div>

      <Dialog
        open={modal !== null}
        onOpenChange={(v) => {
          if (!v) setModal(null);
        }}
      >
        <DialogContent className="family-dialog">
          <DialogHeader>
            <DialogTitle>{modalTitles[modal ?? ""] ?? ""}</DialogTitle>
            <DialogDescription>
              {modal === "invite"
                ? "Add a child directly for Kid Mode, or create an invite link for their own device."
                : modal === "complete"
                  ? "Your parent will give it a thumbs up before you earn your pocket money."
                  : modal === "unlock_pin"
                    ? "Enter your 4-digit Parent PIN to return to Parent view."
                    : "Little steps, happy families."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="dialog-form">
            {modal === "unlock_pin" && (
              <>
                <label>
                  4-digit Parent PIN
                  <Input
                    inputMode="numeric"
                    type="password"
                    maxLength={4}
                    required
                    autoFocus
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </label>
                <Button>
                  <Lock size={14} /> Unlock Parent view
                </Button>
              </>
            )}

            {(modal === "chore" || modal === "edit_chore") && (
              <>
                {modal === "edit_chore" &&
                  selected &&
                  "status" in selected &&
                  selected.status === "pending" && (
                    <p className="text-xs text-muted-foreground">
                      Title, assignee, and reward can’t be changed while waiting for approval.
                    </p>
                  )}
                <label>
                  Chore name
                  <Input
                    name="title"
                    defaultValue={
                      modal === "edit_chore" && selected && "title" in selected
                        ? selected.title
                        : ""
                    }
                    disabled={
                      modal === "edit_chore" &&
                      selected !== null &&
                      "status" in selected &&
                      selected.status === "pending"
                    }
                    placeholder="e.g. Tidy your bedroom"
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Notes / instructions (optional)
                  <Input
                    name="description"
                    defaultValue={
                      modal === "edit_chore" && selected && "description" in selected
                        ? (selected.description ?? "")
                        : ""
                    }
                    placeholder="e.g. Put books back on the shelf"
                    maxLength={200}
                  />
                </label>
                <div className="form-pair">
                  <label>
                    Little helper
                    <select
                      name="childId"
                      defaultValue={
                        modal === "edit_chore" && selected && "childId" in selected
                          ? selected.childId
                          : children[0]?.id
                      }
                      disabled={
                        modal === "edit_chore" &&
                        selected !== null &&
                        "status" in selected &&
                        selected.status === "pending"
                      }
                      required
                    >
                      {children.map((m) => (
                        <option value={m.id} key={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Chore icon
                    <select
                      name="emoji"
                      defaultValue={
                        modal === "edit_chore" && selected && "emoji" in selected
                          ? selected.emoji
                          : "🧹"
                      }
                    >
                      {choreEmojis.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  Schedule frequency
                  <select
                    value={choreFrequency}
                    onChange={(e) => setChoreFrequency(e.target.value as ChoreFrequency)}
                  >
                    <option value="weekly">Weekly on selected day(s)</option>
                    <option value="daily">Every day (Mon–Sun)</option>
                    <option value="once">One-off / Bonus chore</option>
                  </select>
                </label>

                {choreFrequency === "weekly" && (
                  <div>
                    <span className="field-label">Days of the week</span>
                    <div className="day-picker">
                      {days.map((d, idx) => (
                        <button
                          key={d}
                          type="button"
                          className={`day-chip ${choreDays.includes(idx) ? "active" : ""}`}
                          onClick={() => toggleChoreDay(idx)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {choreFrequency === "once" && (
                  <label>
                    Day for this bonus chore
                    <select name="singleDay" defaultValue={choreDays[0] ?? today()}>
                      {fullDays.map((d, idx) => (
                        <option key={d} value={idx}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div>
                  <label>
                    Reward (£)
                    <Input
                      name="value"
                      type="number"
                      min="0"
                      max="1000"
                      step="0.01"
                      value={choreValueStr}
                      disabled={
                        modal === "edit_chore" &&
                        selected !== null &&
                        "status" in selected &&
                        selected.status === "pending"
                      }
                      onChange={(e) => setChoreValueStr(e.target.value)}
                      required
                    />
                  </label>
                  <div className="preset-row mt-2">
                    {rewardPresets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="preset-chip"
                        disabled={
                          modal === "edit_chore" &&
                          selected !== null &&
                          "status" in selected &&
                          selected.status === "pending"
                        }
                        onClick={() => setChoreValueStr((p / 100).toFixed(2))}
                      >
                        {money(p)}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={choreRequirePhoto}
                    onChange={(e) => setChoreRequirePhoto(e.target.checked)}
                  />
                  Require photo proof when marking done
                </label>

                {!children.length && (
                  <p className="text-destructive text-sm">
                    Add a child in Our family before creating chores.
                  </p>
                )}
                <Button disabled={busy || !children.length}>
                  {modal === "edit_chore" ? (
                    <>
                      <Check /> Save changes
                    </>
                  ) : (
                    <>
                      <Plus /> Create chore
                    </>
                  )}
                </Button>
              </>
            )}

            {modal === "review" && selected && "value" in selected && (
              <>
                <div className="review-title">
                  {selected.emoji} {selected.title}
                  <strong>{money(selected.value)}</strong>
                </div>
                {proofUrl ? (
                  <img className="proof-photo" src={proofUrl} alt="Chore completion proof" />
                ) : (
                  <p className="empty-state">
                    No photo attached. Check in with {member(selected.childId)?.name}.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setModal("reject")}>
                    Not quite
                  </Button>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => act("approve", { id: selected.id })}
                  >
                    <Check />
                    Approve chore
                  </Button>
                </div>
              </>
            )}

            {modal === "reject" && (
              <>
                <label>
                  A helpful note
                  <textarea
                    name="note"
                    placeholder="What needs a little more work?"
                    required
                    maxLength={300}
                  />
                </label>
                <Button disabled={busy}>Send back with note</Button>
              </>
            )}

            {modal === "complete" && selected && "value" in selected && (
              <>
                <p className="font-semibold">{selected.title}</p>
                {selected.description && (
                  <p className="text-xs text-muted-foreground">{selected.description}</p>
                )}
                {selected.note && (
                  <p className="text-xs text-destructive">Parent note: {selected.note}</p>
                )}
                {selected.requirePhoto && (
                  <p className="text-xs font-semibold text-primary">
                    📸 Photo proof is required for this chore.
                  </p>
                )}
                <label className="photo-upload">
                  <Camera />
                  <span>
                    {proof
                      ? proof.name
                      : selected.requirePhoto
                        ? "Take or choose a photo (required)"
                        : "Add a photo (optional)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.size > 15 * 1024 * 1024) {
                        toast.error("Please choose a photo smaller than 15 MB");
                      } else {
                        setProof(f ?? null);
                      }
                    }}
                  />
                </label>
                <Button disabled={busy}>
                  <Check />
                  Send for approval
                </Button>
              </>
            )}

            {modal === "goal" && (
              <>
                {!isChild && children.length > 0 && (
                  <label>
                    For child
                    <select name="childId" defaultValue={children[0]?.id}>
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  My dream
                  <Input name="title" required placeholder="e.g. New LEGO set" />
                </label>
                <div className="form-pair">
                  <label>
                    Target (£)
                    <Input name="target" type="number" min="0.01" step="0.01" required />
                  </label>
                  <label>
                    Goal icon
                    <select name="emoji">
                      {goalEmojis.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <Button disabled={busy}>
                  <Target />
                  Create my goal
                </Button>
              </>
            )}

            {modal === "edit_goal" && selected && "target" in selected && (
              <>
                <label>
                  Goal name
                  <Input name="title" defaultValue={selected.title} required />
                </label>
                <div className="form-pair">
                  <label>
                    Target (£)
                    <Input
                      name="target"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={(selected.target / 100).toFixed(2)}
                      required
                    />
                  </label>
                  <label>
                    Saved so far (£)
                    <Input
                      name="saved"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={(selected.saved / 100).toFixed(2)}
                      required
                    />
                  </label>
                </div>
                <label>
                  Goal icon
                  <select name="emoji" defaultValue={selected.emoji}>
                    {goalEmojis.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <Button disabled={busy}>
                  <Check /> Save goal
                </Button>
              </>
            )}

            {modal === "allocate" && selected && "target" in selected && (
              <>
                <p className="text-xs text-muted-foreground">
                  {money(Math.max(0, selected.target - selected.saved))} left to reach{" "}
                  <strong>{selected.title}</strong>.
                </p>
                <label>
                  Amount to set aside (£)
                  <Input
                    name="amount"
                    type="number"
                    min="0.01"
                    max={((selected.target - selected.saved) / 100).toFixed(2)}
                    step="0.01"
                    required
                  />
                </label>
                <Button disabled={busy}>Add to my savings</Button>
              </>
            )}

            {modal === "withdraw_goal" && selected && "saved" in selected && (
              <>
                <p className="text-xs text-muted-foreground">
                  Currently saved: <strong>{money(selected.saved)}</strong>
                </p>
                <label>
                  Amount to take out (£)
                  <Input
                    name="amount"
                    type="number"
                    min="0.01"
                    max={(selected.saved / 100).toFixed(2)}
                    step="0.01"
                    required
                  />
                </label>
                <Button disabled={busy}>Update savings</Button>
              </>
            )}

            {modal === "pay" && (
              <>
                <p>
                  Confirm you’ve handed over or transferred{" "}
                  <strong>{money(balance(data.state, child))}</strong> to {member(child)?.name}.
                </p>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => act("pay", { childId: child })}
                >
                  <Check />
                  Yes, mark as paid
                </Button>
              </>
            )}

            {modal === "payday" && (
              <>
                <label>
                  Payday frequency
                  <select
                    value={paydayFreq}
                    onChange={(e) => {
                      const next = e.target.value === "monthly" ? "monthly" : "weekly";
                      setPaydayFreq(next);
                      setPaydayDay(next === "monthly" ? 1 : 4);
                    }}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                {paydayFreq === "weekly" ? (
                  <label>
                    Payday day of week
                    <select
                      value={paydayDay}
                      onChange={(e) => setPaydayDay(Number(e.target.value))}
                    >
                      {fullDays.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Day of month (1–28)
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={paydayDay}
                      onChange={(e) =>
                        setPaydayDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))
                      }
                    />
                  </label>
                )}
                <Button disabled={busy}>
                  <Check /> Save payday schedule
                </Button>
              </>
            )}

            {modal === "invite" && (
              <>
                <div className="mode-toggle-grid">
                  <button
                    type="button"
                    className={`mode-card ${inviteTab === "direct_child" ? "active" : ""}`}
                    onClick={() => {
                      setInviteTab("direct_child");
                      setInvite("");
                    }}
                  >
                    <Tablet size={16} />
                    <div>
                      <strong>Add child (no email)</strong>
                      <span>Ready for chores & Kid Mode right away</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`mode-card ${inviteTab === "link" ? "active" : ""}`}
                    onClick={() => {
                      setInviteTab("link");
                      setInvite("");
                    }}
                  >
                    <Smartphone size={16} />
                    <div>
                      <strong>Invite link / code</strong>
                      <span>For co-parent or child’s own device</span>
                    </div>
                  </button>
                </div>

                {inviteTab === "direct_child" ? (
                  <>
                    <label>
                      Child’s name
                      <Input
                        required
                        placeholder="e.g. Lily"
                        value={newChildName}
                        onChange={(e) => setNewChildName(e.target.value)}
                      />
                    </label>
                    <div>
                      <span className="field-label">Choose avatar</span>
                      <div className="avatar-row">
                        {childAvatars.map((av) => (
                          <button
                            key={av}
                            type="button"
                            className={`avatar-pick ${newChildAvatar === av ? "active" : ""}`}
                            onClick={() => setNewChildAvatar(av)}
                          >
                            {av}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label>
                      Child’s email address (optional)
                      <Input
                        type="email"
                        placeholder="Leave blank if no email address"
                        value={newChildEmail}
                        onChange={(e) => setNewChildEmail(e.target.value)}
                      />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={newChildWithCode}
                        onChange={(e) => setNewChildWithCode(e.target.checked)}
                      />
                      Also create a 6-character invite code for later
                    </label>
                    <Button type="submit" disabled={busy}>
                      <Plus /> Add child
                    </Button>
                  </>
                ) : (
                  <>
                    <label>
                      Invite as
                      <select name="role">
                        <option value="child">Child</option>
                        <option value="co_parent">Co-parent</option>
                      </select>
                    </label>
                    <label>
                      Their name (optional)
                      <Input name="inviteName" placeholder="e.g. James" />
                    </label>
                    <label>
                      Email address (optional)
                      <Input name="email" type="email" placeholder="family@example.com" />
                    </label>
                    <Button type="submit" disabled={busy}>
                      Create invite link
                    </Button>
                  </>
                )}

                {invite && (
                  <div className="invite-result">
                    <QRCodeSVG size={130} value={`${familyInviteOrigin}/auth?code=${invite}`} />
                    <strong>{invite}</strong>
                    <div className="share-buttons">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => shareInvite(invite, "whatsapp", inviteEmail)}
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => shareInvite(invite, "native", inviteEmail)}
                      >
                        <Share2 size={14} /> Share
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => shareInvite(invite, "email", inviteEmail)}
                      >
                        <Mail size={14} /> Email
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(`${familyInviteOrigin}/auth?code=${invite}`)
                            .then(() => toast.success("Invite link copied"))
                        }
                      >
                        <Copy size={14} /> Copy link
                      </Button>
                    </div>
                    <small>Send this link to your family member. Valid for 7 days.</small>
                  </div>
                )}
              </>
            )}

            {modal === "notifications" && (
              <>
                {visibleNotifications.length ? (
                  [...visibleNotifications].reverse().map((n) => (
                    <div className="notification-row" key={n.id}>
                      <Bell size={16} />
                      <div>
                        <strong>{n.title}</strong>
                        <p>{n.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    {!isChild && pending.length
                      ? `${pending.length} chores are ready for your thumbs up.`
                      : "All quiet in your family space."}
                  </div>
                )}
                {visibleNotifications.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => act("clear_notifications", {})}
                  >
                    <CheckCheck size={15} /> Clear notifications
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const token = await enablePush();
                      const { error } = await supabase
                        .from("push_devices")
                        .upsert({ user_id: data.userId, token });
                      if (error) throw error;
                      toast.success("Lock-screen alerts enabled");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Alerts unavailable");
                    }
                  }}
                >
                  <Bell />
                  Enable lock-screen alerts
                </Button>
              </>
            )}

            {modal === "settings" && (
              <>
                <label>
                  Your name
                  <Input name="name" defaultValue={profile?.name} required />
                </label>
                <label>
                  Choose your avatar
                  <select name="avatar" defaultValue={profile?.avatar}>
                    {["👩🏻", "👨🏻", "🧑🏼‍🚀", "👩🏻‍🎨", "🦊", "🐼", "🌱", "🐸"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-label">
                  <input name="celebrations" type="checkbox" defaultChecked={celebrationsEnabled} />
                  Celebrate little wins
                </label>
                {!isChild && (
                  <>
                    <label>
                      Payday frequency
                      <select
                        value={paydayFreq}
                        onChange={(e) => {
                          const next = e.target.value === "monthly" ? "monthly" : "weekly";
                          setPaydayFreq(next);
                          setPaydayDay(next === "monthly" ? 1 : 4);
                        }}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </label>
                    {paydayFreq === "weekly" ? (
                      <label>
                        Payday day
                        <select
                          value={paydayDay}
                          onChange={(e) => setPaydayDay(Number(e.target.value))}
                        >
                          {fullDays.map((d, i) => (
                            <option key={d} value={i}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        Payday day of month (1–28)
                        <Input
                          type="number"
                          min={1}
                          max={28}
                          value={paydayDay}
                          onChange={(e) =>
                            setPaydayDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))
                          }
                        />
                      </label>
                    )}
                    <label>
                      <span className="flex items-center gap-1.5">
                        <Lock size={13} /> Optional 4-digit Parent PIN (for Kid Mode)
                      </span>
                      <Input
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="Leave blank for no PIN"
                        value={settingsPin}
                        onChange={(e) =>
                          setSettingsPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                      />
                    </label>
                  </>
                )}
                <Button disabled={busy}>Save profile</Button>
                <p className="text-sm text-muted-foreground">
                  On your phone, add Chorepot to your home screen from your browser’s menu.
                </p>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
