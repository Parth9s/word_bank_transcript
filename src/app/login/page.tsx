"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSettingInitialPassword, setIsSettingInitialPassword] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          router.replace(redirectUrl);
        }
      })
      .catch(() => {});
  }, [router, redirectUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if ((isRegister || isSettingInitialPassword) && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create account");
        }
        router.replace(redirectUrl);
        router.refresh();
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            setInitialPassword: isSettingInitialPassword ? password : undefined,
          }),
        });
        const data = await res.json();

        if (data.needsPasswordSetup) {
          setIsSettingInitialPassword(true);
          setNotice(
            "Welcome! Since this is your first time logging into this account, please choose your password and confirm it below."
          );
          setLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error(data.error || "Failed to log in");
        }

        router.replace(redirectUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Background glow effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-1/2 -left-20 h-80 w-80 rounded-full bg-blue-600/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Brand header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
              <span className="text-xl font-bold">W</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">
              Word<span className="text-primary">Bank</span>
            </span>
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {isSettingInitialPassword
              ? "Set your account password"
              : isRegister
              ? "Create your WordBank account"
              : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSettingInitialPassword
              ? "Set a password to secure your existing words and transcripts."
              : isRegister
              ? "Start building your personal vocabulary library."
              : "Sign in to access your words and transcript progress."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
          {/* Notice banner */}
          <AnimatePresence>
            {notice && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-300 leading-relaxed"
              >
                {notice}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Your Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Parth Savaliya"
                  className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {isSettingInitialPassword ? "New Password" : "Password"}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {(isRegister || isSettingInitialPassword) && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Processing...
                </span>
              ) : isSettingInitialPassword ? (
                "Save Password & Continue →"
              ) : isRegister ? (
                "Create Account →"
              ) : (
                "Sign In →"
              )}
            </button>
          </form>

          {/* Toggle between register and login */}
          {!isSettingInitialPassword && (
            <div className="mt-6 text-center text-xs text-muted-foreground">
              {isRegister ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(false);
                      setError("");
                      setNotice("");
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account yet?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(true);
                      setError("");
                      setNotice("");
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Create account
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
