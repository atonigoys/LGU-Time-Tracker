import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  CalendarClock,
  BarChart3,
  Timer,
  PartyPopper,
  ScrollText,
  Settings,
  IdCard,
  UserCircle,
  Megaphone,
} from "lucide-react";
import type { Role } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  shortLabel?: string;
}

export const SIDEBAR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "HR"] },
  { href: "/employees", label: "Employees", icon: Users, roles: ["Admin", "HR"] },
  { href: "/scanner", label: "QR Scanner", icon: ScanLine, roles: ["Admin", "HR"] },
  { href: "/attendance", label: "Attendance", icon: CalendarClock, roles: ["Admin", "HR"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["Admin", "HR"] },
  { href: "/schedules", label: "Schedules", icon: Timer, roles: ["Admin"] },
  { href: "/holidays", label: "Holidays", icon: PartyPopper, roles: ["Admin", "HR"] },
  { href: "/announcements", label: "Announcements", icon: Megaphone, roles: ["Admin", "HR"] },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["Admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["Admin"] },
  { href: "/employee-dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Employee"] },
  { href: "/my-attendance", label: "My Attendance", icon: CalendarClock, roles: ["Employee"] },
  { href: "/my-qr", label: "My QR Code", icon: IdCard, roles: ["Employee"] },
  { href: "/my-announcements", label: "Announcements", icon: Megaphone, roles: ["Employee"] },
  { href: "/profile", label: "My Profile", icon: UserCircle, roles: ["Employee"] },
];

export const BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", shortLabel: "Home", icon: LayoutDashboard, roles: ["Admin", "HR"] },
  { href: "/scanner", label: "Scan", icon: ScanLine, roles: ["Admin", "HR"] },
  { href: "/attendance", label: "Attendance", icon: CalendarClock, roles: ["Admin", "HR"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["Admin", "HR"] },
  { href: "/employees", label: "Staff", icon: Users, roles: ["Admin", "HR"] },
  { href: "/employee-dashboard", label: "Home", icon: LayoutDashboard, roles: ["Employee"] },
  { href: "/my-attendance", label: "DTR", icon: CalendarClock, roles: ["Employee"] },
  { href: "/my-qr", label: "My QR", icon: IdCard, roles: ["Employee"] },
  { href: "/my-announcements", label: "News", icon: Megaphone, roles: ["Employee"] },
  { href: "/profile", label: "Profile", icon: UserCircle, roles: ["Employee"] },
];
