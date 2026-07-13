import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq, and, or, like, desc } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hashSync(password, 10);
}

// GET /api/users - Get all users with optional search and filters
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const role = url.searchParams.get("role") || "";
    const isActive = url.searchParams.get("isActive");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    let whereConditions = [eq(users.isDeleted, false)];

    if (search) {
      whereConditions.push(
        or(
          like(users.fullName, `%${search}%`),
          like(users.email, `%${search}%`),
          like(users.role, `%${search}%`),
          like(users.institutionName, `%${search}%`)
        )!
      );
    }

    if (role) {
      whereConditions.push(eq(users.role, role));
    }

    if (isActive !== null && isActive !== "") {
      whereConditions.push(eq(users.isActive, isActive === "true"));
    }

    const data = await db
      .select()
      .from(users)
      .where(and(...whereConditions))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: users.id })
      .from(users)
      .where(and(...whereConditions));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: total.length,
        totalPages: Math.ceil(total.length / limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "Gagal memuat data pengguna" },
      { status: 500 },
    );
  }
}

// POST /api/users - Create new user
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      role,
      fullName,
      email,
      password,
      schoolOrigin,
      age,
      address,
      placeOfBirth,
      dateOfBirth,
      phoneNumber,
      homeAddress,
      institutionName,
      studyProgram,
      semester,
      practiceStartDate,
      practiceEndDate,
      practiceDurationWeeks,
      stase,
      staseLainnya,
      diplomaFile,
      isActive,
    } = body;

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Nama lengkap, email, dan password harus diisi" },
        { status: 400 },
      );
    }

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);

    // Use type assertion to bypass TypeScript inference issues
    const insertData = {
      id,
      role: role || "mahasiswa",
      fullName,
      email,
      password: hashedPassword,
      schoolOrigin: schoolOrigin || null,
      age: age || null,
      address: address || null,
      placeOfBirth: placeOfBirth || null,
      dateOfBirth: dateOfBirth || null,
      phoneNumber: phoneNumber || null,
      homeAddress: homeAddress || null,
      institutionName: institutionName || null,
      studyProgram: studyProgram || null,
      semester: semester || null,
      practiceStartDate: practiceStartDate || null,
      practiceEndDate: practiceEndDate || null,
      practiceDurationWeeks: practiceDurationWeeks || null,
      stase: stase || null,
      staseLainnya: staseLainnya || null,
      diplomaFile: diplomaFile || null,
      isActive: isActive !== undefined ? (isActive ? 1 : 0) : 1,
      isDeleted: 0,
    } as unknown as typeof users.$inferInsert;

    await db.insert(users).values(insertData);

    const [created] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = created;

    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Gagal menambah pengguna" },
      { status: 500 },
    );
  }
}