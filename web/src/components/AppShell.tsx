"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Bell, ChevronDown, Loader2, LogOut, PanelLeftClose, PanelLeftOpen, Settings, UserCircle } from "lucide-react";
import { useSession } from "@/lib/session";
import { useNotifications } from "@/lib/notifications";
import { LogoutDialog } from "@/components/LogoutDialog";
import { useBackgroundRefreshing } from "@/lib/cache";
import { warmPages } from "@/lib/prefetch";
import { SIDEBAR_NAV, BOTTOM_NAV } from "@/lib/nav";
import { Avatar } from "@/components/Avatar";
import type { Role } from "@/lib/types";

export const APP_VERSION = "1.0.0";

const ROLE_LABELS: Record<Role, string> = {
  Admin: "Administrator",
  HR: "HR Officer",
  Employee: "Employee",
};

const COLLAPSE_KEY = "lgu.sidebarCollapsed";

function readCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(COLLAPSE_KEY);
    if (stored !== null) return stored === "1";
  } catch {
    // storage unavailable - fall through to the width-based default
  }
  // Tablets get the compact sidebar by default so content has room.
  return window.innerWidth < 1024;
}

const menuItemCls =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] text-gray-700 outline-none select-none data-[highlighted]:bg-green-50 data-[highlighted]:text-green-900";
const menuContentCls =
  "z-[150] min-w-[220px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg data-[state=open]:animate-[fade-in_150ms_ease-out]";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { session, logout } = useSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const notifications = useNotifications(session?.user.role);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const refreshing = useBackgroundRefreshing();

  const role0 = session?.user.role;
  const userId0 = session?.user.employeeId;
  useEffect(() => {
    if (role0 && userId0) warmPages(role0, userId0);
  }, [role0, userId0]);

  useEffect(() => {
    // Read after mount so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // non-essential preference
      }
      return next;
    });
  }

  if (!session) return null;
  const role = session.user.role;

  const sidebarItems = SIDEBAR_NAV.filter((item) => item.roles.includes(role));
  const bottomItems = BOTTOM_NAV.filter((item) => item.roles.includes(role));
  const accountSettingsHref = role === "Admin" ? "/settings" : "/profile#password";

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="flex min-h-screen">
        {/* Desktop / tablet sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-green-900 text-white transition-[width] duration-200 md:flex ${
            collapsed ? "w-[72px]" : "w-[252px]"
          }`}
          aria-label="Main navigation"
        >
          <div className={`flex h-16 items-center gap-3 border-b border-white/10 ${collapsed ? "justify-center px-2" : "px-4"}`}>
            <Image
              src="/logo.png"
              alt="LGU Time Tracker logo"
              width={38}
              height={38}
              className="shrink-0 rounded-full bg-white ring-2 ring-white/20"
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[15px] leading-tight font-bold tracking-tight">LGU Time Tracker</div>
                <div className="truncate text-[11px] text-green-100/70">Daily Time Record System</div>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-2.5 py-3">
            <ul className="flex flex-col gap-0.5">
              {sidebarItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg py-2.5 text-[13.5px] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none ${
                      collapsed ? "justify-center px-0" : "px-3"
                    } ${
                      active
                        ? "bg-white/[0.12] font-semibold text-white"
                        : "text-green-50/80 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {active && (
                      <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-amber-400" />
                    )}
                    <Icon
                      size={18}
                      strokeWidth={active ? 2.3 : 1.9}
                      className={`shrink-0 ${active ? "text-amber-300" : "text-green-100/70 group-hover:text-white"}`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            side="right"
                            sideOffset={10}
                            className="z-[160] rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md"
                          >
                            {item.label}
                            <Tooltip.Arrow className="fill-gray-900" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-white/10 px-2.5 py-2.5">
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`flex w-full items-center gap-3 rounded-lg py-2 text-[13px] text-green-50/70 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none ${
                collapsed ? "justify-center" : "px-3"
              }`}
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              {!collapsed && "Collapse"}
            </button>
            <button
              onClick={() => setLogoutOpen(true)}
              aria-label="Logout"
              title={collapsed ? "Logout" : undefined}
              className={`mt-0.5 flex w-full items-center gap-3 rounded-lg py-2 text-[13px] text-green-50/80 transition-colors hover:bg-red-500/15 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none ${
                collapsed ? "justify-center" : "px-3"
              }`}
            >
              <LogOut size={17} />
              {!collapsed && "Logout"}
            </button>
          </div>

          {!collapsed ? (
            <div className="border-t border-white/10 px-5 py-3 text-[11px] leading-snug text-green-100/55">
              <div className="font-semibold text-green-100/75">LGU Time Tracker</div>
              <div>v{APP_VERSION}</div>
            </div>
          ) : (
            <div className="border-t border-white/10 py-3 text-center text-[10px] text-green-100/50">v{APP_VERSION}</div>
          )}
        </aside>

        <main
          className={`flex min-h-screen min-w-0 flex-1 flex-col transition-[margin] duration-200 ${
            collapsed ? "md:ml-[72px]" : "md:ml-[252px]"
          }`}
        >
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur md:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <Image src="/logo.png" alt="" width={30} height={30} className="shrink-0 rounded-full md:hidden" />
              <h1 className="truncate text-[17px] font-bold tracking-tight text-green-900 md:text-lg">{title}</h1>
              {refreshing && (
                <span
                  role="status"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11.5px] font-medium text-gray-500"
                >
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                  <span className="hidden sm:inline">Updating…</span>
                  <span className="sr-only sm:hidden">Updating</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  aria-label={notifications.length ? `Notifications (${notifications.length} new)` : "Notifications"}
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-green-900 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
                >
                  <Bell size={18} />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={8} className={`${menuContentCls} w-[300px]`}>
                    <div className="px-2.5 pt-1.5 pb-2 text-[12px] font-bold tracking-wide text-gray-500 uppercase">
                      Notifications
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-2.5 pb-3 text-[13px] text-gray-500">You&apos;re all caught up.</div>
                    ) : (
                      notifications.map((n) => (
                        <DropdownMenu.Item key={n.id} asChild className={`${menuItemCls} items-start`}>
                          <Link href={n.href}>
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                            <span>
                              <span className="block font-semibold text-gray-900">{n.title}</span>
                              <span className="block text-[12px] text-gray-500">{n.detail}</span>
                            </span>
                          </Link>
                        </DropdownMenu.Item>
                      ))
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  aria-label="Account menu"
                  className="flex items-center gap-2.5 rounded-lg py-1 pr-1.5 pl-1 transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none sm:pl-2.5"
                >
                  <div className="hidden text-right sm:block">
                    <div className="max-w-[180px] truncate text-[13.5px] leading-tight font-semibold text-gray-900">
                      {session.user.fullName}
                    </div>
                    <div className="text-[11.5px] text-gray-500">{ROLE_LABELS[role]}</div>
                  </div>
                  <Avatar name={session.user.fullName} photoUrl={session.user.photoUrl} size={34} />
                  <ChevronDown size={14} className="hidden text-gray-400 sm:block" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={8} className={menuContentCls}>
                    <div className="border-b border-gray-100 px-2.5 pt-1.5 pb-2.5 sm:hidden">
                      <div className="text-[13.5px] font-semibold text-gray-900">{session.user.fullName}</div>
                      <div className="text-[11.5px] text-gray-500">{ROLE_LABELS[role]}</div>
                    </div>
                    <DropdownMenu.Item asChild className={menuItemCls}>
                      <Link href="/profile">
                        <UserCircle size={16} className="text-gray-400" /> Profile
                      </Link>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild className={menuItemCls}>
                      <Link href={accountSettingsHref}>
                        <Settings size={16} className="text-gray-400" /> Account Settings
                      </Link>
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
                    <DropdownMenu.Item
                      onSelect={() => setTimeout(() => setLogoutOpen(true), 0)}
                      className={`${menuItemCls} text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700`}
                    >
                      <LogOut size={16} /> Logout
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </header>

          <div className="flex-1 px-4 pt-5 pb-24 md:px-6 md:pb-8">{children}</div>
        </main>

        <LogoutDialog
          open={logoutOpen}
          onOpenChange={setLogoutOpen}
          onConfirm={logout}
          user={{
            fullName: session.user.fullName,
            roleLabel: ROLE_LABELS[role],
            email: session.user.email,
            photoUrl: session.user.photoUrl,
          }}
        />

        {/* Mobile bottom nav */}
        <nav
          aria-label="Main navigation"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[62px] bg-green-950 shadow-[0_-2px_10px_rgba(0,0,0,0.15)] md:hidden"
        >
          {bottomItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] ${
                  active ? "font-semibold text-amber-400" : "text-white/75"
                }`}
              >
                <Icon size={18} strokeWidth={2} />
                {item.shortLabel ?? item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </Tooltip.Provider>
  );
}
