// hooks/use-manage-events.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { getManageEvents } from "@/actions/events";
import type { IEvent } from "@/types";

// ─── Module-level cache (survives re-renders and navigation within the session) ──
type CacheEntry = { data: IEvent[]; ts: number };
const cache = new Map<string, CacheEntry>();
const STALE_MS = 60_000; // 60 seconds

function cacheKey(departmentId?: string, status?: string) {
    return `${departmentId ?? "*"}:${status ?? "*"}`;
}

export function useManageEvents(departmentId?: string, status?: string) {
    const key = cacheKey(departmentId, status);

    // Initialise from cache so we never show a loading spinner on revisit
    const cached = cache.get(key);
    const [events, setEvents] = useState<IEvent[]>(cached?.data ?? []);
    const [loading, setLoading] = useState(!cached);
    const [error, setError] = useState<string | null>(null);

    const fetchEvents = useCallback(async (force = false) => {
        if (!force) {
            const hit = cache.get(key);
            if (hit && Date.now() - hit.ts < STALE_MS) {
                setEvents(hit.data);
                setLoading(false);
                return;
            }
        }
        setLoading(true);
        setError(null);
        try {
            const data = await getManageEvents(departmentId, status);
            cache.set(key, { data, ts: Date.now() });
            setEvents(data);
        } catch (err: any) {
            setError(err.message ?? "Failed to load events.");
        } finally {
            setLoading(false);
        }
    }, [key, departmentId, status]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const byStatus = (s: string) => events.filter((e) => e.status === s);

    return {
        events,
        drafts: byStatus("draft"),
        published: byStatus("published"),
        cancelled: byStatus("cancelled"),
        loading,
        error,
        // Force-refetch and bust cache (called after every mutation)
        refetch: () => fetchEvents(true),
    };
}