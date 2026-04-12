// app/api/admin/download-ticket/route.ts
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Registration, Ticket } from "@/models";
import { requireSuperAdmin, forbiddenResponse, unauthorizedResponse } from "@/lib/auth-helpers";
import { generateTicketQR } from "@/lib/qrcode";
import { formatEventDate } from "@/lib/utils";

export async function GET(req: Request) {
    try {
        await requireSuperAdmin();
    } catch (err: any) {
        if (err.message === "UNAUTHORIZED") return unauthorizedResponse();
        return forbiddenResponse();
    }

    try {
        const { searchParams } = new URL(req.url);
        const identifier = searchParams.get("identifier")?.trim();

        if (!identifier) {
            return Response.json({ success: false, error: "Missing identifier." }, { status: 400 });
        }

        await connectDB();

        let registration: any = await Registration.findOne({ paymentId: identifier })
            .populate("userId", "name email collegeId")
            .populate("eventId", "title date venue");

        if (!registration && mongoose.isValidObjectId(identifier)) {
            registration = await Registration.findById(identifier)
                .populate("userId", "name email collegeId")
                .populate("eventId", "title date venue");
        }

        if (!registration) {
            return Response.json({ success: false, error: "Registration not found." }, { status: 404 });
        }

        const tickets = await Ticket.find({ registrationId: registration._id }).populate("userId", "name email");
        const event = registration.eventId as any;
        const registrant = registration.userId as any;
        const eventDate = formatEventDate(event.date.start, event.date.end);

        // Build ticket cards with QR data URLs
        const ticketCards: string[] = [];
        for (const ticket of tickets) {
            const qrDataUrl = await generateTicketQR(ticket.qrCode);
            const ticketUser = ticket.userId as any;
            const recipientName = ticketUser?.name ?? (ticket.teamRole === "leader" ? registrant?.name : "Team Member");
            const recipientEmail = ticketUser?.email ?? "";

            ticketCards.push(`
        <div class="ticket-card">
          <div class="ticket-header">
            <div class="brand">Vigyan<span>rang</span></div>
            <div class="role-badge">${ticket.teamRole === "solo" ? "Solo" : ticket.teamRole === "leader" ? "Team Leader" : "Team Member"}</div>
          </div>
          <div class="ticket-body">
            <div class="event-info">
              <div class="event-title">${event.title}</div>
              <div class="event-meta">
                <span>📅 ${eventDate}</span>
                ${event.venue ? `<span>📍 ${event.venue}</span>` : ""}
              </div>
            </div>
            <div class="attendee-info">
              <div class="attendee-name">${recipientName}</div>
              ${recipientEmail ? `<div class="attendee-email">${recipientEmail}</div>` : ""}
              ${registrant?.collegeId && ticket.teamRole !== "member" ? `<div class="college-id">${registrant.collegeId}</div>` : ""}
            </div>
            <div class="qr-section">
              <img src="${qrDataUrl}" alt="QR Code" class="qr-code" />
              <div class="ticket-id">${ticket.qrCode}</div>
            </div>
          </div>
          <div class="ticket-footer">
            Show this QR code at the entrance &nbsp;·&nbsp; Do not share
          </div>
        </div>
      `);
        }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tickets — ${event.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f4f4f5;
      padding: 32px 16px;
      color: #18181b;
    }
    h1 {
      text-align: center;
      font-size: 13px;
      color: #71717a;
      margin-bottom: 24px;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .tickets-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 480px;
      margin: 0 auto;
    }
    .ticket-card {
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      border: 1px solid #e4e4e7;
      page-break-inside: avoid;
    }
    .ticket-header {
      background: #18181b;
      color: white;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .brand span { color: #f97316; }
    .role-badge {
      font-size: 11px;
      font-weight: 600;
      background: rgba(255,255,255,0.15);
      padding: 3px 10px;
      border-radius: 999px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .ticket-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .event-title {
      font-size: 18px;
      font-weight: 700;
      color: #18181b;
      line-height: 1.3;
    }
    .event-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 6px;
      font-size: 13px;
      color: #71717a;
    }
    .attendee-name {
      font-size: 15px;
      font-weight: 600;
      color: #18181b;
    }
    .attendee-email, .college-id {
      font-size: 12px;
      color: #71717a;
      margin-top: 2px;
    }
    .qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px 0;
    }
    .qr-code {
      width: 180px;
      height: 180px;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      padding: 8px;
    }
    .ticket-id {
      font-size: 10px;
      font-family: 'Courier New', monospace;
      color: #a1a1aa;
      letter-spacing: 0.05em;
    }
    .ticket-footer {
      border-top: 1px dashed #e4e4e7;
      padding: 10px 20px;
      font-size: 11px;
      color: #a1a1aa;
      text-align: center;
    }
    @media print {
      body { background: white; padding: 0; }
      .ticket-card { box-shadow: none; border: 1px solid #e4e4e7; margin-bottom: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} — ${event.title}</h1>
  <div class="no-print" style="text-align:center; margin-bottom: 20px;">
    <button onclick="window.print()" style="background:#18181b;color:white;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.02em;">
      Print / Save as PDF
    </button>
  </div>
  <div class="tickets-grid">
    ${ticketCards.join("\n")}
  </div>
</body>
</html>`;

        return new Response(html, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Content-Disposition": `attachment; filename="tickets-${identifier}.html"`,
            },
        });
    } catch (err: any) {
        console.error("[admin/download-ticket]", err);
        return Response.json({ success: false, error: "Internal server error." }, { status: 500 });
    }
}
