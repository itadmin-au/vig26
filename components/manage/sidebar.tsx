// components/manage/sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    IconLayoutDashboard,
    IconCalendarEvent,
    IconUsers,
    IconChartBar,
    IconTag,
    IconBuilding,
    IconChevronLeft,
    IconChevronRight,
    IconMenu2,
    IconX,
    IconScan,
    IconTools,
    IconMail,
    IconTimeline,
    IconClipboardList,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
    {
        label: "Dashboard",
        href: "/manage/dashboard",
        icon: <IconLayoutDashboard size={20} />,
        roles: ["coordinator", "dept_admin", "super_admin"],
    },
    {
        label: "Events",
        href: "/manage/events",
        icon: <IconCalendarEvent size={20} />,
        roles: ["coordinator", "dept_admin", "super_admin"],
    },
    {
        label: "Schedule",
        href: "/manage/schedule",
        icon: <IconTimeline size={20} />,
        roles: ["coordinator", "dept_admin", "super_admin"],
    },
    {
        label: "Scanner",
        href: "/manage/scan",
        icon: <IconScan size={20} />,
        roles: ["coordinator", "dept_admin", "super_admin"],
    },
    {
        label: "Users",
        href: "/manage/users",
        icon: <IconUsers size={20} />,
        roles: ["dept_admin", "super_admin"],
    },
    {
        label: "Registrations",
        href: "/manage/registrations",
        icon: <IconClipboardList size={20} />,
        roles: ["dept_admin", "super_admin"],
    },
    {
        label: "Analytics",
        href: "/manage/analytics",
        icon: <IconChartBar size={20} />,
        roles: ["super_admin"],
    },
    {
        label: "Tools",
        href: "/manage/tools",
        icon: <IconTools size={20} />,
        roles: ["super_admin"],
    },
    {
        label: "Send Email",
        href: "/manage/email",
        icon: <IconMail size={20} />,
        roles: ["super_admin"],
    },
    {
        label: "Categories",
        href: "/manage/categories",
        icon: <IconTag size={20} />,
        roles: ["super_admin"],
    },
    {
        label: "Departments",
        href: "/manage/departments",
        icon: <IconBuilding size={20} />,
        roles: ["super_admin"],
    },
];

interface ManageSidebarProps {
    role: UserRole;
}

export function ManageSidebar({ role }: ManageSidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            <div className={cn(
                "flex items-center h-16 px-4 border-b border-zinc-200 shrink-0",
                collapsed ? "justify-center" : "justify-between"
            )}>
                {!collapsed && (
                    <span className="font-bold text-zinc-900 text-base tracking-tight">
                        Vigyaan<span className="text-orange-500">rang</span>
                    </span>
                )}
                <button
                    onClick={() => setCollapsed((v) => !v)}
                    className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                    {collapsed
                        ? <IconChevronRight size={16} />
                        : <IconChevronLeft size={16} />
                    }
                </button>
                <button
                    onClick={() => setMobileOpen(false)}
                    className="md:hidden flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-700"
                >
                    <IconX size={16} />
                </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {visibleItems.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                isActive
                                    ? "bg-orange-50 text-orange-600"
                                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100",
                                collapsed && "justify-center px-2"
                            )}
                        >
                            <span className={cn(
                                "shrink-0",
                                isActive ? "text-orange-500" : "text-zinc-400"
                            )}>
                                {item.icon}
                            </span>
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className={cn(
                "px-3 py-3 border-t border-zinc-200",
                collapsed && "flex justify-center"
            )}>
                <div className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg",
                    collapsed && "px-2"
                )}>
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-orange-600">
                            {role === "super_admin" ? "SA" : role === "dept_admin" ? "DA" : "CO"}
                        </span>
                    </div>
                    {!collapsed && (
                        <span className="text-xs text-zinc-500 font-medium capitalize">
                            {role.replace("_", " ")}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-9 h-9 bg-white border border-zinc-200 rounded-lg shadow-sm text-zinc-600"
            >
                <IconMenu2 size={18} />
            </button>

            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside className={cn(
                "md:hidden fixed inset-y-0 left-0 z-50 bg-white border-r border-zinc-200 transition-transform duration-200",
                "w-64",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <SidebarContent />
            </aside>

            <aside className={cn(
                "hidden md:flex flex-col bg-white border-r border-zinc-200 shrink-0 transition-all duration-200",
                collapsed ? "w-15" : "w-60"
            )}>
                <SidebarContent />
            </aside>
        </>
    );
}