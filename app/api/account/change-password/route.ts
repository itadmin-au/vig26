import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { verifyPassword, hashPassword } from "@/lib/utils";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }
    if (newPassword.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(session.user.id).select("+passwordHash");
    if (!user || !user.passwordHash) {
        return NextResponse.json({ error: "No password set on this account." }, { status: 400 });
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const hash = await hashPassword(newPassword);
    await User.findByIdAndUpdate(session.user.id, { passwordHash: hash });

    return NextResponse.json({ success: true });
}
