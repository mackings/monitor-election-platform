"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useIncidentStore } from "@/lib/store/useIncidentStore";
import { useCollationStore } from "@/lib/store/useCollationStore";
import { useNotificationStore, type NotificationSection } from "@/lib/store/useNotificationStore";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  BarChart3,
  LogOut,
  MapPin,
  Vote,
  Activity,
  ShieldCheck,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; notify?: NotificationSection }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/polling-units", label: "Polling Units", icon: Vote },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle, notify: "incidents" },
  { href: "/activity", label: "Live Activity", icon: Activity, notify: "activity" },
  { href: "/collation", label: "Collation", icon: BarChart3, notify: "collation" },
];

// Only real admins can invite other admins — supervisors see the rest of
// the dashboard but not this menu.
const ADMIN_ONLY_NAV_ITEM: (typeof NAV_ITEMS)[number] = { href: "/admins", label: "Admins", icon: ShieldCheck };

function initials(name?: string) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const navItems = user?.role === "admin" ? [...NAV_ITEMS, ADMIN_ONLY_NAV_ITEM] : NAV_ITEMS;

  const incidents = useIncidentStore((s) => s.incidents);
  const feed = useIncidentStore((s) => s.feed);
  const newResultsCount = useCollationStore((s) => s.newResultsCount);
  const lastSeen = useNotificationStore((s) => s.lastSeen);

  const incidentCount = useMemo(
    () => incidents.filter((i) => new Date(i.created_at).getTime() > lastSeen.incidents).length,
    [incidents, lastSeen.incidents],
  );
  const activityCount = useMemo(
    () => feed.filter((f) => new Date(f.at).getTime() > lastSeen.activity).length,
    [feed, lastSeen.activity],
  );
  const notifyCounts: Record<NotificationSection, number> = {
    incidents: incidentCount,
    activity: activityCount,
    collation: newResultsCount,
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold tracking-tight">Election Monitor</p>
          <p className="text-xs text-muted-foreground">Oyo State</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon, notify }) => {
          const active = pathname === href;
          const count = notify ? notifyCounts[notify] : 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    "ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    active ? "bg-white/25 text-white" : "bg-red-500 text-white",
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-slate-200 pt-3 dark:border-slate-800">
        <Link
          href="/account"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 -m-1 hover:bg-slate-100 dark:hover:bg-slate-900"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-slate-100 text-xs font-semibold dark:bg-slate-800">
              {initials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{user?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </Link>
        <button
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-300"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
