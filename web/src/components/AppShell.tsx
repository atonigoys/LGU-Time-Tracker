"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useSession } from "@/lib/session";
import { SIDEBAR_NAV, BOTTOM_NAV } from "@/lib/nav";
import { Avatar } from "@/components/Avatar";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { session, logout } = useSession();
  const pathname = usePathname();

  if (!session) return null;
  const role = session.user.role;

  const sidebarItems = SIDEBAR_NAV.filter((item) => item.roles.includes(role));
  const bottomItems = BOTTOM_NAV.filter((item) => item.roles.includes(role));

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col bg-gradient-to-b from-green-800 to-green-950 text-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4.5 py-5">
          <Image src="/logo.png" alt="LGU Time Tracker" width={40} height={40} className="shrink-0 rounded-full" />
          <div>
            <div className="text-[15px] leading-tight font-bold">LGU Time Tracker</div>
            <div className="text-[11px] opacity-75">Daily Time Record System</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2.5">
          {sidebarItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 border-l-[3px] px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-amber-400 bg-white/10 font-semibold text-white"
                    : "border-transparent text-white/85 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={17} strokeWidth={2} /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-4.5 py-3.5">
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-sm text-white/85 transition-colors hover:text-white"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col md:ml-[250px]">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <h1 className="text-lg font-bold text-green-800">{title}</h1>
          <div className="flex items-center gap-2.5 text-sm">
            <div className="text-right">
              <div className="font-semibold">{session.user.fullName}</div>
              <div className="text-[11.5px] text-gray-500">{session.user.role}</div>
            </div>
            <Avatar name={session.user.fullName} photoUrl={session.user.photoUrl} size={34} />
          </div>
        </header>

        <div className="flex-1 px-3.5 pt-4 pb-24 md:px-6 md:pb-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[62px] bg-green-950 shadow-[0_-2px_10px_rgba(0,0,0,0.15)] md:hidden">
        {bottomItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] ${
                active ? "text-amber-400" : "text-white/75"
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              {item.shortLabel ?? item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
