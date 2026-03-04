// app/api/auth/invite/check/route.ts
import { connectDB } from "@/lib/db";
import { User, Invite, Department } from "@/models";
import { isExpired } from "@/lib/utils";

export async function POST(req: Request) {
    try {
        const { token } = await req.json();

        if (!token) {
            return Response.json({ success: false, error: "Token is required." }, { status: 400 });
        }

        await connectDB();

        const invite = await Invite.findOne({ token, status: "pending" });

        if (!invite) {
            return Response.json(
                { success: false, error: "Invalid or already used invite link." },
                { status: 400 }
            );
        }

        if (isExpired(invite.expiresAt)) {
            return Response.json(
                { success: false, error: "This invite link has expired. Ask your admin to resend." },
                { status: 400 }
            );
        }

        const existingUser = await User.findOne({ email: invite.email }).select("_id").lean();
        const department = await Department.findById(invite.departmentId).select("name").lean();

        return Response.json({
            success: true,
            userExists: !!existingUser,
            name: invite.name,
            department: department?.name ?? null,
        });
    } catch (err) {
        console.error("[invite/check]", err);
        return Response.json(
            { success: false, error: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}