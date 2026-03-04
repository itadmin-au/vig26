import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from "crypto";
import bcrypt from "bcryptjs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Slug ─────────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")   // remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, "-")    // replace spaces and underscores with hyphens
    .replace(/--+/g, "-")       // collapse multiple hyphens
    .replace(/^-+|-+$/g, "");   // trim leading/trailing hyphens
}

// ─── Password ─────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Invite Token ─────────────────────────────────────────────────────────────

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getInviteExpiry(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 72); // 72 hours from now
  return d;
}

// ─── QR Code (ticket identifier) ─────────────────────────────────────────────

export function generateQRToken(): string {
  return crypto.randomUUID();
}

// ─── Team ID ──────────────────────────────────────────────────────────────────

export function generateTeamId(): string {
  return crypto.randomUUID();
}

// ─── Currency formatting ──────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency = "INR"): string {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatEventDate(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  };

  const startStr = new Intl.DateTimeFormat("en-IN", opts).format(new Date(start));

  // If same day, show only time for end
  const sameDay =
    new Date(start).toDateString() === new Date(end).toDateString();

  if (sameDay) {
    const timeOpts: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    };
    const endTime = new Intl.DateTimeFormat("en-IN", timeOpts).format(new Date(end));
    return `${startStr} – ${endTime} IST`;
  }

  const endStr = new Intl.DateTimeFormat("en-IN", opts).format(new Date(end));
  return `${startStr} – ${endStr} IST`;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isExpired(date: Date): boolean {
  return new Date(date) < new Date();
}

// ─── Serialize MongoDB documents ──────────────────────────────────────────────
// Mongoose documents contain non-serializable ObjectIds; use this before passing
// to client components or returning from Server Actions.

export function serialize<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export function getPaginationParams(page = 1, limit = 12) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;
  return { page: safePage, limit: safeLimit, skip };
}