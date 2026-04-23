// app/api/events/[id]/export/route.ts
// GET — generates an XLSX file with a branded header (logos + college name) and registration data.

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Registration, Ticket } from "@/models";
import { requireManagement, unauthorizedResponse } from "@/lib/auth-helpers";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireManagement();
    } catch {
        return unauthorizedResponse();
    }

    try {
        const { id } = await params;
        await connectDB();

        const event = await Event.findById(id).lean();
        if (!event) {
            return Response.json({ error: "Event not found" }, { status: 404 });
        }

        const registrations = await Registration.find({ eventId: id })
            .populate("userId", "name email collegeId")
            .sort({ createdAt: 1 })
            .lean();

        const regIds = registrations.map((r: any) => r._id);
        const tickets = await Ticket.find({ registrationId: { $in: regIds } })
            .select("registrationId attendanceStatus teamRole")
            .lean();

        const ticketsByReg = new Map<string, any[]>();
        for (const t of tickets) {
            const key = (t.registrationId as any).toString();
            if (!ticketsByReg.has(key)) ticketsByReg.set(key, []);
            ticketsByReg.get(key)!.push(t);
        }

        const enrichedRegs = registrations.map((r: any) => ({
            ...r,
            tickets: ticketsByReg.get(r._id.toString()) ?? [],
        }));

        // ─── Column structure (mirrors Google Sheet / CSV export) ─────────────────

        const customFields: any[] = (event as any).customForm ?? [];
        const maxMembers = (event as any).isTeamEvent ? ((event as any).teamSize?.max ?? 0) : 0;

        const memberColHeaders: string[] = [];
        for (let i = 1; i <= maxMembers; i++) {
            memberColHeaders.push(`Member ${i} Name`, `Member ${i} Email`, `Member ${i} College ID`);
        }

        const columnHeaders = [
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
            ...customFields.map((f: any) => f.label),
            ...memberColHeaders,
        ];

        const totalCols = columnHeaders.length;

        // ─── Workbook setup ──────────────────────────────────────────────────────

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet((event as any).title, {
            pageSetup: { paperSize: 9, orientation: "landscape" },
        });

        // Column widths
        for (let i = 1; i <= totalCols; i++) {
            sheet.getColumn(i).width = 20;
        }
        sheet.getColumn(1).width = 30; // Registration ID
        sheet.getColumn(2).width = 22; // Name
        sheet.getColumn(3).width = 28; // Email

        // ─── Header rows ─────────────────────────────────────────────────────────

        // Row 1: logo row (images overlaid here)
        const logoRow = sheet.addRow(Array(totalCols).fill(""));
        logoRow.height = 72;
        sheet.mergeCells(1, 1, 1, totalCols);

        // Row 2: college name
        const titleRow = sheet.addRow(Array(totalCols).fill(""));
        titleRow.height = 32;
        sheet.mergeCells(2, 1, 2, totalCols);
        const titleCell = sheet.getCell(2, 1);
        titleCell.value = "Atria Institute of Technology";
        titleCell.font = { name: "Times New Roman", bold: true, size: 18 };
        titleCell.alignment = { horizontal: "center", vertical: "middle" };

        // Row 3: thin coloured separator
        const sepRow = sheet.addRow(Array(totalCols).fill(""));
        sepRow.height = 5;
        sheet.mergeCells(3, 1, 3, totalCols);
        sheet.getCell(3, 1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD4D4D4" },
        };

        // Row 4: column headers
        const headerRow = sheet.addRow(columnHeaders);
        headerRow.height = 22;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C1C1C" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
        });

        // ─── Data rows ───────────────────────────────────────────────────────────

        let rowIndex = 0;
        for (const reg of enrichedRegs) {
            const responseMap: Record<string, string> = {};
            for (const r of (reg.formResponses ?? [])) {
                responseMap[r.fieldId] = r.value ?? "";
            }

            const additionalMembers = reg.teamMembers ?? [];
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

            const values = [
                reg._id.toString(),
                reg.userId?.name ?? "—",
                reg.userId?.email ?? "—",
                reg.userId?.collegeId ?? "—",
                reg.isTeamRegistration ? "Team" : "Individual",
                reg.teamId ?? "—",
                reg.isTeamRegistration ? String(additionalMembers.length + 1) : "1",
                reg.status,
                reg.paymentStatus,
                new Date(reg.createdAt).toLocaleString("en-IN"),
                ...customFields.map((f: any) => responseMap[f._id?.toString()] ?? ""),
                ...memberCells,
            ];

            const dataRow = sheet.addRow(values);
            dataRow.height = 18;
            dataRow.eachCell((cell) => {
                cell.font = { size: 10 };
                cell.alignment = { vertical: "middle" };
                if (rowIndex % 2 !== 0) {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
                }
            });

            rowIndex++;
        }

        // ─── Logos ───────────────────────────────────────────────────────────────

        const atriaPath = path.join(process.cwd(), "public", "atria_bg.png");
        const vigyaanrangPath = path.join(process.cwd(), "public", "vigyaanrang.png");

        if (fs.existsSync(atriaPath)) {
            const imgId = workbook.addImage({ filename: atriaPath, extension: "png" });
            sheet.addImage(imgId, {
                tl: { col: 0, row: 0 } as any,
                br: { col: 2, row: 1 } as any,
                editAs: "oneCell",
            } as any);
        }

        if (fs.existsSync(vigyaanrangPath)) {
            const imgId = workbook.addImage({ filename: vigyaanrangPath, extension: "png" });
            sheet.addImage(imgId, {
                tl: { col: totalCols - 2, row: 0 } as any,
                br: { col: totalCols, row: 1 } as any,
                editAs: "oneCell",
            } as any);
        }

        // ─── Response ─────────────────────────────────────────────────────────────

        const buffer = await workbook.xlsx.writeBuffer();
        const safeName = ((event as any).title as string).replace(/[^a-z0-9]/gi, "-").toLowerCase();

        return new Response(buffer as ArrayBuffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${safeName}-registrations.xlsx"`,
            },
        });
    } catch (err: any) {
        console.error("[export-xlsx]", err?.message);
        return Response.json({ error: "Export failed." }, { status: 500 });
    }
}
