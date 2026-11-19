import { useState, useEffect, type FormEvent } from "react";
import {
  Sprout,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  Users,
  Sparkles,
  MessageCircle,
  Mail,
  Copy,
  Share2,
  Camera,
  Lock,
  Smartphone,
  Tablet,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { executeFamilyAction, fetchAuthenticatedFamily } from "./family-client";
import {
  CHILD_THEMES,
  CHORE_CATEGORIES,
  STARTER_CHORES,
  days,
  fullDays,
  money,
  tryNativeAndroidShare,
  type ChildThemeColor,
  type ChoreCategory,
  type Family,
  type ManagedChild,
  type PendingInvite,
} from "./model";

const parentAvatars = ["👩🏻", "👨🏻", "👩🏽", "👨🏽", "👩🏾", "👨🏾", "🌱", "🦊"];
const childAvatars = ["👧🏼", "🧑🏼‍🚀", "👩🏻‍🎨", "🦊", "🐼", "🦁", "🐸", "🦄"];

type StarterSelection = {
  selected: boolean;
  valueStr: string;
  assignee: string; // "all" or childId
};

export function OnboardingWizard({
  family,
  onComplete,
}: {
  family: Family | null;
  onComplete: () => void;
}) {
  const [activeFamily, setActiveFamily] = useState<Family | null>(family);
  const [entryMode, setEntryMode] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(family ? 2 : 1);
  const [busy, setBusy] = useState(false);

  // Step 1: Family & Payday
  const [familyName, setFamilyName] = useState(family?.name ?? "");
  const [parentName, setParentName] = useState(
    family?.members.find((m) => m.id === family.userId)?.name ?? "",
  );
  const [parentAvatar, setParentAvatar] = useState(
    family?.members.find((m) => m.id === family.userId)?.avatar ?? "👩🏻",
  );
  const [paydayFreq, setPaydayFreq] = useState<"weekly" | "monthly">(
    family?.config?.paydayFrequency ?? "weekly",
  );
  const [paydayDay, setPaydayDay] = useState<number>(family?.config?.paydayDay ?? 4);
  const [parentPin, setParentPin] = useState(family?.config?.parentPin ?? "");

  // Step 2: Children
  const [childrenList, setChildrenList] = useState<ManagedChild[]>(
    family?.config?.managedChildren ?? [],
  );
  const [childName, setChildName] = useState("");
  const [childAvatar, setChildAvatar] = useState("👧🏼");
  const [childTheme, setChildTheme] = useState<ChildThemeColor>("sunset");
  const [childMode, setChildMode] = useState<"no_email" | "invite">("no_email");
  const [childEmail, setChildEmail] = useState("");

  // Step 3: Co-parent
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(
    family?.config?.pendingInvites ?? [],
  );
  const [coParentName, setCoParentName] = useState("");
  const [coParentEmail, setCoParentEmail] = useState("");

  // Step 4: Starter Chores
  const [starterCategoryFilter, setStarterCategoryFilter] = useState<"all" | ChoreCategory>("all");
  const [starterMap, setStarterMap] = useState<Record<string, StarterSelection>>(() => {
    const init: Record<string, StarterSelection> = {};
    for (const item of STARTER_CHORES) {
      init[item.key] = {
        selected: Boolean(item.defaultSelected),
        valueStr: (item.value / 100).toFixed(2),
        assignee: "all",
      };
    }
    return init;
  });

  useEffect(() => {
    if (family) setActiveFamily(family);
  }, [family]);

  useEffect(() => {
    const storedInvite = sessionStorage.getItem("family-invite");
    if (storedInvite && !family) {
      setJoinCode(storedInvite);
      setEntryMode("join");
    }
    if (!parentName) {
      void supabase.auth.getUser().then(({ data }) => {
        const metaName = data.user?.user_metadata?.["name"];
        if (typeof metaName === "string" && metaName.trim()) {
          setParentName(metaName.trim());
        }
      });
    }
  }, [family, parentName]);

  async function handleJoinSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.rpc("family_setup", {
        join_code: joinCode.trim().toUpperCase(),
      });
      if (error) throw new Error(error.message);
      sessionStorage.removeItem("family-invite");
      toast.success("Welcome to your family space!");
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join family");
    } finally {
      setBusy(false);
    }
  }

  async function handleStep1Submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (parentPin && !/^\d{4}$/.test(parentPin)) {
      toast.error("Parent PIN must be 4 digits (or leave it blank)");
      return;
    }
    setBusy(true);
    try {
      let current = activeFamily;
      if (!current) {
        if (familyName.trim().length < 2) {
          throw new Error("Please enter a family name");
        }
        const { error } = await supabase.rpc("family_setup", {
          family_name: familyName.trim(),
        });
        if (error) throw new Error(error.message);
        sessionStorage.removeItem("family-invite");
        current = await fetchAuthenticatedFamily();
        if (!current) throw new Error("Could not load your new family");
        setActiveFamily(current);
      }

      const updated = await executeFamilyAction(current, "update_profile", {
        name: parentName.trim() || "Parent",
        avatar: parentAvatar,
        celebrations: true,
      });
      setActiveFamily(updated);
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save family details");
    } finally {
      setBusy(false);
    }
  }

  async function addChild(): Promise<boolean> {
    const trimmed = childName.trim();
    if (!trimmed) {
      toast.error("Enter your child’s name first");
      return false;
    }
    setBusy(true);
    try {
      let inviteCode = "";
      if (activeFamily) {
        const { data: code, error } = await supabase.rpc("family_invite", {
          invite_role: "child",
          invite_email: childMode === "invite" ? childEmail.trim() : "",
        });
        if (!error && code) inviteCode = code;
      }

      const newChild: ManagedChild = {
        id: `child-${crypto.randomUUID()}`,
        name: trimmed,
        avatar: childAvatar,
        role: "child",
        themeColor: childTheme,
        isManaged: true,
        ...(childMode === "invite" && childEmail.trim() ? { email: childEmail.trim() } : {}),
        ...(inviteCode ? { inviteCode } : {}),
      };

      setChildrenList((prev) => [...prev, newChild]);

      if (childMode === "invite" && inviteCode) {
        setPendingInvites((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: trimmed,
            ...(childEmail.trim() ? { email: childEmail.trim() } : {}),
            role: "child",
            code: inviteCode,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      setChildName("");
      setChildEmail("");
      toast.success(`${trimmed} added to your family!`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add child");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addCoParent() {
    const trimmed = coParentName.trim();
    const email = coParentEmail.trim();
    if (!trimmed && !email) {
      toast.error("Enter the other parent’s name or email");
      return;
    }
    setBusy(true);
    try {
      const { data: code, error } = await supabase.rpc("family_invite", {
        invite_role: "co_parent",
        invite_email: email,
      });
      if (error) throw new Error(error.message);
      if (code) {
        setPendingInvites((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: trimmed || "Co-parent",
            ...(email ? { email } : {}),
            role: "co_parent",
            code,
            createdAt: new Date().toISOString(),
          },
        ]);
        setCoParentName("");
        setCoParentEmail("");
        toast.success("Co-parent invite created!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create co-parent invite");
    } finally {
      setBusy(false);
    }
  }

  function shareInvite(inv: PendingInvite, channel: "whatsapp" | "native" | "email") {
    const origin = typeof window === "undefined" ? "https://chorepot.app" : window.location.origin;
    const link = `${origin}/auth?code=${inv.code}`;
    const roleLabel = inv.role === "co_parent" ? "as a Co-parent" : "";
    const msg = `Hi ${inv.name}! Join ${familyName || "our family"} on Chorepot ${roleLabel}: ${link} (or use code: ${inv.code})`;

    if (channel === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(msg)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    if (channel === "email") {
      const subject = encodeURIComponent(`Join ${familyName || "our family"} on Chorepot`);
      const body = encodeURIComponent(
        `Hi ${inv.name},\n\nYou've been invited to join ${familyName || "our family"} on Chorepot!\n\nTap this link to sign up:\n${link}\n\nOr enter code: ${inv.code}`,
      );
      window.location.href = `mailto:${encodeURIComponent(inv.email ?? "")}?subject=${subject}&body=${body}`;
      return;
    }

    if (tryNativeAndroidShare("Join Chorepot", msg, link)) {
      return;
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator
        .share({
          title: "Join Chorepot",
          text: msg,
          url: link,
        })
        .catch(() => undefined);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard
        .writeText(msg)
        .then(() => toast.success("Invite copied to clipboard"));
    }
  }

  async function finishOnboarding() {
    if (!activeFamily) return;
    setBusy(true);
    try {
      const existingRealChildren = activeFamily.members.filter(
        (m) => m.role === "child" && !m.isManaged,
      );
      const allChildrenIds = [
        ...existingRealChildren.map((m) => m.id),
        ...childrenList.map((c) => c.id),
      ];

      const starterChores: Array<Record<string, unknown>> = [];
      for (const template of STARTER_CHORES) {
        const sel = starterMap[template.key];
        if (!sel?.selected) continue;
        const pence = Math.max(0, Math.round((Number(sel.valueStr) || 0) * 100));
        const targets = sel.assignee === "all" ? allChildrenIds : [sel.assignee];
        for (const childId of targets) {
          starterChores.push({
            title: template.title,
            description: template.description,
            emoji: template.emoji,
            value: pence,
            frequency: template.frequency,
            choreCategory: template.choreCategory,
            rewardMode: template.rewardMode ?? "per_day",
            day: template.day,
            days: template.days,
            requirePhoto: template.requirePhoto,
            childId,
          });
        }
      }

      await executeFamilyAction(activeFamily, "complete_onboarding", {
        parentName: parentName.trim() || "Parent",
        parentAvatar,
        paydayFrequency: paydayFreq,
        paydayDay,
        parentPin: parentPin.trim(),
        managedChildren: childrenList,
        pendingInvites,
        starterChores,
      });

      toast.success("Your family chore space is ready! 🌱");
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not finish setup");
    } finally {
      setBusy(false);
    }
  }

  const origin = typeof window === "undefined" ? "https://chorepot.app" : window.location.origin;

  const visibleCategories =
    starterCategoryFilter === "all"
      ? CHORE_CATEGORIES
      : CHORE_CATEGORIES.filter((c) => c.id === starterCategoryFilter);

  if (!activeFamily && entryMode === "join") {
    return (
      <main className="setup-page">
        <section className="wizard-card">
          <span className="brand-mark">
            <Sprout />
          </span>
          <h1>Your family is waiting</h1>
          <p>Enter the 6-character invite code sent by your parent or partner.</p>
          <form className="dialog-form" onSubmit={handleJoinSubmit}>
            <label>
              Family invite code
              <Input
                maxLength={6}
                minLength={6}
                required
                placeholder="e.g. A1B2C3"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
            </label>
            <Button disabled={busy}>
              Join my family <ArrowRight size={15} />
            </Button>
          </form>
          <Button variant="link" className="mt-2" onClick={() => setEntryMode("create")}>
            Setting up a brand-new family? Create one instead
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="setup-page">
      <section className="wizard-card wizard-wide">
        <div className="wizard-top">
          <div className="flex items-center gap-3">
            <span className="brand-mark">
              <Sprout />
            </span>
            <div>
              <span className="wizard-eyebrow">STEP {step} OF 4</span>
              <h1>
                {step === 1
                  ? "Set up your family"
                  : step === 2
                    ? "Add your children"
                    : step === 3
                      ? "Invite a co-parent"
                      : "Pick starter chores"}
              </h1>
            </div>
          </div>
          {!activeFamily && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEntryMode("join")}>
              Have an invite code?
            </Button>
          )}
        </div>

        <div className="wizard-progress">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`wizard-dot ${step >= n ? "active" : ""}`} />
          ))}
        </div>

        {step === 1 && (
          <form className="dialog-form" onSubmit={handleStep1Submit}>
            <p className="m-0 text-xs text-muted-foreground">
              Every family has its own private workspace, chores, and pocket money balance.
            </p>
            <div className="form-pair">
              <label>
                Family name
                <Input
                  required
                  minLength={2}
                  placeholder="e.g. The Andrews Family"
                  value={familyName}
                  disabled={Boolean(activeFamily)}
                  onChange={(e) => setFamilyName(e.target.value)}
                />
              </label>
              <label>
                Your name
                <Input
                  required
                  placeholder="e.g. Kevin"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                />
              </label>
            </div>

            <div>
              <span className="field-label">Your avatar</span>
              <div className="avatar-row">
                {parentAvatars.map((av) => (
                  <button
                    key={av}
                    type="button"
                    className={`avatar-pick ${parentAvatar === av ? "active" : ""}`}
                    onClick={() => setParentAvatar(av)}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-pair">
              <label>
                Payday schedule
                <select
                  value={paydayFreq}
                  onChange={(e) => {
                    const next = e.target.value === "monthly" ? "monthly" : "weekly";
                    setPaydayFreq(next);
                    setPaydayDay(next === "monthly" ? 1 : 4);
                  }}
                >
                  <option value="weekly">Weekly pocket money</option>
                  <option value="monthly">Monthly pocket money</option>
                </select>
              </label>
              {paydayFreq === "weekly" ? (
                <label>
                  Payday day
                  <select value={paydayDay} onChange={(e) => setPaydayDay(Number(e.target.value))}>
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
            </div>

            <label>
              <span className="flex items-center gap-1.5">
                <Lock size={13} /> Optional 4-digit Parent PIN (for shared devices)
              </span>
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder="e.g. 1234 (leave blank to skip)"
                value={parentPin}
                onChange={(e) => setParentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <small className="font-normal text-muted-foreground">
                Keeps children in Kid Mode when using your phone or a shared tablet.
              </small>
            </label>

            <Button disabled={busy}>
              Continue to children <ArrowRight size={15} />
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="dialog-form">
            <p className="m-0 text-xs text-muted-foreground">
              Add each child now so you can assign chores right away—even if they don’t have an
              email address or their own device yet.
            </p>

            <div className="wizard-subbox">
              <div className="form-pair">
                <label>
                  Child’s name
                  <Input
                    placeholder="e.g. Lily"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                  />
                </label>
                <div>
                  <span className="field-label">Child’s avatar</span>
                  <div className="avatar-row">
                    {childAvatars.map((av) => (
                      <button
                        key={av}
                        type="button"
                        className={`avatar-pick ${childAvatar === av ? "active" : ""}`}
                        onClick={() => setChildAvatar(av)}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <span className="field-label">Child’s favourite colour theme</span>
                <div className="theme-swatch-list">
                  {CHILD_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`theme-swatch-pill ${childTheme === t.id ? "active" : ""}`}
                      onClick={() => setChildTheme(t.id)}
                    >
                      <span className="theme-swatch-dot" style={{ backgroundColor: t.swatch }} />
                      {t.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mode-toggle-grid">
                <button
                  type="button"
                  className={`mode-card ${childMode === "no_email" ? "active" : ""}`}
                  onClick={() => setChildMode("no_email")}
                >
                  <Tablet size={16} />
                  <div>
                    <strong>No email / Shared device</strong>
                    <span>Use Kid Mode on your phone or tablet</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`mode-card ${childMode === "invite" ? "active" : ""}`}
                  onClick={() => setChildMode("invite")}
                >
                  <Smartphone size={16} />
                  <div>
                    <strong>Own phone or tablet</strong>
                    <span>Create an invite link / code for their device</span>
                  </div>
                </button>
              </div>

              {childMode === "invite" && (
                <label className="mt-3">
                  Child’s email address (optional)
                  <Input
                    type="email"
                    placeholder="lily@example.com (or leave blank for WhatsApp/QR)"
                    value={childEmail}
                    onChange={(e) => setChildEmail(e.target.value)}
                  />
                </label>
              )}

              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                disabled={busy}
                onClick={addChild}
              >
                <Plus size={15} /> Add child to family
              </Button>
            </div>

            {childrenList.length > 0 && (
              <div className="added-list">
                {childrenList.map((c) => (
                  <div className="added-chip" key={c.id}>
                    <span className="text-2xl">{c.avatar}</span>
                    <div className="flex-1">
                      <strong>{c.name}</strong>
                      <small>
                        {c.email ? `Invite for ${c.email}` : "Ready for Kid Mode + backup code"}
                      </small>
                    </div>
                    {c.inviteCode && <span className="code-pill">{c.inviteCode}</span>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${c.name}`}
                      onClick={() =>
                        setChildrenList((prev) => prev.filter((item) => item.id !== c.id))
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft size={15} /> Back
              </Button>
              <Button
                type="button"
                disabled={busy || (childrenList.length === 0 && !childName.trim())}
                onClick={async () => {
                  if (childName.trim()) {
                    const ok = await addChild();
                    if (!ok) return;
                  }
                  setStep(3);
                }}
              >
                Next: Co-parent <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="dialog-form">
            <p className="m-0 text-xs text-muted-foreground">
              Want your partner or another parent to review photo proofs, get alerts, and approve
              chores too? Create an invite link for them below (or skip for now).
            </p>

            <div className="wizard-subbox">
              <div className="form-pair">
                <label>
                  Co-parent’s name
                  <Input
                    placeholder="e.g. Sarah"
                    value={coParentName}
                    onChange={(e) => setCoParentName(e.target.value)}
                  />
                </label>
                <label>
                  Email address (optional)
                  <Input
                    type="email"
                    placeholder="partner@example.com"
                    value={coParentEmail}
                    onChange={(e) => setCoParentEmail(e.target.value)}
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                disabled={busy}
                onClick={addCoParent}
              >
                <Users size={15} /> Generate co-parent invite
              </Button>
            </div>

            {pendingInvites.filter((i) => i.role === "co_parent").length > 0 && (
              <div className="added-list">
                {pendingInvites
                  .filter((i) => i.role === "co_parent")
                  .map((inv) => (
                    <div className="added-chip" key={inv.id}>
                      <Users size={18} className="text-primary" />
                      <div className="flex-1">
                        <strong>{inv.name}</strong>
                        <small>{inv.email || "Share via WhatsApp or link"}</small>
                      </div>
                      <span className="code-pill">{inv.code}</span>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft size={15} /> Back
              </Button>
              <Button type="button" onClick={() => setStep(4)}>
                {pendingInvites.some((i) => i.role === "co_parent")
                  ? "Next: Starter chores"
                  : "Skip & pick starter chores"}{" "}
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="dialog-form">
            {pendingInvites.length > 0 && (
              <div className="wizard-subbox">
                <strong className="text-xs font-bold text-primary">
                  INVITE LINKS READY TO SEND
                </strong>
                <div className="mt-2 space-y-3">
                  {pendingInvites.map((inv) => (
                    <div className="invite-share-row" key={inv.id}>
                      <QRCodeSVG size={54} value={`${origin}/auth?code=${inv.code}`} />
                      <div className="min-w-0 flex-1">
                        <strong>
                          {inv.name} ({inv.role === "co_parent" ? "Co-parent" : "Child"})
                        </strong>
                        <div className="text-xs text-muted-foreground">
                          Code: <strong>{inv.code}</strong>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => shareInvite(inv, "whatsapp")}
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => shareInvite(inv, "email")}
                        >
                          <Mail size={13} /> Email
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => shareInvite(inv, "native")}
                        >
                          <Share2 size={13} /> Share
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(`${origin}/auth?code=${inv.code}`)
                              .then(() => toast.success("Invite link copied"))
                          }
                        >
                          <Copy size={13} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="field-label m-0 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary" /> Pick starter chores (optional)
                </span>
                <span className="text-xs text-muted-foreground">
                  {Object.values(starterMap).filter((s) => s.selected).length} selected
                </span>
              </div>

              <div className="cat-filter-bar mb-2">
                <button
                  type="button"
                  className={`cat-filter-chip ${starterCategoryFilter === "all" ? "active" : ""}`}
                  onClick={() => setStarterCategoryFilter("all")}
                >
                  All ({STARTER_CHORES.length})
                </button>
                {CHORE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`cat-filter-chip cat-${cat.id} ${
                      starterCategoryFilter === cat.id ? "active" : ""
                    }`}
                    onClick={() => setStarterCategoryFilter(cat.id)}
                  >
                    {cat.emoji} {cat.shortLabel}
                  </button>
                ))}
              </div>

              <div className="starter-scroll">
                {visibleCategories.map((cat) => (
                  <div key={cat.id} className="starter-group">
                    <div className="starter-cat">
                      <span className={`chore-cat-pill cat-${cat.id}`}>
                        {cat.emoji} {cat.label}
                      </span>
                    </div>
                    {STARTER_CHORES.filter((c) => c.choreCategory === cat.id).map((tpl) => {
                      const sel = starterMap[tpl.key] ?? {
                        selected: false,
                        valueStr: (tpl.value / 100).toFixed(2),
                        assignee: "all",
                      };
                      const scheduleLabel =
                        tpl.frequency === "daily"
                          ? "Every day"
                          : tpl.frequency === "once"
                            ? `One-off · ${days[tpl.day] ?? "Sun"}`
                            : tpl.days.length > 1
                              ? `Weekly · ${tpl.days.map((d) => days[d]).join(", ")}`
                              : `Weekly · ${days[tpl.day] ?? "Mon"}`;
                      return (
                        <div
                          key={tpl.key}
                          className={`starter-row ${sel.selected ? "selected" : ""}`}
                        >
                          <label className="starter-check">
                            <input
                              type="checkbox"
                              checked={sel.selected}
                              onChange={(e) =>
                                setStarterMap((prev) => ({
                                  ...prev,
                                  [tpl.key]: {
                                    ...sel,
                                    selected: e.target.checked,
                                  },
                                }))
                              }
                            />
                            <span className="text-xl">{tpl.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs">{tpl.title}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {scheduleLabel}
                                {tpl.requirePhoto && (
                                  <span className="ml-2 inline-flex items-center gap-0.5 text-primary">
                                    <Camera size={10} /> Photo proof
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                          {sel.selected && (
                            <div className="starter-controls">
                              <div className="starter-price">
                                <span>£</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.05"
                                  aria-label={`${tpl.title} reward`}
                                  value={sel.valueStr}
                                  onChange={(e) =>
                                    setStarterMap((prev) => ({
                                      ...prev,
                                      [tpl.key]: {
                                        ...sel,
                                        valueStr: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              {childrenList.length > 1 && (
                                <select
                                  aria-label={`Assign ${tpl.title}`}
                                  value={sel.assignee}
                                  onChange={(e) =>
                                    setStarterMap((prev) => ({
                                      ...prev,
                                      [tpl.key]: {
                                        ...sel,
                                        assignee: e.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="all">All kids</option>
                                  {childrenList.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                <ArrowLeft size={15} /> Back
              </Button>
              <Button type="button" disabled={busy} onClick={finishOnboarding}>
                <Check size={15} /> Finish setup & open dashboard (
                {money(
                  Object.entries(starterMap)
                    .filter(([, v]) => v.selected)
                    .reduce((sum, [, v]) => sum + Math.round((Number(v.valueStr) || 0) * 100), 0),
                )}
                )
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
