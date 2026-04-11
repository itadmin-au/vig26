// actions/events.ts
"use server";

import { connectDB } from "@/lib/db";
import { Event, Category, Registration, Ticket } from "@/models";
import { requireManagement, requireDepartmentAccess, requireSuperAdmin } from "@/lib/auth-helpers";
import { createEventSchema, updateEventSchema } from "@/lib/validations";
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

    const parsed = createEventSchema.safeParse({
        ...raw,
        coverImage: coverImage || undefined,
        dateStart: raw.dateStart ? new Date((raw.dateStart as string) + ":00+05:30").toISOString() : undefined,
        dateEnd: raw.dateEnd ? new Date((raw.dateEnd as string) + ":00+05:30").toISOString() : undefined,
        capacity: Number(raw.capacity ?? 0),
        price: Number(raw.price ?? 0),
        isTeamEvent: raw.isTeamEvent === "true",
        teamSizeMin: raw.teamSizeMin ? Number(raw.teamSizeMin) : undefined,
        teamSizeMax: raw.teamSizeMax ? Number(raw.teamSizeMax) : undefined,
        customForm: raw.customForm ? JSON.parse(raw.customForm as string) : [],
    });

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { departmentId, dateStart, dateEnd, teamSizeMin, teamSizeMax, ...rest } = parsed.data;

    await requireDepartmentAccess(departmentId);

    const event = await Event.create({
        ...rest,
        department: departmentId,
        createdBy: session.user.id,
        date: { start: new Date(dateStart), end: new Date(dateEnd) },
        ...(parsed.data.isTeamEvent && teamSizeMin && teamSizeMax
            ? { teamSize: { min: teamSizeMin, max: teamSizeMax } }
            : {}),
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

    const parsed = updateEventSchema.safeParse({
        ...raw,
        coverImage: coverImage || undefined,
        dateStart: raw.dateStart ? new Date((raw.dateStart as string) + ":00+05:30").toISOString() : undefined,
        dateEnd: raw.dateEnd ? new Date((raw.dateEnd as string) + ":00+05:30").toISOString() : undefined,
        capacity: raw.capacity !== undefined ? Number(raw.capacity) : undefined,
        price: raw.price !== undefined ? Number(raw.price) : undefined,
        isTeamEvent: raw.isTeamEvent !== undefined ? raw.isTeamEvent === "true" : undefined,
        teamSizeMin: raw.teamSizeMin ? Number(raw.teamSizeMin) : undefined,
        teamSizeMax: raw.teamSizeMax ? Number(raw.teamSizeMax) : undefined,
        customForm: raw.customForm ? JSON.parse(raw.customForm as string) : undefined,
    });

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { departmentId, dateStart, dateEnd, teamSizeMin, teamSizeMax, ...rest } = parsed.data;

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

    // Google Sheet ID — stored directly, not part of the zod schema
    const googleSheetId = (raw.googleSheetId as string | undefined)?.trim();
    updates.googleSheetId = googleSheetId || null;

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
    if (category.isDefault) return { success: false, error: "Default categories cannot be deleted." };

    await Category.findByIdAndDelete(id);
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