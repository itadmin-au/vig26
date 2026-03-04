import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

type UploadFolder = "event-covers" | "form-uploads" | "dept-logos";

interface UploadResult {
    url: string;
    publicId: string;
}

/**
 * Upload a file (Buffer or base64 string) to Cloudinary.
 * Returns the secure URL and public_id for future deletion.
 */
export async function uploadToCloudinary(
    source: Buffer | string,
    folder: UploadFolder = "event-covers"
): Promise<UploadResult> {
    const result = await new Promise<{ secure_url: string; public_id: string }>(
        (resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder, resource_type: "auto" },
                (error, result) => {
                    if (error || !result) return reject(error ?? new Error("Upload failed"));
                    resolve(result);
                }
            );

            if (typeof source === "string") {
                // base64 data URI
                cloudinary.uploader
                    .upload(source, { folder, resource_type: "auto" })
                    .then(resolve)
                    .catch(reject);
            } else {
                // Buffer — pipe into stream
                const { Readable } = require("stream");
                Readable.from(source).pipe(uploadStream);
            }
        }
    );

    return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Delete a file from Cloudinary by its public_id.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
}

/**
 * Upload a Next.js File object (from FormData) to Cloudinary.
 * Use this in API routes / Server Actions.
 */
export async function uploadFile(
    file: File,
    folder: UploadFolder = "event-covers"
): Promise<UploadResult> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return uploadToCloudinary(buffer, folder);
}