// actions/registrations.ts
"use server";

import { connectDB } from "@/lib/db";
import { Event, Registration, Ticket, User } from "@/models";
import { requireAuth, requireManagement, requireDepartmentAccess } from "@/lib/auth-helpers";
import { createRegistrationSchema } from "@/lib/validations";
import { generateQRToken, generateTeamId } from "@/lib/utils";
import { sendTicketConfirmationEmail, sendTeamMemberInviteEmail } from "@/lib/email";
import { serialize, formatEventDate } from "@/lib/utils";
import type { IRegistration, ITicket } from "@/types";

export async function createRegistration(input: unknown) {
    const session = await requireAuth();
    await connectDB();

    const parsed = createRegistrationSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { eventId, slotId, teamMembers, formResponses } = parsed.data;

    const event = await Event.findById(eventId);
    if (!event) return { success: false, error: "Event not found." };
    if (event.status !== "published") return { success: false, error: "This event is not open for registration." };
    if (event.registrationsClosed) return { success: false, error: "Registrations for this event are closed." };

    // ── Slot validation ───────────────────────────────────────────────────────
    const hasSlots = (event.slots as any[]).length > 0;
    let chosenSlot: any = null;
    if (hasSlots) {
        if (!slotId) return { success: false, error: "Please select a time slot to register." };
        chosenSlot = (event.slots as any[]).find((s: any) => s._id.toString() === slotId);
        if (!chosenSlot) return { success: false, error: "The selected slot is not valid." };
        if (chosenSlot.capacity > 0 && chosenSlot.registrationCount >= chosenSlot.capacity) {
            return { success: false, error: "This time slot is fully booked. Please choose another slot." };
        }
    } else {
        // Use event-level capacity when no slots
        if (event.capacity > 0 && event.registrationCount >= event.capacity) {
            return { success: false, error: "This event is fully booked." };
        }
    }

    const existingReg = await Registration.findOne({ eventId, userId: session.user.id });
    if (existingReg) return { success: false, error: "You are already registered for this event." };

    const isTeam = event.isTeamEvent && teamMembers.length > 0;
    const teamId = isTeam ? generateTeamId() : undefined;

    const registration = await Registration.create({
        eventId,
        userId: session.user.id,
        formResponses,
        isTeamRegistration: isTeam,
        teamMembers: isTeam ? teamMembers : [],
        teamId,
        slotId: slotId ?? undefined,
        paymentStatus: event.price === 0 ? "na" : "pending",
        status: event.price === 0 ? "confirmed" : "pending",
    });

    // Increment registrationCount for free events (paid events increment inside the payment transaction)
    if (event.price === 0) {
        await Event.findByIdAndUpdate(eventId, { $inc: { registrationCount: 1 } });
        if (slotId) {
            await Event.findByIdAndUpdate(
                eventId,
                { $inc: { "slots.$[slot].registrationCount": 1 } },
                { arrayFilters: [{ "slot._id": slotId }] }
            );
        }
    }

    const tickets: ITicket[] = [];

    // ── Leader / solo ticket ──────────────────────────────────────────────────
    const leaderQR = generateQRToken();

    const leaderTicket = await Ticket.create({
        registrationId: registration._id,
        eventId,
        userId: session.user.id,
        qrCode: leaderQR,
        teamRole: isTeam ? "leader" : "solo",
        teamId,
        attendanceStatus: false,
    });
    tickets.push(leaderTicket);

    const leaderUser = await User.findById(session.user.id);
    if (leaderUser) {
        try {
            const emailDate = chosenSlot
                ? formatEventDate(chosenSlot.start, chosenSlot.end)
                : formatEventDate(event.date.start, event.date.end);
            await sendTicketConfirmationEmail({
                to: leaderUser.email,
                name: leaderUser.name,
                eventTitle: event.title,
                eventDate: emailDate,
                venue: event.venue ?? undefined,
                ticketId: leaderQR,
            });
        } catch (err: any) {
            console.error("[createRegistration] leader ticket email failed:", err?.message);
        }

        await User.findByIdAndUpdate(session.user.id, {
            $addToSet: { registeredEvents: registration._id },
        });
    }

    // ── Team members ──────────────────────────────────────────────────────────
    if (isTeam) {
        for (const member of teamMembers) {
            const memberUser = await User.findOne({ email: member.email });
            const memberQR = generateQRToken();

            const memberTicket = await Ticket.create({
                registrationId: registration._id,
                eventId,
                userId: memberUser?._id ?? undefined,
                qrCode: memberQR,
                teamRole: "member",
                teamId,
                attendanceStatus: false,
            });
            tickets.push(memberTicket);

            if (memberUser) {
                try {
                    const memberEmailDate = chosenSlot
                        ? formatEventDate(chosenSlot.start, chosenSlot.end)
                        : formatEventDate(event.date.start, event.date.end);
                    await sendTicketConfirmationEmail({
                        to: memberUser.email,
                        name: memberUser.name,
                        eventTitle: event.title,
                        eventDate: memberEmailDate,
                        venue: event.venue ?? undefined,
                        ticketId: memberQR,
                    });
                } catch (err: any) {
                    console.error("[createRegistration] member ticket email failed:", member.email, err?.message);
                }
                await User.findByIdAndUpdate(memberUser._id, {
                    $addToSet: { registeredEvents: registration._id },
                });
            } else {
                try {
                    await sendTeamMemberInviteEmail({
                        to: member.email,
                        memberName: member.name,
                        leaderName: session.user.name ?? "Your team leader",
                        eventTitle: event.title,
                    });
                } catch (err: any) {
                    console.error("[createRegistration] member invite email failed:", member.email, err?.message);
                }
            }
        }
    }

    return {
        success: true,
        data: {
            registration: serialize(registration),
            tickets: serialize(tickets),
            isFree: event.price === 0,
        },
    };
}

