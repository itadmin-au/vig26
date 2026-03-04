// lib/email.ts
import { Resend } from "resend";
import { generateTicketQRBuffer } from "@/lib/qrcode";

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM = "Vigyanrang <vigyanrang@orbit.tripodhub.in>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vigyanrang.com";

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
      <div style="background-color: #f9fafb; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #D97706; margin-top: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">Vigyanrang</h2>
          <div style="height: 1px; background-color: #f3f4f6; margin: 24px 0;"></div>
          <p style="font-size: 16px; line-height: 24px; color: #374151; margin-bottom: 16px;">Hi ${name},</p>
          <p style="font-size: 16px; line-height: 24px; color: #374151; margin-bottom: 16px;">
            <span style="font-weight: 600; color: #111827;">${invitedBy}</span> has invited you to join 
            <span style="font-weight: 600; color: #111827;">${departmentName}</span> as a 
            <span style="font-weight: 600; color: #111827;">${role}</span>.
          </p>
          <p style="font-size: 16px; line-height: 24px; color: #374151; margin-bottom: 32px;">
            Click the button below to accept the invite and set your password. This link expires in 72 hours.
          </p>
          <a href="${link}" style="display: inline-block; background-color: #18181B; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; text-align: center;">
            Accept Invitation
          </a>
          <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f3f4f6;">
            <p style="color: #9ca3af; font-size: 13px; line-height: 20px; margin: 0;">
              If you weren't expecting this invite, you can safely ignore this email.
            </p>
          </div>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
          Sent by <a href="${APP_URL}" style="color: #9ca3af; text-decoration: underline;">Vigyanrang</a>
        </p>
      </div>
    `,
  });
}

export async function sendTicketConfirmationEmail({
  to,
  name,
  eventTitle,
  eventDate,
  venue,
  ticketId,
}: {
  to: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  venue?: string;
  /** qrDataUrl is no longer used — QR is generated fresh from ticketId */
  qrDataUrl?: string;
  ticketId: string;
}) {
  const dashboardLink = `${APP_URL}/dashboard`;
  const cid = "qrcode@vigyanrang";

  // Generate QR as a PNG buffer (works in all email clients via CID attachment)
  const qrBuffer = await generateTicketQRBuffer(ticketId);

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your ticket for ${eventTitle} — Vigyanrang`,
    attachments: [
      {
        filename: "ticket-qr.png",
        content: qrBuffer,
        contentType: "image/png",
        contentId: cid,
      },
    ],
    html: `
      <div style="background-color: #f9fafb; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #D97706; margin-top: 0; font-size: 24px; font-weight: 700;">Vigyanrang</h2>
          <div style="height: 1px; background-color: #f3f4f6; margin: 24px 0;"></div>
          <p style="font-size: 16px; color: #374151;">Hi ${name}, you're registered! ✓</p>

          <!-- Event card -->
          <div style="background-color: #fffaf5; border: 1px solid #ffedd5; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #111827;">${eventTitle}</h3>
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 6px 0; display: flex; align-items: center; gap: 6px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${eventDate}
            </p>
            ${venue ? `<p style="color: #6b7280; font-size: 14px; margin: 6px 0 0 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${venue}
            </p>` : ""}
          </div>

          <!-- QR code inline via CID -->
          <div style="text-align: center; margin: 32px 0;">
            <p style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 16px;">Your Entry QR Code</p>
            <img
              src="cid:${cid}"
              alt="QR Code"
              width="200"
              height="200"
              style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; display: block; margin: 0 auto;"
            />
            <p style="color: #9ca3af; font-size: 11px; margin-top: 12px; font-family: monospace;">
              Ticket ID: ${ticketId}
            </p>
          </div>

          <p style="font-size: 14px; color: #6b7280; text-align: center; margin-bottom: 28px;">
            Show this QR code at the entrance for a smooth check-in.<br/>
            If the QR is not visible, open the attached <strong>ticket-qr.png</strong> file.
          </p>

          <div style="text-align: center;">
            <a href="${dashboardLink}" style="display: inline-block; background-color: #18181B; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View My Tickets
            </a>
          </div>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
          Sent by <a href="${APP_URL}" style="color: #9ca3af; text-decoration: underline;">Vigyanrang</a>
        </p>
      </div>
    `,
  });
}

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
      <div style="background-color: #f9fafb; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #D97706; margin-top: 0; font-size: 24px; font-weight: 700;">Vigyanrang</h2>
          <div style="height: 1px; background-color: #f3f4f6; margin: 24px 0;"></div>
          <p style="font-size: 16px; color: #374151;">Hi ${memberName},</p>
          <p style="font-size: 16px; line-height: 24px; color: #374151;">
            Great news! <span style="font-weight: 600; color: #111827;">${leaderName}</span> has registered you as a team member for <strong>${eventTitle}</strong>.
          </p>
          <p style="font-size: 16px; color: #374151; margin: 24px 0;">To access your ticket and event details, please create your Vigyanrang account:</p>
          <a href="${signupLink}" style="display: inline-block; background-color: #18181B; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Create My Account
          </a>
          <div style="margin-top: 32px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
            <p style="color: #4b5563; font-size: 13px; margin: 0; line-height: 20px;">
              <strong>Important:</strong> Use the same email address this was sent to (${to}) when signing up so your ticket is linked correctly.
            </p>
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({
  to,
  name,
  token,
}: {
  to: string;
  name: string;
  token: string;
}) {
  const resetLink = `${APP_URL}/auth/reset-password/${token}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Vigyanrang password",
    html: `
      <div style="background-color: #f9fafb; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #D97706; margin-top: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">Vigyanrang</h2>
          <div style="height: 1px; background-color: #f3f4f6; margin: 24px 0;"></div>
          <p style="font-size: 16px; line-height: 24px; color: #374151; margin-bottom: 16px;">Hi ${name},</p>
          <p style="font-size: 16px; line-height: 24px; color: #374151; margin-bottom: 32px;">
            We received a request to reset your password. Click the button below to choose a new one.
            This link expires in <strong>1 hour</strong>.
          </p>
          <a href="${resetLink}" style="display: inline-block; background-color: #18181B; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Reset Password
          </a>
          <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f3f4f6;">
            <p style="color: #9ca3af; font-size: 13px; line-height: 20px; margin: 0;">
              If you didn't request a password reset, you can safely ignore this email — your password will not change.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 12px; word-break: break-all;">
              Or copy this link: ${resetLink}
            </p>
          </div>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
          Sent by <a href="${APP_URL}" style="color: #9ca3af; text-decoration: underline;">Vigyanrang</a>
        </p>
      </div>
    `,
  });
}