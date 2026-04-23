// app/api/events/route.ts
import { connectDB } from "@/lib/db";
import { Event } from "@/models";
import { serialize, getPaginationParams } from "@/lib/utils";

export async function GET(req: Request) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type");
        const category = searchParams.get("category");
        const rawSearch = searchParams.get("search") ?? "";
        const search = rawSearch.trim().slice(0, 100); // cap search at 100 chars
        const page = Math.max(1, Math.min(Number(searchParams.get("page") ?? 1) || 1, 1000));
        const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 12) || 12, 50));

        const { skip } = getPaginationParams(page, limit);

        const query: Record<string, unknown> = { status: "published", "date.end": { $gt: new Date() } };
        if (type) query.type = type;
        if (category) query.category = category;
        if (search.length > 0) {
            // Escape special regex characters to prevent ReDoS attacks
            const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.title = { $regex: safeSearch, $options: "i" };
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

        return Response.json({
            success: true,
            data: {
                data: serialize(data),
                total,
                page,
                limit,
                hasMore: skip + data.length < total,
            },
        });
    } catch (err) {
        console.error("[GET /api/events]", err);
        return Response.json({ success: false, error: "Failed to fetch events." }, { status: 500 });
    }
}