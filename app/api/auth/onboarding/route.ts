import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { z } from "zod";

const onboardingSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    collegeId: z.string().trim().min(1, "USN is required"),
});

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = onboardingSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json(
                { success: false, error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const { name, collegeId } = parsed.data;

        await connectDB();

        await User.findByIdAndUpdate(session.user.id, { name, collegeId });

        return Response.json({ success: true });
    } catch (err) {
        console.error("[auth/onboarding]", err);
        return Response.json(
            { success: false, error: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}
