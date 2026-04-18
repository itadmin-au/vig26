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

    const { eventId, slotId, leaderUsn, teamMembers, formResponses } = parsed.data;

    const event = await Event.findById(eventId);
    if (!event) return { success: false, error: "Event not found." };
    if (event.status !== "published") return { success: false, error: "This event is not open for registration." };
    if (event.registrationsClosed) return { success: false, error: "Registrations for this event are closed." };

    // Validate required custom form fields server-side
    for (const field of (event.customForm ?? []) as any[]) {
        if (!field.isRequired) continue;
        const response = formResponses.find((r) => r.fieldId === field._id.toString());
        const val = response?.value;
        const empty = val === undefined || val === null || (typeof val === "string" && val.trim() === "") || (Array.isArray(val) && val.length === 0);
        if (empty) return { success: false, error: `"${field.label}" is required.` };
    }

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

    if (leaderUsn) {
        await User.findByIdAndUpdate(session.user.id, { collegeId: leaderUsn.trim() });
    }

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

        // Sync to Google Sheets immediately for free events
        if ((event as any).googleSheetId && (event as any).sheetTabName) {
            try {
                // Use the category sheet owner's token (the account that owns the spreadsheet)
                const { Category } = await import("@/models");
                const cat = await Category.findOne({ slug: (event as any).category }).lean();
                const tokenHolder = (cat as any)?.sheetOwner ?? event.createdBy;
                const creator = await User.findById(tokenHolder)
                    .select("+googleSheetsRefreshToken")
                    .lean();
                const refreshToken = (creator as any)?.googleSheetsRefreshToken as string | undefined;

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
                ).catch((e: any) => console.error("[createRegistration] Overview sync failed:", e?.message));
            } catch (sheetErr: any) {
                console.error("[createRegistration] Sheet sync failed (non-fatal):", sheetErr?.message);
            }
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
        .populate("eventId", "title slug date venue coverImage category type status price pricePerPerson isTeamEvent teamSize")
        .sort({ createdAt: -1 })
        .lean();

    return serialize(registrations) as IRegistration[];
}

export async function updateTeamMember(
    registrationId: string,
    memberIndex: number,
    data: { name: string; email: string; usn?: string }
) {
    const session = await requireAuth();
    await connectDB();

    const reg = await Registration.findOne({ _id: registrationId, userId: session.user.id });
    if (!reg) return { success: false, error: "Registration not found." };
    if (reg.status !== "confirmed") return { success: false, error: "Registration is not confirmed." };
    if (!reg.isTeamRegistration) return { success: false, error: "Not a team registration." };
    if (memberIndex < 0 || memberIndex >= reg.teamMembers.length) return { success: false, error: "Invalid member index." };

    const normalizedEmail = data.email.toLowerCase().trim();

    const leaderUser = await User.findById(session.user.id).select("email").lean();
    if ((leaderUser as any)?.email === normalizedEmail) {
        return { success: false, error: "Cannot set member email to your own email." };
    }

    const emailConflict = reg.teamMembers.some((m: any, i: number) =>
        i !== memberIndex && m.email === normalizedEmail
    );
    if (emailConflict) return { success: false, error: "This email is already used by another team member." };

    const oldEmail = reg.teamMembers[memberIndex].email;
    reg.teamMembers[memberIndex].name = data.name.trim();
    reg.teamMembers[memberIndex].email = normalizedEmail;
    reg.teamMembers[memberIndex].usn = data.usn?.trim() || null;

    if (oldEmail !== normalizedEmail) {
        const newUser = await User.findOne({ email: normalizedEmail }).lean();
        reg.teamMembers[memberIndex].userId = (newUser as any)?._id ?? null;

        const memberTickets = await Ticket.find({ registrationId: reg._id, teamRole: "member" }).sort({ _id: 1 });
        if (memberTickets[memberIndex]) {
            await Ticket.findByIdAndUpdate(memberTickets[memberIndex]._id, {
                userId: (newUser as any)?._id ?? null,
            });
        }
    }

    reg.markModified("teamMembers");
    await reg.save();

    return { success: true };
}

