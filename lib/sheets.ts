// lib/sheets.ts
// Google Sheets helper using OAuth2 with a stored refresh token.
// No service account or GCP billing required — works with any sheet
// the authorizing Google account has editor access to.
//
// Required env vars (all already present or added once):
//   GOOGLE_CLIENT_ID         — from Google Cloud OAuth2 credentials
//   GOOGLE_CLIENT_SECRET     — from Google Cloud OAuth2 credentials
//   GOOGLE_REFRESH_TOKEN     — generated once via OAuth2 Playground

import { google } from "googleapis";
import type { IEvent } from "@/types";

function getAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            "Missing Google OAuth credentials. Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are set in .env.local"
        );
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
}

function buildHeaders(customForm: IEvent["customForm"]): string[] {
    return [
        "Registration ID",
        "Name",
        "Email",
        "College ID",
        "Type",
        "Team ID",
        "Status",
        "Payment Status",
        "Registered At",
        ...customForm.map((f) => f.label),
    ];
}

function buildRow(reg: any, customForm: IEvent["customForm"]): string[] {
    const responseMap: Record<string, string> = {};
    for (const r of reg.formResponses ?? []) {
        responseMap[r.fieldId] = String(r.value ?? "");
    }
    return [
        String(reg._id),
        reg.userId?.name ?? "—",
        reg.userId?.email ?? "—",
        reg.userId?.collegeId ?? "—",
        reg.isTeamRegistration ? "Team" : "Individual",
        reg.teamId ?? "—",
        reg.status,
        reg.paymentStatus,
        new Date(reg.createdAt).toLocaleString("en-IN"),
        ...customForm.map((f) => responseMap[String(f._id)] ?? ""),
    ];
}

/**
 * Creates a new Google Sheet for the event in the authorizing user's Drive,
 * writes the header row, and returns the spreadsheet ID.
 */
export async function createEventSheet(
    eventTitle: string,
    customForm: IEvent["customForm"]
): Promise<string> {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const created = await sheets.spreadsheets.create({
        requestBody: {
            properties: { title: `Registrations — ${eventTitle}` },
        },
    });

    const spreadsheetId = created.data.spreadsheetId!;

    // Write header row
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [buildHeaders(customForm)] },
    });

    return spreadsheetId;
}

/**
 * Appends a single registration row to the sheet.
 * Called from the Cashfree webhook after payment confirmation.
 */
export async function appendRegistrationRow(
    sheetId: string,
    event: IEvent,
    reg: any
): Promise<void> {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "A1:A1",
    });

    const rows: string[][] = [];
    if ((existing.data.values?.length ?? 0) === 0) {
        rows.push(buildHeaders(event.customForm ?? []));
    }
    rows.push(buildRow(reg, event.customForm ?? []));

    await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "A1",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
    });
}

/**
 * Replaces the entire sheet with all current registrations.
 * Called from the manual "Sync Now" button.
 */
export async function syncAllRegistrationsToSheet(
    sheetId: string,
    event: IEvent,
    registrations: any[]
): Promise<void> {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const rows: string[][] = [
        buildHeaders(event.customForm ?? []),
        ...registrations.map((r) => buildRow(r, event.customForm ?? [])),
    ];

    await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: "A:Z",
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
    });
}
