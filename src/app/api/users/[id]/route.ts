import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hashSync(password, 10);
}

// GET /api/users/[id] - Get single user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan" },
        { status: 404 }
      );
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Gagal memuat data pengguna" },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      role,
      fullName,
      email,
      password,
      phoneNumber,
      institutionName,
      isActive,
    } = body;

    // Check if user exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan" },
        { status: 404 }
      );
    }

    // Check if email is being changed and already exists
    if (email && email !== existing.email) {
      const [emailExists] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (emailExists) {
        return NextResponse.json(
          { error: "Email sudah terdaftar" },
          { status: 400 }
        );
      }
    }

    const updateData: any = {
      role: role || existing.role,
      fullName: fullName || existing.fullName,
      email: email || existing.email,
      phoneNumber: phoneNumber !== undefined ? phoneNumber : existing.phoneNumber,
      institutionName: institutionName !== undefined ? institutionName : existing.institutionName,
      isActive: isActive !== undefined ? (isActive ? 1 : 0) : existing.isActive,
    };

    // Hash password if provided
    if (password && password.trim()) {
      updateData.password = await hashPassword(password);
    }

    await db.update(users).set(updateData).where(eq(users.id, id));

    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updated;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Gagal mengupdate pengguna" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Soft delete user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan" },
        { status: 404 }
      );
    }

    // Soft delete
    await db.update(users).set({ isDeleted: true }).where(eq(users.id, id));

    return NextResponse.json({ message: "Pengguna berhasil dihapus" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus pengguna" },
      { status: 500 }
    );
  }
}