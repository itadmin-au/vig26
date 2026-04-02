// lib/rate-limit.ts
// Redis-backed rate limiter using Upstash. Falls back to in-memory if Redis is unavailable.

import { Redis } from "@upstash/redis";

// ─── Redis client ──────────────────────────────────────────────────────────────

let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
}

// ─── In-memory fallback ────────────────────────────────────────────────────────

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
        if (entry.resetAt < now) memoryStore.delete(key);
    }
}, 5 * 60 * 1000);

function checkMemory(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || entry.resetAt < now) {
        memoryStore.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
}

// ─── Redis implementation ──────────────────────────────────────────────────────

async function checkRedis(key: string, max: number, windowMs: number): Promise<boolean> {
    const redisKey = `rl:${key}`;
    const windowSec = Math.ceil(windowMs / 1000);

    // INCR atomically increments (creates key at 0 if missing) and returns new value
    const count = await redis!.incr(redisKey);

    if (count === 1) {
        // First request in this window — set TTL
        await redis!.expire(redisKey, windowSec);
    }

    return count <= max;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the request is within the allowed limit, false if it should
 * be rejected.
 *
 * @param key        Unique key (e.g. IP + route)
 * @param max        Max allowed requests in the window
 * @param windowMs   Window duration in milliseconds
 */
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
    if (redis) {
        try {
            return await checkRedis(key, max, windowMs);
        } catch {
            // Redis unavailable — fall back to in-memory
        }
    }
    return checkMemory(key, max, windowMs);
}

/**
 * Extract caller IP from a Next.js Request object.
 */
export function getClientIp(req: Request): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "unknown"
    );
}

/**
 * Return a 429 Response with a Retry-After header.
 */
export function rateLimitResponse(retryAfterSeconds = 60): Response {
    return Response.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
}
