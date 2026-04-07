import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, collegeId } = await req.json();

    if (name !== undefined) {
        if (!name || typeof name !== "string" || name.trim().length < 2) {
            return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
        }
    }

    if (collegeId !== undefined) {
        if (!collegeId || typeof collegeId !== "string" || collegeId.trim().length < 1) {
            return NextResponse.json({ error: "USN is required." }, { status: 400 });
        }
    }

    const update: Record<string, string> = {};
    if (name !== undefined) update.name = name.trim();
    if (collegeId !== undefined) update.collegeId = collegeId.trim().toUpperCase();

    await connectDB();
    const updated = await User.findByIdAndUpdate(session.user.id, update, { new: true }).select("name collegeId");

    return NextResponse.json({ success: true, name: updated?.name, collegeId: updated?.collegeId });
}
