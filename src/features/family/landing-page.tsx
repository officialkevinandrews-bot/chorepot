import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Sprout,
  ArrowRight,
  CheckCircle2,
  Camera,
  PiggyBank,
  CalendarDays,
  Tablet,
  Users,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AndroidDownloadCard } from "./android-download-card";
import { ANDROID_APK_FILENAME, ANDROID_APK_PATH, isRunningInApk } from "./model";

const screenshots = [
  {
    id: "overview",
    label: "Parent Overview",
    title: "Parent Overview & Thumbs-Up Approval Queue",
    caption:
      "See every completed chore waiting for review, inspect photo proofs, and approve with one tap.",
    src: "/preview-overview.png",
    alt: "Chorepot parent dashboard showing pending approvals, weekly progress, and children balances",
  },
  {
    id: "child",
    label: "Child Missions",
    title: "Child’s Daily Missions & Celebrations",
    caption:
      "Kids get a cheerful view of today’s chores, tap Done when finished, and celebrate every win.",
    src: "/preview-child.png",
    alt: "Chorepot child view showing today's missions and savings goal progress",
  },
  {
    id: "money",
    label: "Payday & Savings",
    title: "Weekly Payday Summary & Visual Piggy Bank Goals",
    caption:
      "Track weekly earnings, awaiting approvals, payouts, and savings targets in pounds and pence.",
    src: "/preview-pocket-money.png",
    alt: "Chorepot pocket money payday summary breakdown and savings goals",
  },
] as const;

