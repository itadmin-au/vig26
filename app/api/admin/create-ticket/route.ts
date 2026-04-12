// app/api/admin/create-ticket/route.ts
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Event, Registration, Ticket, User } from "@/models";
import { requireSuperAdmin, forbiddenResponse, unauthorizedResponse } from "@/lib/auth-helpers";
import { sendTicketConfirmationEmail, sendTeamMemberInviteEmail } from "@/lib/email";
import { generateQRToken, generateTeamId, formatEventDate, serialize } from "@/lib/utils";

export async function POST(req: Request) {
    try {
        await requireSuperAdmin();
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        return forbiddenResponse();
    }

    try {
        const { eventId, userId, formResponses = [], teamMembers = [] } = await req.json();

        if (!eventId || !userId) {
            return Response.json(
                { success: false, error: "eventId and userId are required." },
                { status: 400 }
            );
        }

        await connectDB();

        const [event, user] = await Promise.all([
            Event.findById(eventId),
            User.findById(userId),
        ]);

        if (!event) return Response.json({ success: false, error: "Event not found." }, { status: 404 });
        if (!user) return Response.json({ success: false, error: "User not found." }, { status: 404 });

        // Check for existing registration
        const existingReg = await Registration.findOne({ eventId, userId });

        if (existingReg?.status === "confirmed") {
            return Response.json(
                { success: false, error: "This user already has a confirmed registration for this event." },
                { status: 409 }
            );
        }

        const isTeam = event.isTeamEvent && teamMembers.length > 0;
        const teamId = isTeam ? generateTeamId() : undefined;
        const leaderQR = generateQRToken();
        const manualPaymentId = `manual_admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const eventDate = formatEventDate(event.date.start, event.date.end);

        let registration: any;
        let ticketCount = 1;
        const emailTasks: Array<() => Promise<void>> = [];

        const dbSession = await mongoose.startSession();
        try {
            await dbSession.withTransaction(async () => {
                emailTasks.length = 0;
                ticketCount = 1;

                if (existingReg) {
                    // Upgrade the existing pending/failed registration in-place
                    existingReg.formResponses = formResponses;
                    existingReg.isTeamRegistration = isTeam;
                    existingReg.teamMembers = isTeam ? teamMembers : [];
                    existingReg.teamId = teamId ?? undefined;
                    existingReg.paymentId = manualPaymentId;
                    existingReg.paymentStatus = "completed";
                    existingReg.status = "confirmed";
                    await existingReg.save({ session: dbSession });
                    registration = existingReg;
                } else {
                    const [reg] = await Registration.create(
                        [{
                            eventId,
                            userId,
                            formResponses,
                            isTeamRegistration: isTeam,
                            teamMembers: isTeam ? teamMembers : [],
                            teamId,
                            paymentId: manualPaymentId,
                            paymentStatus: "completed",
                            status: "confirmed",
                        }],
                        { session: dbSession }
                    );
                    registration = reg;
                }

                // Delete any stale tickets from a previous failed attempt
                await Ticket.deleteMany({ registrationId: registration._id }, { session: dbSession });

                await Ticket.create(
                    [{
                        registrationId: registration._id,
                        eventId,
                        userId,
                        qrCode: leaderQR,
                        teamRole: isTeam ? "leader" : "solo",
                        teamId,
                        attendanceStatus: false,
                    }],
                    { session: dbSession }
                );

                emailTasks.push(() =>
                    sendTicketConfirmationEmail({
                        to: user.email,
                        name: user.name,
                        eventTitle: event.title,
                        eventDate,
                        venue: event.venue ?? undefined,
                        ticketId: leaderQR,
                    })
                );

                await User.findByIdAndUpdate(
                    userId,
                    { $addToSet: { registeredEvents: registration._id } },
                    { session: dbSession }
                );

                // Team members
                for (const member of (isTeam ? teamMembers : [])) {
                    const memberUser = await User.findOne({ email: member.email }).session(dbSession);
                    const memberQR = generateQRToken();

                    await Ticket.create(
                        [{
                            registrationId: registration._id,
                            eventId,
                            userId: memberUser ? memberUser._id : undefined,
                            qrCode: memberQR,
                            teamRole: "member",
                            teamId,
                            attendanceStatus: false,
                        }],
                        { session: dbSession }
                    );

                    ticketCount++;

                    if (memberUser) {
                        emailTasks.push(() =>
                            sendTicketConfirmationEmail({
                                to: memberUser.email,
                                name: memberUser.name,
                                eventTitle: event.title,
                                eventDate,
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
                                leaderName: user.name,
                                eventTitle: event.title,
                            })
                        );
                    }
                }
            });
        } finally {
            dbSession.endSession();
        }

        await Promise.allSettled(emailTasks.map((fn) => fn()));

        return Response.json({
            success: true,
            data: {
                registrationId: registration._id.toString(),
                manualPaymentId,
                eventTitle: event.title,
                ticketCount,
                recipientEmail: user.email,
            },
        }, { status: 201 });
    } catch (err: any) {
        console.error("[admin/create-ticket]", err);
        return Response.json({ success: false, error: "Internal server error." }, { status: 500 });
    }
}
