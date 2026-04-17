// lib/sheets.ts
// Google Sheets helper using OAuth2 with a stored refresh token.
//
// Structure: one spreadsheet per event category, one tab per event.
// Required env vars:
//   GOOGLE_CLIENT_ID         — from Google Cloud OAuth2 credentials
//   GOOGLE_CLIENT_SECRET     — from Google Cloud OAuth2 credentials
//   GOOGLE_REFRESH_TOKEN     — optional global fallback token

import { google } from "googleapis";
import type { IEvent } from "@/types";

function getAuth(refreshToken?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const token = refreshToken ?? process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !token) {
        throw new Error(
            "Missing Google OAuth credentials. Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are set in .env.local"
        );
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: token });
    return oauth2;
}

/** Quotes a sheet tab name for use in a range string, e.g. 'My Event'!A1 */
function buildRange(sheetTabName: string, range: string): string {
    const escaped = sheetTabName.replace(/'/g, "''");
    return `'${escaped}'!${range}`;
}

function buildHeaders(customForm: IEvent["customForm"], maxMembers = 0): string[] {
    const memberCols: string[] = [];
    for (let i = 1; i <= maxMembers; i++) {
        memberCols.push(`Member ${i} Name`, `Member ${i} Email`, `Member ${i} College ID`);
    }
    return [
        "Registration ID",
        "Name",
        "Email",
        "College ID",
        "Type",
        "Team ID",
        "Team Size",
        "Status",
        "Payment Status",
        "Registered At",
        ...customForm.map((f) => f.label),
        ...memberCols,
    ];
}

function buildRow(reg: any, customForm: IEvent["customForm"], maxMembers = 0): string[] {
    const responseMap: Record<string, string> = {};
    for (const r of reg.formResponses ?? []) {
        responseMap[r.fieldId] = String(r.value ?? "");
    }

    const additionalMembers: any[] = reg.teamMembers ?? [];
    const allMembers = [
        { name: reg.userId?.name ?? "", email: reg.userId?.email ?? "", collegeId: reg.userId?.collegeId ?? "" },
        ...additionalMembers.map((m: any) => ({
            name: m.name ?? "",
            email: m.email ?? "",
            collegeId: m.userId?.collegeId ?? "",
        })),
    ];
    const memberCells: string[] = [];
    for (let i = 0; i < maxMembers; i++) {
        memberCells.push(
            allMembers[i]?.name ?? "",
            allMembers[i]?.email ?? "",
            allMembers[i]?.collegeId ?? ""
        );
    }

    return [
        String(reg._id),
        reg.userId?.name ?? "—",
        reg.userId?.email ?? "—",
        reg.userId?.collegeId ?? "—",
        reg.isTeamRegistration ? "Team" : "Individual",
        reg.teamId ?? "—",
        reg.isTeamRegistration ? String(additionalMembers.length + 1) : "1",
        reg.status,
        reg.paymentStatus,
        new Date(reg.createdAt).toLocaleString("en-IN"),
        ...customForm.map((f) => responseMap[String(f._id)] ?? ""),
        ...memberCells,
    ];
}

/**
 * Creates a new Google Spreadsheet for an event category.
 * Returns the spreadsheet ID. Call once per category.
 */
export async function createCategorySpreadsheet(
    categoryName: string,
    refreshToken?: string
): Promise<string> {
    const auth = getAuth(refreshToken);
    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    const created = await sheets.spreadsheets.create({
        requestBody: {
            properties: { title: `Registrations — ${categoryName}` },
            // Start with no sheets; tabs will be added per event
            sheets: [],
        },
    });

    const spreadsheetId = created.data.spreadsheetId!;

    await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { role: "reader", type: "anyone" },
    });

    return spreadsheetId;
}

/**
 * Adds a new tab for an event inside an existing category spreadsheet.
 * tabTitle should already include disambiguation (e.g. "Event Name (Inter)").
 * If a tab with that name already exists, appends -2, -3, … until unique.
 * Writes the header row and returns the tab title actually used.
 */
export async function createEventTab(
    spreadsheetId: string,
    tabTitle: string,
    customForm: IEvent["customForm"],
    refreshToken?: string,
    maxMembers = 0
): Promise<string> {
    const auth = getAuth(refreshToken);
    const sheets = google.sheets({ version: "v4", auth });

    // Fetch existing sheet titles to avoid duplicates
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTitles = new Set(
        (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "")
    );

    // Find a unique title (truncate to 95 chars to leave room for suffix)
    const base = tabTitle.slice(0, 95);
    let title = base;
    let suffix = 2;
    while (existingTitles.has(title)) {
        title = `${base} -${suffix++}`;
    }

    // Retry on rate-limit errors (429) with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{ addSheet: { properties: { title } } }],
                },
            });
            break;
        } catch (err: any) {
            const isRateLimit = err?.status === 429 || err?.code === 429 ||
                err?.message?.includes("Quota exceeded");
            if (isRateLimit && attempt < 2) {
                await new Promise((r) => setTimeout(r, (attempt + 1) * 15000));
            } else {
                throw err;
            }
        }
    }

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: buildRange(title, "A1"),
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [buildHeaders(customForm, maxMembers)] },
    });

    return title;
}

/**
 * Appends a single registration row to the event's tab.
 * Called after payment confirmation (paid events) or immediately (free events).
 */
export async function appendRegistrationRow(
    spreadsheetId: string,
    sheetTabName: string,
    event: IEvent,
    reg: any,
    refreshToken?: string
): Promise<void> {
    const auth = getAuth(refreshToken);
    const sheets = google.sheets({ version: "v4", auth });
    const maxMembers = event.isTeamEvent ? (event.teamSize?.max ?? 0) : 0;

    const existing = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: buildRange(sheetTabName, "A1:A1"),
    });

    const rows: string[][] = [];
    if ((existing.data.values?.length ?? 0) === 0) {
        rows.push(buildHeaders(event.customForm ?? [], maxMembers));
    }
    rows.push(buildRow(reg, event.customForm ?? [], maxMembers));

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: buildRange(sheetTabName, "A1"),
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
    });
}

/**
 * Replaces the entire event tab with all current registrations.
 * Called from the manual "Sync Now" button.
 */
export async function syncAllRegistrationsToSheet(
    spreadsheetId: string,
    sheetTabName: string,
    event: IEvent,
    registrations: any[],
    refreshToken?: string
): Promise<void> {
    const auth = getAuth(refreshToken);
    const sheets = google.sheets({ version: "v4", auth });
    const maxMembers = event.isTeamEvent ? (event.teamSize?.max ?? 0) : 0;

    const rows: string[][] = [
        buildHeaders(event.customForm ?? [], maxMembers),
        ...registrations.map((r) => buildRow(r, event.customForm ?? [], maxMembers)),
    ];

    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: buildRange(sheetTabName, "A:Z"),
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: buildRange(sheetTabName, "A1"),
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
    });
}
