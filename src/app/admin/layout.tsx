"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";

// ──────────────────────────────────────────
// Admin Layout
// ──────────────────────────────────────────
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") {
      setCollapsed(true);
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  // Handle login page separately
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <div className="min-h-screen flex bg-gray-50">
        <Sidebar
          collapsed={mounted ? collapsed : false}
          onToggleCollapse={toggleCollapse}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen((prev) => !prev)}
        />

        {/* Main content */}
        <div
          className={`
            flex-1 flex flex-col min-h-screen
            transition-all duration-300 ease-in-out
            ${mounted && collapsed ? "lg:ml-[72px]" : "lg:ml-64"}
          `}
        >
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}