export function LandingPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [activeShot, setActiveShot] = useState<string>("overview");
  const [inApk, setInApk] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setInApk(isRunningInApk());
  }, []);

  function joinWithCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleaned = inviteCode.trim().toUpperCase();
    if (cleaned.length < 4) return;
    navigate({ to: "/auth", search: { code: cleaned } });
  }

  const currentShot = screenshots.find((s) => s.id === activeShot) ?? screenshots[0];

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Sprout />
          </span>
          chorepot<span className="brand-dot">.</span>
        </Link>

        <nav className="landing-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#screenshots">Inside the app</a>
          <a href="#features">Features</a>
          {!inApk && <a href="#android-app">Android App</a>}
        </nav>

        <div className="landing-actions">
          <Button variant="ghost" size="sm" asChild className="hide-mobile">
            <a href="#join-code">Have an invite code?</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/auth" search={{ signup: "1" }}>
              Get started free
            </Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <span className="hero-badge">🌱 MADE FOR UK FAMILIES · POUNDS & PENCE (£/p)</span>
            <h1>
              Little chores.
              <br />
              Big life lessons <span className="text-primary">(and pocket money!).</span>
            </h1>
            <p className="hero-lead">
              Set weekly or daily chores with rewards like 50p for English homework or £1.50 for a
              tidy bedroom. Kids tick chores off with optional photo proof, and parents confirm with
              a tap before pocket money is awarded.
            </p>

            <div className="hero-ctas">
              <Button size="lg" asChild>
                <Link to="/auth" search={{ signup: "1" }}>
                  Create your family account <ArrowRight size={16} />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth">Sign in to your family</Link>
              </Button>
              {!inApk && (
                <Button size="lg" variant="secondary" asChild>
                  <a
                    href={ANDROID_APK_PATH}
                    download={ANDROID_APK_FILENAME}
                    type="application/vnd.android.package-archive"
                  >
                    <Download size={16} /> Download Android APK
                  </a>
                </Button>
              )}
            </div>

            <form id="join-code" className="hero-join-box" onSubmit={joinWithCode}>
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <KeyRound size={14} className="text-primary" />
                Joining a family? Enter your 6-digit invite code
              </div>
              <div className="hero-join-row">
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3"
                  maxLength={8}
                  aria-label="Family invite code"
                />
                <Button type="submit" variant="secondary">
                  Join family <ArrowRight size={14} />
                </Button>
              </div>
            </form>
          </div>

          <div className="hero-visual">
            <div className="shot-frame">
              <div className="shot-bar">
                <span />
                <span />
                <span />
                <small>chorepot · Parent Overview</small>
              </div>
              <img src="/preview-overview.png" alt="Chorepot live parent dashboard preview" />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-section">
          <div className="section-intro">
            <span className="eyebrow">SIMPLE & REWARDING</span>
            <h2>How Chorepot works for your family</h2>
            <p>
              Every family gets their own private workspace—synced live across website, phones, and
              tablets.
            </p>
          </div>

          <div className="steps-grid">
            <article className="step-card">
              <span className="step-num">1</span>
              <h3>Set up your family & chores</h3>
              <p>
                Add your children (with an invite link for their phone/tablet, or without an email
                for shared devices) and schedule chores by day of the week with rewards in £ and p.
              </p>
            </article>
            <article className="step-card">
              <span className="step-num">2</span>
              <h3>Kids tick off & snap photo proof</h3>
              <p>
                Children see today’s missions clearly, tick off finished chores, and snap a quick
                photo of their tidy bedroom or finished homework.
              </p>
            </article>
            <article className="step-card">
              <span className="step-num">3</span>
              <h3>Parent approval, savings & payday</h3>
              <p>
                Parents get notified, inspect the photo proof, and tap Approve to update the pocket
                money balance, visual savings goals, and weekly payday summary.
              </p>
            </article>
          </div>
        </section>

        <section id="screenshots" className="landing-section screenshots-band">
          <div className="section-intro">
            <span className="eyebrow">REAL APP PREVIEW</span>
            <h2>Designed for parents and kids alike</h2>
            <p>
              Switch between parent approval tools, child missions, and weekly pocket money
              summaries.
            </p>
          </div>

          <div className="shot-tabs">
            {screenshots.map((shot) => (
              <button
                key={shot.id}
                type="button"
                className={`shot-tab ${activeShot === shot.id ? "active" : ""}`}
                onClick={() => setActiveShot(shot.id)}
              >
                {shot.label}
              </button>
            ))}
          </div>

          <div className="shot-showcase">
            <div className="shot-frame">
              <div className="shot-bar">
                <span />
                <span />
                <span />
                <small>{currentShot.title}</small>
              </div>
              <img src={currentShot.src} alt={currentShot.alt} />
            </div>
            <div className="shot-caption">
              <h3>{currentShot.title}</h3>
              <p>{currentShot.caption}</p>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="section-intro">
            <span className="eyebrow">EVERYTHING YOUR FAMILY NEEDS</span>
            <h2>Built around real family routines</h2>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-icon mint">
                <CheckCircle2 size={20} />
              </span>
              <h3>Custom Chores & Rewards in £ / p</h3>
              <p>
                Pick weekly days, daily habits, or one-off bonus tasks, set any value in pence or
                pounds, and let weekly chores reset automatically every Monday.
              </p>
            </div>
            <div className="feature-card">
              <span className="feature-icon amber">
                <Camera size={20} />
              </span>
              <h3>Photo Proof & Parent Verification</h3>
              <p>
                Require or allow photo proof per chore. Review submissions, send chores back with a
                helpful note, or approve in one tap.
              </p>
            </div>
            <div className="feature-card">
              <span className="feature-icon pink">
                <PiggyBank size={20} />
              </span>
              <h3>Visual Piggy Bank Savings Goals</h3>
              <p>
                Children create visual targets for toys, outings, or games and track what they’ve
                saved toward each goal—even after payday.
              </p>
            </div>
            <div className="feature-card">
              <span className="feature-icon lavender">
                <CalendarDays size={20} />
              </span>
              <h3>Weekly or Monthly Payday Summaries</h3>
              <p>
                Choose your household’s payday day and view earned, pending, paid-out, and unpaid
                balances cleanly for every child.
              </p>
            </div>
            <div className="feature-card">
              <span className="feature-icon peach">
                <Tablet size={20} />
              </span>
              <h3>Kid Mode, PIN & Custom Colours</h3>
              <p>
                Invite older kids onto their own phone or tablet, or set up younger kids in seconds
                with Kid Mode, a 4-digit Parent PIN, and their own favourite colour theme.
              </p>
            </div>
            <div className="feature-card">
              <span className="feature-icon mint">
                <Users size={20} />
              </span>
              <h3>Co-Parent Support & WhatsApp Invites</h3>
              <p>
                Invite the other parent so both adults can manage chores and approve tasks—share
                links straight to WhatsApp, email, or QR.
              </p>
            </div>
          </div>
        </section>

        {!inApk && (
          <section id="android-app" className="landing-section android-download-band">
            <div className="section-intro">
              <span className="eyebrow">ANDROID PHONES & TABLETS</span>
              <h2>Download the Chorepot Android app</h2>
              <p>
                Put Chorepot straight on your phone and your children’s tablets—complete with Google
                sign-in, camera photo proof, and live sync.
              </p>
            </div>
            <AndroidDownloadCard showQr />
          </section>
        )}

        <section className="cta-banner">
          <div className="cta-banner-inner">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                <Sparkles size={14} /> PRIVATE FAMILY WORKSPACE
              </span>
              <h2>Ready to start your family’s chore pot?</h2>
              <p>
                Create your account, add your children in under two minutes, and pick starter chores
                to get going today.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/auth" search={{ signup: "1" }}>
                  Create your family <ArrowRight size={16} />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Sprout size={16} className="text-primary" /> Chorepot
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={13} /> Private per-household data
          </span>
          {!inApk && (
            <a
              href={ANDROID_APK_PATH}
              download={ANDROID_APK_FILENAME}
              type="application/vnd.android.package-archive"
              className="font-semibold text-primary hover:underline"
            >
              Download Android APK
            </a>
          )}
          <span>All amounts in GBP (£/p)</span>
        </div>
      </footer>
    </div>
  );
}
