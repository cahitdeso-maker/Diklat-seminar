import type { NextRequest } from "next/server";

export function getSession(request: NextRequest) {
  const sessionCookie = request.cookies.get("session");
  if (!sessionCookie) return null;
  try {
    return JSON.parse(Buffer.from(sessionCookie.value, "base64").toString());
  } catch {
    return null;
  }
}