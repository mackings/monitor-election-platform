"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AssignedPUProvider, useAssignedPU } from "@/components/field/AssignedPUContext";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useLocationPing } from "@/lib/hooks/useLocationPing";
import { cn } from "@/lib/utils";
import { Home, AlertTriangle, FileText, Users, LogOut, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/field", label: "Home", icon: Home },
  { href: "/field/report", label: "Report", icon: AlertTriangle },
  { href: "/field/results", label: "Results", icon: FileText },
  { href: "/field/community", label: "Community", icon: Users },
];

function initials(name?: string) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function InlineNav({ pathname }: { pathname: string }) {
  return (
    <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 sm:flex dark:border-slate-800 dark:bg-slate-900">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function FloatingBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-4 bottom-3 z-40 sm:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around rounded-2xl border border-slate-200/70 bg-white/90 py-1.5 shadow-lg shadow-slate-900/10 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/90">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-colors",
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  active && "bg-indigo-50 dark:bg-indigo-500/10",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function FieldHeader() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const pu = useAssignedPU();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 font-heading text-sm font-bold text-white">
            {initials(user?.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {pu?.pu_name ?? (user?.assigned_pu_code ? `PU ${user.assigned_pu_code}` : "No PU assigned")}
            </p>
          </div>
        </div>

        <InlineNav pathname={pathname} />

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/field/account"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-300"
            aria-label="My account"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-300"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function FieldShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const status = useAuthStore((s) => s.user?.status);
  useLocationPing(status === "active");

  return (
    <AuthGuard allow={["field_officer"]}>
      <AssignedPUProvider>
        <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
          <FieldHeader />
          <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 sm:pb-10">
            {children}
          </main>
          <FloatingBottomNav pathname={pathname} />
        </div>
      </AssignedPUProvider>
    </AuthGuard>
  );
}
