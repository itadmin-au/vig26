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

    const { name } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
    }

    await connectDB();
    await User.findByIdAndUpdate(session.user.id, { name: name.trim() });

    return NextResponse.json({ success: true, name: name.trim() });
}
