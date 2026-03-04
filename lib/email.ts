import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM = "Vigyanrang <noreply@vigyanrang.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vigyanrang.com";

// ─── Management Invite ────────────────────────────────────────────────────────

export async function sendManagementInviteEmail({
    to,
    name,
    departmentName,
    invitedBy,
    token,
    role,
}: {
    to: string;
    name: string;
    departmentName: string;
    invitedBy: string;
    token: string;
    role: string;
}) {
    const link = `${APP_URL}/auth/invite/${token}`;

    await resend.emails.send({
        from: FROM,
        to,
        subject: `You've been invited to join ${departmentName} on Vigyanrang`,
        html: `
      <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #D97706;">Vigyanrang</h2>
        <p>Hi ${name},</p>
        <p><strong>${invitedBy}</strong> has invited you to join <strong>${departmentName}</strong> as a <strong>${role}</strong>.</p>
        <p>Click the button below to accept the invite and set your password. This link expires in 72 hours.</p>
        <a href="${link}" style="display:inline-block;background:#18181B;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Accept Invite</a>
        <p style="color:#71717a;font-size:13px;margin-top:24px;">If you weren't expecting this invite, you can safely ignore this email.</p>
      </div>
    `,
    });
}

// ─── Ticket Confirmation ──────────────────────────────────────────────────────

export async function sendTicketConfirmationEmail({
    to,
    name,
    eventTitle,
    eventDate,
    venue,
    qrDataUrl,
    ticketId,
}: {
    to: string;
    name: string;
    eventTitle: string;
    eventDate: string;
    venue?: string;
    qrDataUrl: string;
    ticketId: string;
}) {
    const dashboardLink = `${APP_URL}/dashboard`;

    await resend.emails.send({
        from: FROM,
        to,
        subject: `Your ticket for ${eventTitle} — Vigyanrang`,
        html: `
      <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #D97706;">Vigyanrang</h2>
        <p>Hi ${name}, you're registered!</p>
        <h3 style="margin-bottom:4px;">${eventTitle}</h3>
        <p style="color:#52525b;margin:0;">${eventDate}${venue ? ` · ${venue}` : ""}</p>
        <div style="margin: 24px 0; text-align: center;">
          <img src="${qrDataUrl}" alt="Your QR ticket" style="width:200px;height:200px;" />
          <p style="color:#71717a;font-size:12px;">Ticket ID: ${ticketId}</p>
        </div>
        <p>Show this QR code at the event entrance for check-in.</p>
        <a href="${dashboardLink}" style="display:inline-block;background:#18181B;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">View My Tickets</a>
      </div>
    `,
    });
}

// ─── Team Member Invite ───────────────────────────────────────────────────────

export async function sendTeamMemberInviteEmail({
    to,
    memberName,
    leaderName,
    eventTitle,
}: {
    to: string;
    memberName: string;
    leaderName: string;
    eventTitle: string;
}) {
    const signupLink = `${APP_URL}/auth/signup`;

    await resend.emails.send({
        from: FROM,
        to,
        subject: `${leaderName} added you to a team for ${eventTitle}`,
        html: `
      <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #D97706;">Vigyanrang</h2>
        <p>Hi ${memberName},</p>
        <p><strong>${leaderName}</strong> has registered you as a team member for <strong>${eventTitle}</strong>.</p>
        <p>Create your Vigyanrang account to access your ticket:</p>
        <a href="${signupLink}" style="display:inline-block;background:#18181B;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Create Account</a>
        <p style="color:#71717a;font-size:13px;margin-top:24px;">Use the same email address this message was sent to.</p>
      </div>
    `,
    });
}