"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      // Check for session cookie
      const cookies = document.cookie.split(";");
      const sessionCookie = cookies.find((cookie) =>
        cookie.trim().startsWith("auth_session=")
      );

      if (sessionCookie) {
        try {
          const sessionValue = sessionCookie.split("=")[1];
          const sessionData = JSON.parse(
            atob(decodeURIComponent(sessionValue))
          );
          if (sessionData.userId) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        } catch {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [pathname]);

  // Redirect to login if not authenticated (after auth check completes)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/admin/login") {
      router.push("/admin/login");
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // Don't render children on login page or while loading/not authenticated
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Don't render children if not authenticated (redirecting)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
