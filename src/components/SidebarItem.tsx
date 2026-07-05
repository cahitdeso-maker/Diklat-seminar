"use client";

import React from "react";
import Link from "next/link";
import type { MenuItem } from "@/config/sidebar";

// ──────────────────────────────────────────
// Tooltip component (for collapsed mode)
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
// Props
// ──────────────────────────────────────────
type SidebarItemProps = {
  item: MenuItem;
  isActive: boolean;
  collapsed: boolean;
  onClose?: () => void;
};

// ──────────────────────────────────────────
// SidebarItem component
// ──────────────────────────────────────────
export default function SidebarItem({ item, isActive, collapsed, onClose }: SidebarItemProps) {
  const linkContent = (
    <Link
      href={item.href}
      onClick={onClose}
      className={`
        flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200
        ${collapsed ? "justify-center w-full px-0 py-3" : "px-4 py-2.5"}
        ${
          isActive
            ? "bg-blue-50 text-blue-600 shadow-sm"
            : "text-gray-600 hover:bg-gray-50"
        }
      `}
    >
      <span className={`shrink-0 ${isActive ? "text-blue-600" : "text-gray-400"}`}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.title}</span>}
    </Link>
  );

  if (collapsed) {
    return <Tooltip text={item.title}>{linkContent}</Tooltip>;
  }

  return linkContent;
}