export async function removeTeamMember(registrationId: string, memberIndex: number) {
    const session = await requireAuth();
    await connectDB();

    const reg = await Registration.findOne({ _id: registrationId, userId: session.user.id }).populate("eventId");
    if (!reg) return { success: false, error: "Registration not found." };
    if (reg.status !== "confirmed") return { success: false, error: "Registration is not confirmed." };
    if (!reg.isTeamRegistration) return { success: false, error: "Not a team registration." };

    const event = reg.eventId as any;
    const minTeammates = (event?.teamSize?.min ?? 2) - 1;

    if (reg.teamMembers.length <= minTeammates) {
        const minTotal = event?.teamSize?.min ?? 2;
        return { success: false, error: `Cannot remove member — team minimum is ${minTotal} (including you).` };
    }

    if (memberIndex < 0 || memberIndex >= reg.teamMembers.length) return { success: false, error: "Invalid member index." };

    const memberTickets = await Ticket.find({ registrationId: reg._id, teamRole: "member" }).sort({ _id: 1 });
    if (memberTickets[memberIndex]) {
        await Ticket.findByIdAndDelete(memberTickets[memberIndex]._id);
    }

    reg.teamMembers.splice(memberIndex, 1);
    reg.markModified("teamMembers");
    await reg.save();

    return { success: true };
}

export async function addTeamMember(registrationId: string, member: { name: string; email: string; usn?: string }) {
    const session = await requireAuth();
    await connectDB();

    const reg = await Registration.findOne({ _id: registrationId, userId: session.user.id }).populate("eventId");
    if (!reg) return { success: false, error: "Registration not found.", requiresPayment: false };
    if (reg.status !== "confirmed") return { success: false, error: "Registration is not confirmed.", requiresPayment: false };
    if (!reg.isTeamRegistration) return { success: false, error: "Not a team registration.", requiresPayment: false };

    const event = reg.eventId as any;
    const maxTeammates = (event?.teamSize?.max ?? 5) - 1;

    if (reg.teamMembers.length >= maxTeammates) {
        return { success: false, error: `Team is already at the maximum size (${event?.teamSize?.max ?? 5} including you).`, requiresPayment: false };
    }

    const normalizedEmail = member.email.toLowerCase().trim();

    const leaderUser = await User.findById(session.user.id).select("name email").lean();
    if ((leaderUser as any)?.email === normalizedEmail) {
        return { success: false, error: "You cannot add yourself as a team member.", requiresPayment: false };
    }

    const emailConflict = reg.teamMembers.some((m: any) => m.email === normalizedEmail);
    if (emailConflict) return { success: false, error: "This person is already in your team.", requiresPayment: false };

    if (event?.pricePerPerson && event?.price > 0) {
        return { success: false, error: null, requiresPayment: true, amount: event.price as number };
    }

    const memberUser = await User.findOne({ email: normalizedEmail });
    const memberQR = generateQRToken();

    await Registration.findByIdAndUpdate(reg._id, {
        $push: { teamMembers: { name: member.name.trim(), email: normalizedEmail, usn: member.usn?.trim() || null, userId: memberUser?._id ?? null } },
    });

    await Ticket.create({
        registrationId: reg._id,
        eventId: event._id,
        userId: memberUser?._id ?? undefined,
        qrCode: memberQR,
        teamRole: "member",
        teamId: reg.teamId,
        attendanceStatus: false,
    });

    if (memberUser) {
        try {
            const emailDate = formatEventDate(event.date.start, event.date.end);
            await sendTicketConfirmationEmail({
                to: memberUser.email,
                name: memberUser.name,
                eventTitle: event.title,
                eventDate: emailDate,
                venue: event.venue ?? undefined,
                ticketId: memberQR,
            });
        } catch (err: any) {
            console.error("[addTeamMember] ticket email failed:", err?.message);
        }
        await User.findByIdAndUpdate(memberUser._id, { $addToSet: { registeredEvents: reg._id } });
    } else {
        try {
            await sendTeamMemberInviteEmail({
                to: member.email,
                memberName: member.name,
                leaderName: (leaderUser as any)?.name ?? "Your team leader",
                eventTitle: event.title,
            });
        } catch (err: any) {
            console.error("[addTeamMember] invite email failed:", err?.message);
        }
    }

    return { success: true, requiresPayment: false, error: null };
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