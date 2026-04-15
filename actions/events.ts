// actions/events.ts
"use server";

import { connectDB } from "@/lib/db";
import { Event, Category, Registration, Ticket } from "@/models";
import { requireManagement, requireDepartmentAccess, requireSuperAdmin } from "@/lib/auth-helpers";
import { createEventSchema, updateEventSchema, eventSlotSchema, eventRoundSchema } from "@/lib/validations";
import { serialize, getPaginationParams } from "@/lib/utils";
import type { EventFilters, PaginatedResponse, IEvent } from "@/types";

export async function getEvents(
    filters: EventFilters = {}
): Promise<PaginatedResponse<IEvent>> {
    await connectDB();

    const { page, limit, skip } = getPaginationParams(filters.page, filters.limit);

    const query: Record<string, unknown> = { status: "published" };

    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.departmentId) query.department = filters.departmentId;
    if (filters.search) {
        // Escape special regex characters to prevent ReDoS attacks (same as public API route)
        const safeSearch = filters.search
            .trim()
            .slice(0, 100)
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = [
            { title: { $regex: safeSearch, $options: "i" } },
            { description: { $regex: safeSearch, $options: "i" } },
        ];
    }

    const [data, total] = await Promise.all([
        Event.find(query)
            .sort({ "date.start": 1 })
            .skip(skip)
            .limit(limit)
            .populate("department", "name")
            .lean(),
        Event.countDocuments(query),
    ]);

    return {
        data: serialize(data) as IEvent[],
        total,
        page,
        limit,
        hasMore: skip + data.length < total,
    };
}

export async function getEventBySlug(slug: string): Promise<IEvent | null> {
    await connectDB();
    const event = await Event.findOne({ slug })
        .populate("department", "name")
        .populate("createdBy", "name email")
        .lean();
    return event ? (serialize(event) as IEvent) : null;
}

export async function syncEventRegistrationCount(eventId: string) {
    await requireManagement();
    await connectDB();
    const count = await Registration.countDocuments({ eventId, status: "confirmed" });
    await Event.findByIdAndUpdate(eventId, { registrationCount: count });
    return { success: true, count };
}

export async function syncAllEventRegistrationCounts() {
    await requireManagement();
    await connectDB();
    // Aggregate confirmed registration counts per event, then bulk-update
    const counts = await Registration.aggregate([
        { $match: { status: "confirmed" } },
        { $group: { _id: "$eventId", count: { $sum: 1 } } },
    ]);
    await Promise.all(
        counts.map(({ _id, count }) =>
            Event.findByIdAndUpdate(_id, { registrationCount: count })
        )
    );
    // Zero out events that have no confirmed registrations
    const eventIdsWithRegs = counts.map((c) => c._id);
    await Event.updateMany(
        { _id: { $nin: eventIdsWithRegs }, registrationCount: { $gt: 0 } },
        { registrationCount: 0 }
    );
    return { success: true };
}

export async function getAllEventsForSchedule(): Promise<IEvent[]> {
    await requireManagement();
    await connectDB();

    const events = await Event.find({})
        .sort({ "date.start": 1 })
        .populate("department", "name")
        .lean();

    return serialize(events) as IEvent[];
}

export async function getManageEvents(
    departmentId?: string,
    status?: string
): Promise<IEvent[]> {
    const session = await requireManagement();
    await connectDB();

    const query: Record<string, unknown> = {};

    if (session.user.role !== "super_admin") {
        query.department = { $in: session.user.departments };
    } else if (departmentId) {
        query.department = departmentId;
    }

    if (status) query.status = status;

    const events = await Event.find(query)
        .sort({ createdAt: -1 })
        .populate("department", "name")
        .populate("createdBy", "name")
        .lean();

    return serialize(events) as IEvent[];
}

