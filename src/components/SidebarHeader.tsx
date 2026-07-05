"use client";

import React from "react";

type SidebarHeaderProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export default function SidebarHeader({ collapsed, onToggleCollapse }: SidebarHeaderProps) {
  return (
    <div
      className={`flex items-center border-b border-gray-200 h-16 ${
        collapsed ? "justify-center px-0" : "px-5 justify-between"
      }`}
    >
      {!collapsed && (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
            RS
          </div>
          <div className="truncate">
            <h2 className="font-bold text-sm text-gray-800 truncate">Diklat RS</h2>
            <p className="text-[10px] text-gray-400 truncate">Presensi Seminar</p>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
          RS
        </div>
      )}
      {/* Collapse toggle - desktop only */}
      <button
        onClick={onToggleCollapse}
        className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"}
          />
        </svg>
      </button>
    </div>
  );
}