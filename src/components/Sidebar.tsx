"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { menuGroups } from "@/config/sidebar";
import SidebarHeader from "./SidebarHeader";
import SidebarItem from "./SidebarItem";

// ──────────────────────────────────────────
// Props
// ──────────────────────────────────────────
type SidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

// ──────────────────────────────────────────
// Icons (bottom section)
// ──────────────────────────────────────────
const Icons = {
  home: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  logout: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  menu: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
};

// ──────────────────────────────────────────
// Tooltip (for collapsed bottom items)
// ──────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 pointer-events-none">
        {text}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// Sidebar component
// ──────────────────────────────────────────
export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  // Track which groups are expanded (by label)
  // Dashboard is always expanded by default
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // Auto-expand groups that contain an active item
    const activeGroups = new Set<string>();
    menuGroups.forEach((group) => {
      const hasActive = group.items.some(
        (item) => pathname === item.href || pathname.startsWith(item.href + "/")
      );
      if (hasActive) activeGroups.add(group.label);
    });
    // Always expand Dashboard
    if (menuGroups.length > 0) activeGroups.add(menuGroups[0].label);
    return activeGroups;
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const sidebarWidth = collapsed ? "w-[72px]" : "w-64";

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer toggle button */}
      <button
        className="fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-white shadow-lg border border-gray-200 lg:hidden hover:bg-gray-50 transition-colors"
        onClick={onMobileClose}
      >
        {mobileOpen ? Icons.close : Icons.menu}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30
          bg-white dark:bg-gray-900 border-r border-gray-200
          flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarWidth}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Brand + collapse toggle */}
        <SidebarHeader collapsed={collapsed} onToggleCollapse={onToggleCollapse} />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menuGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.label);
            const hasActiveItem = group.items.some(
              (item) => pathname === item.href || pathname.startsWith(item.href + "/")
            );

            return (
              <div key={group.label} className="py-1">
                {/* Section header - clickable toggle */}
                {!collapsed ? (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all duration-200
                      ${hasActiveItem && isExpanded
                        ? "text-blue-600"
                        : "text-gray-400 hover:text-gray-600"
                      }
                    `}
                  >
                    <span>{group.label}</span>
                    <span className={`transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
                      {Icons.chevronDown}
                    </span>
                  </button>
                ) : (
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-center">
                    •••
                  </p>
                )}

                {/* Items - animated expand/collapse */}
                <div
                  className={`
                    overflow-hidden transition-all duration-250 ease-in-out
                    ${isExpanded ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"}
                  `}
                >
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <SidebarItem
                        key={item.href}
                        item={item}
                        isActive={isActive(item.href)}
                        collapsed={collapsed}
                        onClose={onMobileClose}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className={`border-t border-gray-200 py-3 ${collapsed ? "px-2 space-y-1" : "px-3 space-y-2"}`}>
          {collapsed ? (
            <>
              <Tooltip text="Beranda">
                <Link
                  href="/"
                  onClick={onMobileClose}
                  className="flex items-center justify-center w-full py-3 rounded-xl text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  {Icons.home}
                </Link>
              </Tooltip>
              <Tooltip text="Logout">
                <button
                  onClick={() => {
                    document.cookie = "session=; path=/; max-age=0";
                    window.location.href = "/admin/login";
                  }}
                  className="flex items-center justify-center w-full py-3 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                >
                  {Icons.logout}
                </button>
              </Tooltip>
            </>
          ) : (
            <>
              <Link
                href="/"
                onClick={onMobileClose}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
              >
                <span className="text-gray-400">{Icons.home}</span>
                Beranda
              </Link>
              <button
                onClick={() => {
                  document.cookie = "session=; path=/; max-age=0";
                  window.location.href = "/admin/login";
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-all w-full"
              >
                {Icons.logout}
                Logout
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}