import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
    try {
        await requireAuth();

        const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return Response.json({ exists: false });
        }

        await connectDB();

        const user = await User.findOne({ email }).select("name email collegeId").lean();

        if (!user) {
            return Response.json({ exists: false });
        }

        return Response.json({
            exists: true,
            user: { name: user.name, email: user.email, usn: user.collegeId ?? "" },
        });
    } catch {
        return Response.json({ exists: false });
    }
}