export async function createEvent(formData: FormData) {
    const session = await requireManagement();
    await connectDB();

    const raw = Object.fromEntries(formData.entries());

    // coverImage is now a Cloudinary URL string passed directly from the client
    // (the client uploads via /api/upload first, then sets this field)
    const coverImage = raw.coverImage as string | undefined;

    // Parse slots first so we can derive dateStart/dateEnd from them if provided
    const rawSlots: { _id?: string; label?: string; start: string; end: string; capacity: number }[] =
        raw.slots ? JSON.parse(raw.slots as string) : [];
    const parsedSlots = rawSlots.map((s) => ({
        ...s,
        start: new Date((s.start) + (s.start.length === 16 ? ":00+05:30" : "+05:30")).toISOString(),
        end: new Date((s.end) + (s.end.length === 16 ? ":00+05:30" : "+05:30")).toISOString(),
        capacity: Number(s.capacity ?? 0),
    }));

    // Parse rounds
    const toISTiso = (v: string) =>
        new Date(v + (v.length === 16 ? ":00+05:30" : "+05:30")).toISOString();
    const rawRounds: { _id?: string; label: string; start: string; end: string; venue?: string; description?: string }[] =
        raw.rounds ? JSON.parse(raw.rounds as string) : [];
    const parsedRounds = rawRounds.map((r) => ({
        ...r,
        start: r.start.includes("+") || r.start.endsWith("Z") ? r.start : toISTiso(r.start),
        end: r.end.includes("+") || r.end.endsWith("Z") ? r.end : toISTiso(r.end),
    }));

    // When slots are defined, derive the event-level dates from them
    let derivedDateStart = raw.dateStart as string | undefined;
    let derivedDateEnd = raw.dateEnd as string | undefined;
    if (parsedSlots.length > 0) {
        const slotStarts = parsedSlots.map((s) => new Date(s.start).getTime());
        const slotEnds = parsedSlots.map((s) => new Date(s.end).getTime());
        derivedDateStart = new Date(Math.min(...slotStarts)).toISOString();
        derivedDateEnd = new Date(Math.max(...slotEnds)).toISOString();
    }

    const parsed = createEventSchema.safeParse({
        ...raw,
        coverImage: coverImage || undefined,
        dateStart: derivedDateStart
            ? (derivedDateStart.includes("+") || derivedDateStart.endsWith("Z")
                ? derivedDateStart
                : new Date((derivedDateStart as string) + ":00+05:30").toISOString())
            : undefined,
        dateEnd: derivedDateEnd
            ? (derivedDateEnd.includes("+") || derivedDateEnd.endsWith("Z")
                ? derivedDateEnd
                : new Date((derivedDateEnd as string) + ":00+05:30").toISOString())
            : undefined,
        capacity: Number(raw.capacity ?? 0),
        price: Number(raw.price ?? 0),
        pricePerPerson: raw.pricePerPerson === "true",
        isTeamEvent: raw.isTeamEvent === "true",
        teamSizeMin: raw.teamSizeMin ? Number(raw.teamSizeMin) : undefined,
        teamSizeMax: raw.teamSizeMax ? Number(raw.teamSizeMax) : undefined,
        customForm: raw.customForm ? JSON.parse(raw.customForm as string) : [],
        slots: parsedSlots,
        rounds: parsedRounds,
    });

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { departmentId, dateStart, dateEnd, teamSizeMin, teamSizeMax, slots, rounds, ...rest } = parsed.data;

    await requireDepartmentAccess(departmentId);

    const whatsappLinkCreate = (raw.whatsappLink as string | undefined)?.trim() || undefined;

    const event = await Event.create({
        ...rest,
        department: departmentId,
        createdBy: session.user.id,
        date: { start: new Date(dateStart), end: new Date(dateEnd) },
        ...(parsed.data.isTeamEvent && teamSizeMin && teamSizeMax
            ? { teamSize: { min: teamSizeMin, max: teamSizeMax } }
            : {}),
        whatsappLink: whatsappLinkCreate,
        slots: slots.map((s) => ({
            label: s.label || undefined,
            start: new Date(s.start),
            end: new Date(s.end),
            capacity: s.capacity,
            registrationCount: 0,
        })),
        rounds: rounds.map((r) => ({
            label: r.label,
            start: new Date(r.start),
            end: new Date(r.end),
            venue: r.venue || undefined,
            description: r.description || undefined,
        })),
    });

    return { success: true, data: serialize(event) };
}

