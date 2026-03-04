import QRCode from "qrcode";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vigyanrang.com";

/**
 * Generate a QR code as a base64 PNG data URL.
 * The QR encodes a verify URL: /verify/:qrToken
 */
export async function generateTicketQR(qrToken: string): Promise<string> {
  const url = `${APP_URL}/verify/${qrToken}`;

  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    width: 400,
    margin: 2,
    color: {
      dark: "#18181B",  // zinc-900
      light: "#FFFFFF",
    },
  });

  return dataUrl; // "data:image/png;base64,..."
}

/**
 * Generate a QR code as a raw Buffer (useful for email attachments).
 */
export async function generateTicketQRBuffer(qrToken: string): Promise<Buffer> {
  const url = `${APP_URL}/verify/${qrToken}`;
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: "H",
    width: 400,
    margin: 2,
  });
}

/**
 * Get the verify URL for a given QR token (for embedding in emails).
 */
export function getVerifyUrl(qrToken: string): string {
  return `${APP_URL}/verify/${qrToken}`;
}