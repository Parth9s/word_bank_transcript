"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/upload", label: "Upload", icon: "↑" },
  { href: "/wordbank", label: "Word Bank", icon: "◆" },
];

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user || null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      router.refresh();
    } catch {
      // logout error
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
            <span className="text-base font-bold">W</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Word<span className="text-primary">Bank</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span className="text-xs">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="h-4 w-px bg-border/60 mx-1" />

          {/* User profile / Auth status */}
          {!loading && (
            <div>
              {user ? (
                <div className="flex items-center gap-2.5">
                  <span
                    title={user.email}
                    className="max-w-[140px] truncate text-xs font-medium text-muted-foreground sm:max-w-[200px]"
                  >
                    {user.name || user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20"
                >
                  Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