export async function getMyRegistrations(): Promise<IRegistration[]> {
    const session = await requireAuth();
    await connectDB();

    const registrations = await Registration.find({ userId: session.user.id })
        .populate("eventId", "title slug date venue coverImage category type status")
        .sort({ createdAt: -1 })
        .lean();

    return serialize(registrations) as IRegistration[];
}

export async function getMyTickets(): Promise<ITicket[]> {
    const session = await requireAuth();
    await connectDB();

    const tickets = await Ticket.find({ userId: session.user.id })
        .populate("eventId", "title slug date venue coverImage category type status whatsappLink")
        .populate("registrationId", "status paymentStatus")
        .sort({ createdAt: -1 })
        .lean();

    return serialize(tickets) as ITicket[];
}

export async function getEventRegistrations(eventId: string) {
    await connectDB();

    const event = await Event.findById(eventId);
    if (!event) return { success: false, error: "Event not found." };

    await requireDepartmentAccess(event.department.toString());

    const registrations = await Registration.find({ eventId })
        .populate("userId", "name email collegeId")
        .sort({ createdAt: -1 })
        .lean();

    return { success: true, data: serialize(registrations) };
}

export async function toggleAttendance(ticketId: string) {
    await requireManagement();
    await connectDB();

    const ticket = await Ticket.findById(ticketId).populate("eventId");
    if (!ticket) return { success: false, error: "Ticket not found." };

    const event = ticket.eventId as any;
    await requireDepartmentAccess(event.department.toString());

    const updated = await Ticket.findByIdAndUpdate(
        ticketId,
        {
            attendanceStatus: !ticket.attendanceStatus,
            checkedInAt: !ticket.attendanceStatus ? new Date() : null,
        },
        { returnDocument: "after" }
    ).lean();

    return { success: true, data: serialize(updated) };
}

export async function verifyTicketQR(qrCode: string) {
    await requireManagement();
    await connectDB();

    const ticket = await Ticket.findOne({ qrCode })
        .populate("eventId", "title date venue department")
        .populate("userId", "name email collegeId")
        .lean();

    if (!ticket) return { success: false, error: "Invalid QR code." };

    return { success: true, data: serialize(ticket) };
}

export async function getUserRegistrationForEvent(eventId: string) {
    try {
        const session = await requireAuth();
        await connectDB();
        const reg = await Registration.findOne({ eventId, userId: session.user.id }).lean();
        return { registered: !!reg };
    } catch {
        return { registered: false };
    }
}