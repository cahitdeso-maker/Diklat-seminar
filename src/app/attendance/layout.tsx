"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<{ role: string; name: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    // Check session from cookie
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("session="));
    if (cookie) {
      try {
        const value = decodeURIComponent(cookie.split("=")[1]);
        const data = JSON.parse(Buffer.from(value, "base64").toString());
        setSession(data);
      } catch {
        // Invalid session
      }
    }
  }, []);

  useEffect(() => {
    if (mounted && !session) {
      router.push("/attendance/login");
    }
  }, [mounted, session, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const navItems = [
    { href: "/attendance", label: "Dashboard", icon: HomeIcon },
    { href: "/attendance/history", label: "Riwayat", icon: HistoryIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/attendance" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-slate-800">Presensi Petugas</span>
              </Link>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    pathname === item.href
                      ? "bg-green-50 text-green-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <item.icon className="w-4 h-4 inline-block mr-1" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-slate-600">
                {session.name}
              </span>
              <span
                className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700"
              >
                {session.role === "admin" ? "Admin" : "Petugas"}
              </span>
              <button
                onClick={() => {
                  document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                  router.push("/attendance/login");
                }}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}