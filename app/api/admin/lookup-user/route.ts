// app/api/admin/lookup-user/route.ts
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { requireSuperAdmin, forbiddenResponse, unauthorizedResponse } from "@/lib/auth-helpers";

export async function GET(req: Request) {
    try {
        await requireSuperAdmin();
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        return forbiddenResponse();
    }

    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get("email")?.trim().toLowerCase();

        if (!email) {
            return Response.json({ success: false, error: "Missing email." }, { status: 400 });
        }

        await connectDB();

        const user = await User.findOne({ email }).select("_id name email collegeId role").lean();

        if (!user) {
            return Response.json({ success: false, error: `No account found for ${email}.` }, { status: 404 });
        }

        return Response.json({ success: true, data: user });
    } catch (err: any) {
        console.error("[admin/lookup-user]", err);
        return Response.json({ success: false, error: "Internal server error." }, { status: 500 });
    }
}
