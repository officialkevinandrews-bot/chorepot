import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Sprout, ArrowLeft, Mail } from "lucide-react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export function AuthScreen({
  code,
  defaultSignup,
}: {
  code?: string | undefined;
  defaultSignup?: boolean | undefined;
}) {
  const [signup, setSignup] = useState(!!code || !!defaultSignup),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [forgot, setForgot] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (code || defaultSignup) setSignup(true);
  }, [code, defaultSignup]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget),
      email = String(f.get("email")),
      password = String(f.get("password"));
    if (code) sessionStorage.setItem("family-invite", code);
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setSent(true);
      } else if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: String(f.get("name")) },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Please try again");
    } finally {
      setBusy(false);
    }
  }
  async function social(provider: "google" | "lovable") {
    if (code) sessionStorage.setItem("family-invite", code);
    const r = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (r.error) toast.error(r.error.message);
    else if (!r.redirected) navigate({ to: "/dashboard" });
  }
  return (
    <main className="auth-page">
      <Link to="/" className="brand">
        <span className="brand-mark">
          <Sprout />
        </span>
        chorepot<span className="brand-dot">.</span>
      </Link>
      <div className="auth-layout">
        <div className="auth-art">
          <img src="/piggy-bank.png" alt="A cheerful piggy bank and gold coins" />
          <h1>
            Little chores.
            <br />
            Big possibilities.
          </h1>
          <p>A little better, together.</p>
        </div>
        <section className="auth-form">
          <Link className="back-link" to="/">
            <ArrowLeft size={16} />
            Back to family space
          </Link>
          <h2>
            {sent
              ? "Check your inbox 💌"
              : forgot
                ? "A fresh start"
                : signup
                  ? "Your family starts here"
                  : "Welcome back 👋"}
          </h2>
          <p>
            {sent
              ? "Follow the link in your email to continue."
              : code
                ? "You’ve been invited! Your family is waiting."
                : signup
                  ? "Make room for little wins and big dreams."
                  : "Let’s see what your little team has been up to."}
          </p>
          {!sent && (
            <>
              <form onSubmit={submit}>
                {signup && !forgot && (
                  <label>
                    Your name
                    <Input name="name" autoComplete="name" required placeholder="e.g. Sarah" />
                  </label>
                )}
                <label>
                  Email address
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                  />
                </label>
                {!forgot && (
                  <label>
                    Password
                    <Input
                      name="password"
                      type="password"
                      minLength={8}
                      autoComplete={signup ? "new-password" : "current-password"}
                      required
                      placeholder="At least 8 characters"
                    />
                  </label>
                )}
                <Button disabled={busy} className="w-full">
                  {forgot ? "Send reset email" : signup ? "Create my account" : "Sign in"} <Mail />
                </Button>
              </form>
              {!forgot && (
                <>
                  <div className="auth-divider">or join the team with</div>
                  <Button
                    className="google-button w-full"
                    variant="outline"
                    onClick={() => social("google")}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                  <Button className="w-full" variant="outline" onClick={() => social("lovable")}>
                    <LovableMark />
                    Continue with Lovable
                  </Button>
                </>
              )}
              <div className="auth-switch">
                <Button
                  variant="link"
                  onClick={() => {
                    setSignup(!signup);
                    setForgot(false);
                  }}
                >
                  {signup ? "Already part of the team? Sign in" : "New here? Create your family"}
                </Button>
                {!signup && (
                  <Button variant="link" onClick={() => setForgot(!forgot)}>
                    {forgot ? "Back to sign in" : "Forgot password?"}
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
export function ResetPassword() {
  const [done, setDone] = useState(false),
    [allowed, setAllowed] = useState(false);
  useState(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      supabase.auth
        .getUser()
        .then(({ data }) => setAllowed(hash.includes("type=recovery") && !!data.user));
    }
  });
  return (
    <main className="reset-page">
      <section>
        <Sprout className="text-primary" />
        <h1>{done ? "Your password is updated" : "Set a new password"}</h1>
        {done ? (
          <Button asChild>
            <Link to="/dashboard">Back to your family</Link>
          </Button>
        ) : (
          <form
            className="dialog-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const { error } = await supabase.auth.updateUser({
                password: String(f.get("password")),
              });
              if (error) toast.error(error.message);
              else setDone(true);
            }}
          >
            <p>
              {allowed
                ? "Choose a secure new password."
                : "Open the recovery link in your email to continue."}
            </p>
            <Input name="password" type="password" minLength={8} required disabled={!allowed} />
            <Button disabled={!allowed}>Update password</Button>
          </form>
        )}
      </section>
    </main>
  );
}
