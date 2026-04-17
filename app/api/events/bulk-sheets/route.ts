// app/api/events/bulk-sheets/route.ts
// POST — creates Google Sheet tabs for all published events that don't have one yet.
//        Reuses an existing category spreadsheet or creates a new one if needed.

import { connectDB } from "@/lib/db";
import { Category, Event, Registration, User } from "@/models";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";
import { createCategorySpreadsheet, createEventTab, syncAllRegistrationsToSheet, syncCategoryEventsSheet } from "@/lib/sheets";

export async function POST(_req: Request) {
    try {
        const session = await requireAuth();
        await connectDB();

        const user = await User.findById(session.user.id).select("+googleSheetsRefreshToken");
        if (!user?.googleSheetsRefreshToken) {
            return Response.json(
                { error: "Google Sheets not connected. Please connect your Google account first." },
                { status: 400 }
            );
        }

        const refreshToken: string = user.googleSheetsRefreshToken;

        // Only process published events that don't have a sheet tab yet
        const events = await Event.find({
            status: "published",
            $or: [{ googleSheetId: null }, { sheetTabName: null }],
        }).lean();

        if (events.length === 0) {
            return Response.json({ success: true, created: 0, message: "All published events already have sheets." });
        }

        // Cache category spreadsheet IDs so we only create one per category
        const categorySheetCache: Record<string, string> = {};

        let created = 0;
        const errors: string[] = [];

        for (const event of events) {
            // Each event needs ~4 write API calls. At 60 writes/min limit,
            // 3 s between events keeps us at ~20 events/min (80 writes/min max)
            // but since most events have no registrations to backfill it's often 2 writes.
            await new Promise((r) => setTimeout(r, 3000));

            try {
                const categorySlug = (event as any).category as string;

                // Resolve or create the category spreadsheet
                if (!categorySheetCache[categorySlug]) {
                    const category = await Category.findOne({ slug: categorySlug });
                    if (!category) {
                        errors.push(`${(event as any).title}: category "${categorySlug}" not found`);
                        continue;
                    }

                    let spreadsheetId: string = (category as any).googleSheetId ?? "";
                    if (!spreadsheetId) {
                        spreadsheetId = await createCategorySpreadsheet(category.name, refreshToken);
                        await Category.findByIdAndUpdate(category._id, {
                            googleSheetId: spreadsheetId,
                            sheetOwner: session.user.id,
                        });
                    }
                    categorySheetCache[categorySlug] = spreadsheetId;
                }

                const spreadsheetId = categorySheetCache[categorySlug];
                const maxMembers = (event as any).isTeamEvent ? ((event as any).teamSize?.max ?? 0) : 0;
                // Include Inter/Intra in the tab title to avoid duplicate names
                const type: string = (event as any).type ?? "";
                const tabTitle = type
                    ? `${(event as any).title} (${type.charAt(0).toUpperCase() + type.slice(1)})`
                    : (event as any).title;

                const sheetTabName = await createEventTab(
                    spreadsheetId,
                    tabTitle,
                    (event as any).customForm ?? [],
                    refreshToken,
                    maxMembers
                );

                await Event.findByIdAndUpdate((event as any)._id, {
                    googleSheetId: spreadsheetId,
                    sheetTabName,
                });

                // Backfill existing confirmed registrations
                const existingRegs = await Registration.find({
                    eventId: (event as any)._id,
                    paymentStatus: { $in: ["completed", "na"] },
                })
                    .populate("userId", "name email collegeId")
                    .populate("teamMembers.userId", "name email collegeId")
                    .lean();

                if (existingRegs.length > 0) {
                    await syncAllRegistrationsToSheet(
                        spreadsheetId,
                        sheetTabName,
                        event as any,
                        existingRegs,
                        refreshToken
                    );
                }

                created++;
            } catch (err: any) {
                console.error(`[bulk-sheets] Failed for event "${(event as any).title}":`, err?.message);
                errors.push(`${(event as any).title}: ${err?.message ?? "unknown error"}`);
            }
        }

        // Sync the Events Overview tab for each category that has a spreadsheet
        const processedSlugs = [...new Set(Object.keys(categorySheetCache))];
        for (const slug of processedSlugs) {
            try {
                const spreadsheetId = categorySheetCache[slug];
                const allCatEvents = await Event.find({ category: slug })
                    .populate("department", "name").lean();
                await syncCategoryEventsSheet(spreadsheetId, allCatEvents, refreshToken);
                await new Promise((r) => setTimeout(r, 1000));
            } catch (err: any) {
                console.error(`[bulk-sheets] Overview sync failed for "${slug}":`, err?.message);
            }
        }

        return Response.json({
            success: true,
            created,
            total: events.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        console.error("[bulk-sheets POST]", err);
        return Response.json({ error: "Failed to create sheets." }, { status: 500 });
    }
}
