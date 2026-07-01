import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const SESSION_COOKIE = "session";

export interface SessionData {
  userId: string;
  role: "admin" | "mahasiswa";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hashSync(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

export async function createSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const sessionData = Buffer.from(JSON.stringify(data)).toString("base64");
  cookieStore.set(SESSION_COOKIE, sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const data = JSON.parse(
      Buffer.from(sessionCookie, "base64").toString("utf-8"),
    );
    return data as SessionData;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionData> {
  const session = await requireAuth();
  if (session.role !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
}
