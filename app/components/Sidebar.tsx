"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getThemeForRole } from "@/lib/theme";

const BASE_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/dispatches", label: "Dispatches", icon: "📋" },
  { href: "/calendar", label: "My Calendar", icon: "📅" },
  { href: "/calendar-view", label: "Public Calendar", icon: "🌐" },
  { href: "/workload-view", label: "Workload", icon: "📊" },
];

const ADMIN_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/dispatches", label: "Dispatches", icon: "📋" },
  { href: "/workload-view", label: "Workload", icon: "📊" },
  { href: "/dispatch/new", label: "New Dispatch", icon: "＋" },
  { href: "/admin", label: "Admin Panel", icon: "🛡️" },
];

const AMATS_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/amats", label: "AMaTS Sessions", icon: "📋" },
  { href: "/workload-view", label: "Workload", icon: "📊" },
  { href: "/amats/new", label: "New Testing Form", icon: "＋" },
  { href: "/admin", label: "Admin Panel", icon: "🛡️" },
];

type PendingUser = { id: string; full_name: string; role: string; email?: string };

type SidebarProps = {
  email: string;
  role: string;
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ email, role, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const theme = getThemeForRole(role);

  const isManager = role === "admin_scheduler" || role === "AMaTS";
  const NAV = role === "admin_scheduler" ? ADMIN_NAV : role === "AMaTS" ? AMATS_NAV : BASE_NAV;

  const [pending, setPending] = useState<PendingUser[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    if (!isManager) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const users = await res.json();
      setPending(users.filter((u: PendingUser & { active?: boolean }) => !u.active));
    } catch { /* ignore */ }
  }, [isManager, supabase]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  async function activateUser(id: string) {
    setActivating(id);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    if (res.ok) {
      setPending(prev => prev.filter(u => u.id !== id));
    }
    setActivating(null);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-40 transition-all duration-300"
      style={{
        width: collapsed ? 72 : 256,
        background: `linear-gradient(180deg, ${theme.sidebarFrom} 0%, ${theme.sidebarTo} 100%)`,
      }}>

      {/* Logo area + toggle */}
      <div className="px-3 py-4 border-b flex items-center justify-between" style={{ borderColor: `${theme.accent}4D` }}>
        {!collapsed && (
          <div className="flex items-center gap-3 pl-2">
            <img src="/amtec-logo.png" alt="AMTEC Logo" className="w-9 h-9 object-contain" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">AMTEC</p>
              <p className="text-xs leading-tight" style={{ color: theme.accent }}>
                {role === "AMaTS" ? "AMaTS" : "Dispatch Scheduler"}
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center w-full">
            <img src="/amtec-logo.png" alt="AMTEC" className="w-8 h-8 object-contain" />
          </div>
        )}
        <button onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
          style={{ color: "rgba(255,255,255,0.6)" }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            {collapsed ? (
              <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            ) : (
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            )}
          </svg>
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 rounded-lg text-sm font-medium transition-all"
              style={{
                padding: collapsed ? "10px 0" : "10px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: active ? `${theme.accent}33` : "transparent",
                color: active ? theme.accent : "rgba(255,255,255,0.7)",
                borderLeft: collapsed ? "none" : active ? `3px solid ${theme.accent}` : "3px solid transparent",
              }}
              title={collapsed ? label : undefined}>
              <span className="text-base shrink-0" style={{ fontSize: collapsed ? "1.1rem" : "1rem" }}>{icon}</span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Pending Activations Notification ── */}
      {isManager && pending.length > 0 && (
        <div className="px-2 pb-2">
          {collapsed ? (
            /* Collapsed: just a badge dot */
            <button onClick={() => { onToggle(); setTimeout(() => setShowPending(true), 350); }}
              className="w-full flex items-center justify-center py-2 relative"
              title={`${pending.length} pending activation(s)`}>
              <span className="text-base">🔔</span>
              <span className="absolute top-1 right-3 w-4 h-4 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ background: "#EF4444", fontSize: "0.6rem" }}>
                {pending.length}
              </span>
            </button>
          ) : (
            /* Expanded: notification card */
            <div className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <button onClick={() => setShowPending(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔔</span>
                  <span className="text-xs font-semibold text-white">Pending Signups</span>
                </div>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ background: "#EF4444", fontSize: "0.6rem" }}>
                  {pending.length}
                </span>
              </button>

              {showPending && (
                <div className="px-2 pb-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {pending.map(u => (
                    <div key={u.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{u.full_name}</p>
                        <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {u.role === "AMaTS" ? "AMaTS" : "Scheduler"}
                        </p>
                      </div>
                      <button
                        onClick={() => activateUser(u.id)}
                        disabled={activating === u.id}
                        className="shrink-0 px-2.5 py-1 rounded-md text-xs font-bold transition-all disabled:opacity-50"
                        style={{ background: "#10B981", color: "white" }}>
                        {activating === u.id ? "..." : "Activate"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 pb-2">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
            style={{ background: theme.accentLight, color: theme.accent }}>
            {role || "staff"}
          </span>
        </div>
      )}

      {/* User info + logout */}
      <div className="px-3 py-3 border-t" style={{ borderColor: `${theme.accent}4D` }}>
        {!collapsed && (
          <div className="mb-2 px-1">
            <p className="text-xs font-semibold truncate" style={{ color: theme.accent }}>{email}</p>
          </div>
        )}
        <button onClick={logout}
          className="w-full text-sm py-2 rounded-lg font-medium transition-all flex items-center gap-2"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
            justifyContent: collapsed ? "center" : "flex-start",
            paddingLeft: collapsed ? 0 : 12,
            paddingRight: collapsed ? 0 : 12,
          }}
          title={collapsed ? "Logout" : undefined}>
          <span>→</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}