export async function updateEvent(id: string, formData: FormData) {
    await connectDB();

    const event = await Event.findById(id);
    if (!event) return { success: false, error: "Event not found." };

    await requireDepartmentAccess(event.department.toString());

    const raw = Object.fromEntries(formData.entries());

    // coverImage is now a Cloudinary URL string or empty string (meaning "remove")
    const coverImage = raw.coverImage as string | undefined;

    // Parse slots with IST conversion
    const rawSlotsUpdate: { _id?: string; label?: string; start: string; end: string; capacity: number; registrationCount?: number }[] =
        raw.slots ? JSON.parse(raw.slots as string) : [];
    const parsedSlotsUpdate = rawSlotsUpdate.map((s) => ({
        ...s,
        start: new Date((s.start) + (s.start.length === 16 ? ":00+05:30" : "+05:30")).toISOString(),
        end: new Date((s.end) + (s.end.length === 16 ? ":00+05:30" : "+05:30")).toISOString(),
        capacity: Number(s.capacity ?? 0),
    }));

    // When slots defined, derive event-level dates from them
    let derivedDateStartUpdate = raw.dateStart as string | undefined;
    let derivedDateEndUpdate = raw.dateEnd as string | undefined;
    if (parsedSlotsUpdate.length > 0) {
        const slotStarts = parsedSlotsUpdate.map((s) => new Date(s.start).getTime());
        const slotEnds = parsedSlotsUpdate.map((s) => new Date(s.end).getTime());
        derivedDateStartUpdate = new Date(Math.min(...slotStarts)).toISOString();
        derivedDateEndUpdate = new Date(Math.max(...slotEnds)).toISOString();
    }

    const toISO = (v: string | undefined) => {
        if (!v) return undefined;
        if (v.includes("+") || v.endsWith("Z")) return v;
        return new Date(v + ":00+05:30").toISOString();
    };

    const parsed = updateEventSchema.safeParse({
        ...raw,
        coverImage: coverImage || undefined,
        dateStart: toISO(derivedDateStartUpdate),
        dateEnd: toISO(derivedDateEndUpdate),
        capacity: raw.capacity !== undefined ? Number(raw.capacity) : undefined,
        price: raw.price !== undefined ? Number(raw.price) : undefined,
        pricePerPerson: raw.pricePerPerson !== undefined ? raw.pricePerPerson === "true" : undefined,
        isTeamEvent: raw.isTeamEvent !== undefined ? raw.isTeamEvent === "true" : undefined,
        teamSizeMin: raw.teamSizeMin ? Number(raw.teamSizeMin) : undefined,
        teamSizeMax: raw.teamSizeMax ? Number(raw.teamSizeMax) : undefined,
        customForm: raw.customForm ? JSON.parse(raw.customForm as string) : undefined,
        slots: raw.slots !== undefined ? parsedSlotsUpdate : undefined,
        rounds: raw.rounds !== undefined ? (() => {
            const toISTisoU = (v: string) =>
                new Date(v + (v.length === 16 ? ":00+05:30" : "+05:30")).toISOString();
            const rawRoundsU: { _id?: string; label: string; start: string; end: string; venue?: string; description?: string }[] =
                JSON.parse(raw.rounds as string);
            return rawRoundsU.map((r) => ({
                ...r,
                start: r.start.includes("+") || r.start.endsWith("Z") ? r.start : toISTisoU(r.start),
                end: r.end.includes("+") || r.end.endsWith("Z") ? r.end : toISTisoU(r.end),
            }));
        })() : undefined,
    });

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { departmentId, dateStart, dateEnd, teamSizeMin, teamSizeMax, slots: parsedSlots2, rounds: parsedRounds2, ...rest } = parsed.data;

    const updates: Record<string, unknown> = { ...rest };

    // Explicitly handle coverImage removal: if raw had coverImage key but it's empty, unset it
    if ("coverImage" in raw && !raw.coverImage) {
        updates.coverImage = null;
    }

    if (departmentId) updates.department = departmentId;
    if (dateStart || dateEnd) {
        updates.date = {
            start: dateStart ? new Date(dateStart) : event.date.start,
            end: dateEnd ? new Date(dateEnd) : event.date.end,
        };
    }
    if (parsed.data.isTeamEvent && teamSizeMin && teamSizeMax) {
        updates.teamSize = { min: teamSizeMin, max: teamSizeMax };
    }

    // Slots — always replace when the key is present in the request
    if (raw.slots !== undefined && parsedSlotsUpdate.length >= 0) {
        // Only treat _id as a real MongoDB ObjectId if it's a valid 24-char hex string.
        // Client-generated short IDs (e.g. 'yutate8dm4') must be omitted so Mongoose
        // auto-assigns a proper ObjectId for new slots.
        const isValidObjectId = (id: string) => /^[0-9a-f]{24}$/i.test(id);
        const existingSlots: any[] = (event.slots as any) ?? [];
        updates.slots = parsedSlotsUpdate.map((s) => {
            const validId = s._id && isValidObjectId(s._id) ? s._id : null;
            const existing = validId ? existingSlots.find((e: any) => e._id?.toString() === validId) : null;
            return {
                ...(validId ? { _id: validId } : {}),
                label: s.label || undefined,
                start: new Date(s.start),
                end: new Date(s.end),
                capacity: s.capacity,
                registrationCount: existing?.registrationCount ?? 0,
            };
        });
    }

    // Rounds — always replace when the key is present in the request
    if (raw.rounds !== undefined && parsedRounds2 !== undefined) {
        const isValidObjectId = (id: string) => /^[0-9a-f]{24}$/i.test(id);
        updates.rounds = parsedRounds2.map((r) => ({
            ...(r._id && isValidObjectId(r._id) ? { _id: r._id } : {}),
            label: r.label,
            start: new Date(r.start),
            end: new Date(r.end),
            venue: r.venue || undefined,
            description: r.description || undefined,
        }));
    }

    // Google Sheet ID — stored directly, not part of the zod schema
    const googleSheetId = (raw.googleSheetId as string | undefined)?.trim();
    updates.googleSheetId = googleSheetId || null;

    // WhatsApp link — stored directly, not part of the zod schema
    if ("whatsappLink" in raw) {
        updates.whatsappLink = (raw.whatsappLink as string | undefined)?.trim() || null;
    }

    const updated = await Event.findByIdAndUpdate(id, updates, {
        returnDocument: "after",
    }).lean();

    return { success: true, data: serialize(updated) };
}

