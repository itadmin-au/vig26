// app/api/upload/route.ts
import { requireManagement } from "@/lib/auth-helpers";
import { uploadFile } from "@/lib/cloudinary";

// Detect actual file type from magic bytes — client-supplied Content-Type is not trusted.
function detectMimeType(buf: Buffer): string | null {
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
    // GIF: GIF8
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
    // WebP: RIFF....WEBP
    if (
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) return "image/webp";
    return null;
}

export async function POST(req: Request) {
    try {
        await requireManagement();

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const folder = (formData.get("folder") as string | null) ?? "event-covers";

        if (!file || file.size === 0) {
            return Response.json({ success: false, error: "No file provided." }, { status: 400 });
        }

        // 5MB limit (check before reading buffer)
        if (file.size > 5 * 1024 * 1024) {
            return Response.json(
                { success: false, error: "File too large. Maximum size is 5MB." },
                { status: 400 }
            );
        }

        // Read the file buffer and detect type from magic bytes.
        // Do NOT trust file.type — it is client-supplied and trivially spoofed.
        const buffer = Buffer.from(await file.arrayBuffer());
        const detectedMime = detectMimeType(buffer);
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

        if (!detectedMime || !allowedTypes.includes(detectedMime)) {
            return Response.json(
                { success: false, error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." },
                { status: 400 }
            );
        }

        const validFolders = ["event-covers", "form-uploads", "dept-logos"];
        const uploadFolder = validFolders.includes(folder) ? folder : "event-covers";

        const result = await uploadFile(file, uploadFolder as "event-covers" | "form-uploads" | "dept-logos");

        return Response.json({ success: true, url: result.url, publicId: result.publicId });
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
            return Response.json({ success: false, error: "Unauthorized." }, { status: 401 });
        }
        console.error("[POST /api/upload]", err);
        return Response.json({ success: false, error: "Upload failed. Please try again." }, { status: 500 });
    }
}