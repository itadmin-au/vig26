// app/api/auth/invite/accept/route.ts
import { connectDB } from "@/lib/db";
import { User, Invite, Department } from "@/models";
import { hashPassword, isExpired } from "@/lib/utils";
import { acceptInviteSchema } from "@/lib/validations";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
    // 5 invite-accept attempts per IP per 15 minutes
    if (!checkRateLimit(`invite-accept:${getClientIp(req)}`, 5, 15 * 60 * 1000)) {
        return rateLimitResponse(900);
    }

    try {
        const body = await req.json();

        await connectDB();

        const invite = await Invite.findOne({ token: body.token, status: "pending" });

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

        const existing = await User.findOne({ email: invite.email });

        if (existing || body.skipPassword === true) {
            if (!existing) {
                return Response.json(
                    { success: false, error: "User account not found." },
                    { status: 400 }
                );
            }

            await Invite.findByIdAndUpdate(invite._id, { status: "accepted" });

            const alreadyMember = await Department.findOne({
                _id: invite.departmentId,
                "members.userId": existing._id,
            }).lean();

            if (alreadyMember) {
                await Department.findOneAndUpdate(
                    { _id: invite.departmentId, "members.userId": existing._id },
                    { $set: { "members.$.role": invite.role } }
                );
            } else {
                await Department.findByIdAndUpdate(invite.departmentId, {
                    $addToSet: { members: { userId: existing._id, role: invite.role } },
                });
            }

            await User.findByIdAndUpdate(existing._id, {
                $addToSet: { departments: invite.departmentId },
                ...(invite.role === "dept_admin" || existing.role === "student"
                    ? { role: invite.role }
                    : {}),
            });

            return Response.json({ success: true, message: "Account linked to department." });
        }

        const parsed = acceptInviteSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json(
                { success: false, error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const passwordHash = await hashPassword(parsed.data.password);

        const user = await User.create({
            name: invite.name,
            email: invite.email,
            passwordHash,
            role: invite.role,
            departments: [invite.departmentId],
            registeredEvents: [],
        });

        await Department.findByIdAndUpdate(invite.departmentId, {
            $push: { members: { userId: user._id, role: invite.role } },
        });

        await Invite.findByIdAndUpdate(invite._id, { status: "accepted" });

        return Response.json(
            { success: true, message: "Account created. You can now sign in." },
            { status: 201 }
        );
    } catch (err: any) {
        console.error("[invite/accept]", err);
        return Response.json(
            { success: false, error: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}