export async function cancelEvent(id: string) {
    await connectDB();

    const event = await Event.findById(id);
    if (!event) return { success: false, error: "Event not found." };

    await requireDepartmentAccess(event.department.toString());

    if (event.status !== "published") {
        return { success: false, error: "Only published events can be cancelled." };
    }

    await Event.findByIdAndUpdate(id, { status: "cancelled" });

    return { success: true };
}

export async function deleteEvent(id: string) {
    await connectDB();

    const event = await Event.findById(id);
    if (!event) return { success: false, error: "Event not found." };

    await requireDepartmentAccess(event.department.toString());

    if (event.status === "published") {
        return { success: false, error: "Cancel the event before deleting it." };
    }

    await Ticket.deleteMany({ eventId: id });
    await Registration.deleteMany({ eventId: id });
    await Event.findByIdAndDelete(id);

    return { success: true };
}

export async function toggleRegistrations(id: string) {
    await connectDB();

    const event = await Event.findById(id);
    if (!event) return { success: false, error: "Event not found." };

    await requireDepartmentAccess(event.department.toString());

    await Event.findByIdAndUpdate(id, { registrationsClosed: !event.registrationsClosed });

    return { success: true, registrationsClosed: !event.registrationsClosed };
}

export async function publishEvent(id: string) {
    await connectDB();

    const event = await Event.findById(id);
    if (!event) return { success: false, error: "Event not found." };

    await requireDepartmentAccess(event.department.toString());

    await Event.findByIdAndUpdate(id, { status: "published" });

    return { success: true };
}

export async function getCategories() {
    await connectDB();
    const categories = await Category.find().sort({ isDefault: -1, name: 1 }).lean();
    return serialize(categories);
}

export async function createCategory(name: string) {
    await requireSuperAdmin();
    await connectDB();

    const { slugify } = await import("@/lib/utils");
    const slug = slugify(name);

    const existing = await Category.findOne({ slug });
    if (existing) return { success: false, error: "Category already exists." };

    const category = await Category.create({ name, slug, isDefault: false });
    return { success: true, data: serialize(category) };
}

export async function deleteCategory(id: string) {
    await requireSuperAdmin();
    await connectDB();

    const category = await Category.findById(id);
    if (!category) return { success: false, error: "Category not found." };

    await Category.findByIdAndDelete(id);
    return { success: true };
}

export async function renameCategory(id: string, name: string) {
    await requireSuperAdmin();
    await connectDB();

    const { slugify } = await import("@/lib/utils");
    const slug = slugify(name);

    const category = await Category.findById(id);
    if (!category) return { success: false, error: "Category not found." };

    const existing = await Category.findOne({ slug, _id: { $ne: id } });
    if (existing) return { success: false, error: "A category with this name already exists." };

    await Category.findByIdAndUpdate(id, { name, slug });
    return { success: true };
}

export async function generateCsvToken(eventId: string) {
    await requireManagement();
    await connectDB();

    const event = await Event.findById(eventId);
    if (!event) return { success: false, error: "Event not found." };

    await requireDepartmentAccess(event.department.toString());

    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    await Event.findByIdAndUpdate(eventId, { csvToken: token });
    return { success: true, token };
}

export async function createAndLinkSheet(eventId: string) {
    await requireManagement();
    await connectDB();

    const event = await Event.findById(eventId).lean();
    if (!event) return { success: false, error: "Event not found." };

    const { createEventSheet } = await import("@/lib/sheets");
    const sheetId = await createEventSheet(
        (event as any).title,
        (event as any).customForm ?? []
    );

    await Event.findByIdAndUpdate(eventId, { googleSheetId: sheetId });

    return { success: true, sheetId };
}

export async function syncEventToSheet(eventId: string) {
    await requireManagement();
    await connectDB();

    const event = await Event.findById(eventId).lean();
    if (!event) return { success: false, error: "Event not found." };

    const googleSheetId = (event as any).googleSheetId as string | null;
    if (!googleSheetId) return { success: false, error: "No Google Sheet linked to this event." };

    const registrations = await Registration.find({ eventId, status: "confirmed" })
        .populate("userId", "name email collegeId")
        .lean();

    const { syncAllRegistrationsToSheet } = await import("@/lib/sheets");
    await syncAllRegistrationsToSheet(googleSheetId, serialize(event) as IEvent, registrations);

    return { success: true, count: registrations.length };
}