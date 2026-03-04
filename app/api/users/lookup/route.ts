// app/api/users/lookup/route.ts
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { requireManagement } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
    try {
        await requireManagement();

        const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return Response.json({ exists: false });
        }

        await connectDB();

        const user = await User.findOne({ email }).select("name email role").lean();

        if (!user) {
            return Response.json({ exists: false });
        }

        return Response.json({
            exists: true,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch {
        return Response.json({ exists: false });
    }
}