import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { hashPassword } from "@/lib/utils";
import { signupSchema } from "@/lib/validations";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
    // 10 signup attempts per IP per hour
    if (!await checkRateLimit(`signup:${getClientIp(req)}`, 10, 60 * 60 * 1000)) {
        return rateLimitResponse(3600);
    }

    try {
        const body = await req.json();
        const parsed = signupSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json(
                { success: false, error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const { name, email, password, collegeId } = parsed.data;

        await connectDB();

        // ── Check for existing account ─────────────────────────────────────────
        const existing = await User.findOne({ email });
        if (existing) {
            // Return the same message regardless of auth provider to prevent enumeration.
            return Response.json(
                { success: false, error: "An account with this email already exists." },
                { status: 409 }
            );
        }

        // ── Create student account ─────────────────────────────────────────────
        const passwordHash = await hashPassword(password);

        await User.create({
            name,
            email,
            passwordHash,
            role: "student",
            collegeId: collegeId ?? undefined,
            departments: [],
            registeredEvents: [],
        });

        return Response.json(
            { success: true, message: "Account created. You can now sign in." },
            { status: 201 }
        );
    } catch (err: any) {
        console.error("[auth/signup]", err);
        return Response.json(
            { success: false, error: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}