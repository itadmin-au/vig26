// app/api/payment/verify/route.ts
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Event, Registration, Ticket, User, Category } from "@/models";
import { getCashfreeOrder } from "@/lib/cashfree";
import { getHdfcOrderStatus, isHdfcPaid } from "@/lib/hdfc";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
    generateQRToken,
    generateTeamId,
    serialize,
    formatEventDate,
} from "@/lib/utils";
import {
    sendTicketConfirmationEmail,
    sendTeamMemberInviteEmail,
} from "@/lib/email";
import { createRegistrationSchema } from "@/lib/validations";

export async function POST(req: Request) {
    // 30 verify attempts per IP per 10 minutes
    if (!await checkRateLimit(`verify:${getClientIp(req)}`, 30, 10 * 60 * 1000)) {
        return rateLimitResponse(60);
    }

    try {
        const session = await requireAuth();

        const body = await req.json();
        const {
            orderId,
            eventId,
            provider = "cashfree",
            leaderUsn,
            teamMembers = [],
            formResponses = [],
        } = body;

        // ── 1. Validate required payment fields ────────────────────────────────
        if (!orderId || typeof orderId !== "string") {
            return Response.json(
                { success: false, error: "Missing payment order ID." },
                { status: 400 }
            );
        }

        // ── 2. Verify payment with the appropriate provider ────────────────────
        let paidAmountFromProvider: number;

        if (provider === "hdfc") {
            const hdfcOrder = await getHdfcOrderStatus(orderId);
            if (!isHdfcPaid(hdfcOrder.status)) {
                console.error("[payment/verify] HDFC order not paid:", hdfcOrder.status);
                return Response.json(
                    { success: false, error: "Payment not completed. Please try again." },
                    { status: 400 }
                );
            }
            paidAmountFromProvider = hdfcOrder.amount;
        } else {
            const cfOrder = await getCashfreeOrder(orderId) as any;
            if (cfOrder.order_status !== "PAID") {
                console.error("[payment/verify] Cashfree order not paid:", cfOrder.order_status);
                return Response.json(
                    { success: false, error: "Payment not completed. Please try again." },
                    { status: 400 }
                );
            }
            paidAmountFromProvider = cfOrder.order_amount ?? 0;
        }

        // ── 2a. Idempotency: return early if this order was already processed ──
        await connectDB();
        const alreadyProcessed = await Registration.findOne({
            paymentId: orderId,
            paymentStatus: "completed",
        });
        if (alreadyProcessed) {
            return Response.json(
                {
                    success: true,
                    data: { registration: alreadyProcessed.toObject(), ticketCount: 1 },
                },
            );
        }

        // ── 3. Validate registration input schema ──────────────────────────────
        const parsed = createRegistrationSchema.safeParse({
            eventId,
            teamMembers,
            formResponses,
        });

        if (!parsed.success) {
            return Response.json(
                { success: false, error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        // ── 4. Re-validate event (capacity may have changed during checkout) ───
        const event = await Event.findById(parsed.data.eventId);

        if (!event) {
            return Response.json(
                { success: false, error: "Event not found." },
                { status: 404 }
            );
        }

        // ── 4a. Verify paid amount matches event price (prevent underpayment) ─
        const paidAmount: number = paidAmountFromProvider;
        const memberCount = (event as any).pricePerPerson && event.isTeamEvent
            ? parsed.data.teamMembers.length + 1  // teamMembers = other members; +1 for the leader
            : 1;
        const expectedAmount = event.price * memberCount;
        if (paidAmount < expectedAmount) {
            console.error(
                `[payment/verify] Underpayment: paid ${paidAmount}, expected ${expectedAmount} for order ${orderId}`
            );
            return Response.json(
                { success: false, error: "Payment amount mismatch. Please contact support." },
                { status: 400 }
            );
        }

        // Validate required custom form fields server-side
        for (const field of (event.customForm ?? []) as any[]) {
            if (!field.isRequired) continue;
            const response = (parsed.data.formResponses as any[]).find((r) => r.fieldId === field._id.toString());
            const val = response?.value;
            const empty = val === undefined || val === null || (typeof val === "string" && val.trim() === "") || (Array.isArray(val) && val.length === 0);
            if (empty) {
                return Response.json(
                    { success: false, error: `"${field.label}" is required.` },
                    { status: 400 }
                );
            }
        }

        if (event.status !== "published") {
            return Response.json(
                { success: false, error: "This event is no longer accepting registrations." },
                { status: 400 }
            );
        }

        if (event.registrationsClosed) {
            return Response.json(
                { success: false, error: "Registrations for this event are closed." },
                { status: 400 }
            );
        }

        if (event.capacity > 0 && event.registrationCount >= event.capacity) {
            return Response.json(
                {
                    success: false,
                    error: "Unfortunately this event is now fully booked. Please contact the organiser for a refund.",
                },
                { status: 400 }
            );
        }

        // ── 5. Guard against duplicate registration ────────────────────────────
        const existingReg = await Registration.findOne({
            eventId: parsed.data.eventId,
            userId: session.user.id,
        });

        if (existingReg) {
            return Response.json(
                { success: false, error: "You are already registered for this event." },
                { status: 400 }
            );
        }

        // ── 6 & 7. Create Registration, Tickets, and User updates in one transaction ─
        const isTeam =
            event.isTeamEvent && parsed.data.teamMembers.length > 0;
        const teamId = isTeam ? generateTeamId() : undefined;
        const leaderQR = generateQRToken();

        let registration: any;
        let ticketCount = 1;
        // Collect email tasks to fire after commit — external side effects must stay outside the transaction
        const emailTasks: Array<() => Promise<void>> = [];

        const dbSession = await mongoose.startSession();
        try {
            await dbSession.withTransaction(async () => {
                // Reset mutable state on each attempt (withTransaction may retry on transient errors)
                emailTasks.length = 0;
                ticketCount = 1;

                if (leaderUsn?.trim()) {
                    await User.findByIdAndUpdate(session.user.id, { collegeId: leaderUsn.trim() }, { session: dbSession });
                }

                const createdRegs = await Registration.create(
                    [
                        {
                            eventId: parsed.data.eventId,
                            userId: session.user.id,
                            formResponses: parsed.data.formResponses,
                            isTeamRegistration: isTeam,
                            teamMembers: isTeam ? parsed.data.teamMembers : [],
                            teamId,
                            paymentId: orderId,
                            amountPaid: paidAmountFromProvider,
                            paymentStatus: "completed",
                            status: "confirmed",
                        },
                    ],
                    { session: dbSession }
                );
                registration = createdRegs[0];

                // Increment registrationCount inside the transaction so retries don't over-count
                await Event.findByIdAndUpdate(
                    parsed.data.eventId,
                    { $inc: { registrationCount: 1 } },
                    { session: dbSession }
                );

                await Ticket.create(
                    [
                        {
                            registrationId: registration._id,
                            eventId: parsed.data.eventId,
                            userId: session.user.id,
                            qrCode: leaderQR,
                            teamRole: isTeam ? "leader" : "solo",
                            teamId,
                            attendanceStatus: false,
                        },
                    ],
                    { session: dbSession }
                );

                const leaderUser = await User.findById(session.user.id).session(dbSession);
                if (leaderUser) {
                    emailTasks.push(() =>
                        sendTicketConfirmationEmail({
                            to: leaderUser.email,
                            name: leaderUser.name,
                            eventTitle: event.title,
                            eventDate: formatEventDate(event.date.start, event.date.end),
                            venue: event.venue ?? undefined,
                            ticketId: leaderQR,
                        })
                    );
                    await User.findByIdAndUpdate(
                        session.user.id,
                        { $addToSet: { registeredEvents: registration._id } },
                        { session: dbSession }
                    );
                }

                // ── Team members ───────────────────────────────────────────────
                if (isTeam) {
                    for (const member of parsed.data.teamMembers) {
                        const memberUser = await User.findOne({ email: member.email }).session(dbSession);
                        const memberQR = generateQRToken();

                        await Ticket.create(
                            [
                                {
                                    registrationId: registration._id,
                                    eventId: parsed.data.eventId,
                                    ...(memberUser ? { userId: memberUser._id } : {}),
                                    qrCode: memberQR,
                                    teamRole: "member",
                                    teamId,
                                    attendanceStatus: false,
                                },
                            ],
                            { session: dbSession }
                        );

                        ticketCount++;

                        if (memberUser) {
                            emailTasks.push(() =>
                                sendTicketConfirmationEmail({
                                    to: memberUser.email,
                                    name: memberUser.name,
                                    eventTitle: event.title,
                                    eventDate: formatEventDate(event.date.start, event.date.end),
                                    venue: event.venue ?? undefined,
                                    ticketId: memberQR,
                                })
                            );
                            await User.findByIdAndUpdate(
                                memberUser._id,
                                { $addToSet: { registeredEvents: registration._id } },
                                { session: dbSession }
                            );
                        } else {
                            emailTasks.push(() =>
                                sendTeamMemberInviteEmail({
                                    to: member.email,
                                    memberName: member.name,
                                    leaderName: session.user.name ?? "Your team leader",
                                    eventTitle: event.title,
                                    eventDate: formatEventDate(event.date.start, event.date.end),
                                    venue: event.venue ?? undefined,
                                    ticketId: memberQR,
                                })
                            );
                        }
                    }
                }
            });
        } catch (txErr: any) {
            // Duplicate key on paymentId — a concurrent request already committed this order.
            if (txErr.code === 11000) {
                const existing = await Registration.findOne({ paymentId: orderId });
                if (existing) {
                    return Response.json({
                        success: true,
                        data: { registration: serialize(existing.toObject()), ticketCount: 1 },
                    });
                }
            }
            throw txErr;
        } finally {
            dbSession.endSession();
        }

        // Send emails after successful commit — failures are non-fatal
        await Promise.allSettled(emailTasks.map((fn) => fn()));

        // Sync to Google Sheets — non-fatal
        if ((event as any).googleSheetId && (event as any).sheetTabName) {
            try {
                const cat = await Category.findOne({ slug: (event as any).category }).lean();
                const tokenHolder = (cat as any)?.sheetOwner ?? (event as any).createdBy;
                const sheetUser = tokenHolder
                    ? await User.findById(tokenHolder).select("+googleSheetsRefreshToken").lean()
                    : null;
                const refreshToken = (sheetUser as any)?.googleSheetsRefreshToken as string | undefined;

                const populatedReg = await Registration.findById(registration._id)
                    .populate("userId", "name email collegeId")
                    .populate("teamMembers.userId", "name email collegeId")
                    .lean();

                const { appendRegistrationRow, syncCategoryEventsSheet } = await import("@/lib/sheets");
                await Promise.race([
                    appendRegistrationRow(
                        (event as any).googleSheetId,
                        (event as any).sheetTabName,
                        event as any,
                        populatedReg,
                        refreshToken
                    ),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("Sheet sync timeout")), 8000)
                    ),
                ]);

                // Update Events Overview with new registration count
                const allCatEvents = await Event.find({ category: (event as any).category })
                    .populate("department", "name").lean();
                await syncCategoryEventsSheet(
                    (event as any).googleSheetId,
                    allCatEvents,
                    refreshToken
                ).catch((e: any) => console.error("[payment/verify] Overview sync failed:", e?.message));
            } catch (sheetErr: any) {
                console.error("[payment/verify] Sheet sync failed (non-fatal):", sheetErr?.message);
            }
        }

        return Response.json(
            {
                success: true,
                data: {
                    registration: serialize(registration),
                    ticketCount,
                },
            },
            { status: 201 }
        );
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") {
            return unauthorizedResponse();
        }
        console.error("[payment/verify]", err);
        return Response.json(
            {
                success: false,
                error: "Something went wrong confirming your payment. Please contact support with your order ID.",
            },
            { status: 500 }
        );
    }
}
