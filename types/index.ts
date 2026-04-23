import { Types } from "mongoose";

// ─── Enums & Literals ────────────────────────────────────────────────────────

export type UserRole = "student" | "coordinator" | "dept_admin" | "super_admin";

export type EventType = "inter" | "intra";

export type EventStatus = "draft" | "published" | "cancelled";

export type PaymentStatus = "pending" | "completed" | "failed" | "na";

export type RegistrationStatus = "pending" | "confirmed" | "cancelled";

export type InviteStatus = "pending" | "accepted" | "cancelled";

export type TeamRole = "leader" | "member" | "solo";

export type FormFieldType =
    | "short_text"
    | "long_text"
    | "dropdown"
    | "checkbox"
    | "file_upload";

// ─── Sub-documents ───────────────────────────────────────────────────────────

export interface IFormField {
    _id: string;
    label: string;
    type: FormFieldType;
    placeholder?: string;
    isRequired: boolean;
    /** Only for dropdown — list of option strings */
    options?: string[];
    /** Order index for drag-and-drop sorting */
    order: number;
}

export interface ITeamSize {
    min: number;
    max: number;
}

export interface IEventDate {
    start: Date;
    end: Date;
}

export interface IEventSlot {
    _id: string;
    label?: string;
    start: Date;
    end: Date;
    /** 0 = unlimited */
    capacity: number;
    registrationCount: number;
}

export interface IEventRound {
    _id: string;
    /** e.g. "Round 1", "Preliminary Round", "Finals" */
    label: string;
    start: Date;
    end: Date;
    /** Optional venue specific to this round */
    venue?: string;
    /** Optional notes about what happens in this round */
    description?: string;
}

export interface IDepartmentMember {
    userId: Types.ObjectId | string;
    role: "dept_admin" | "coordinator";
}

export interface IFormResponse {
    fieldId: string;
    value: string | string[] | boolean;
}

export interface ITeamMember {
    name: string;
    email: string;
    usn?: string | null;
    /** Populated once the invitee creates their account */
    userId?: Types.ObjectId | string;
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface IUser {
    _id: Types.ObjectId | string;
    name: string;
    email: string;
    passwordHash?: string;
    googleId?: string;
    role: UserRole;
    collegeId?: string;
    departments: (Types.ObjectId | string)[];
    registeredEvents: (Types.ObjectId | string)[];
    passwordResetToken?: string | null;
    passwordResetExpires?: Date | null;
    googleSheetsRefreshToken?: string | null;
    createdAt: Date;
    updatedAt: Date;
}




// ─── Department ──────────────────────────────────────────────────────────────

export interface IDepartment {
    _id: Types.ObjectId | string;
    name: string;
    description?: string;
    /** Cloudinary URL — optional */
    logo?: string;
    members: IDepartmentMember[];
    createdBy: Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Category ────────────────────────────────────────────────────────────────

export interface ICategory {
    _id: Types.ObjectId | string;
    name: string;
    /** URL-safe slug e.g. "e-sports" */
    slug: string;
    /** true for the 6 built-in categories (cannot be deleted) */
    isDefault: boolean;
    /** Only set for custom categories */
    createdBy?: Types.ObjectId | string;
    /** Shared Google Spreadsheet ID for all events in this category */
    googleSheetId?: string;
    /** User who created the category spreadsheet (for refresh token lookup) */
    sheetOwner?: Types.ObjectId | string;
    createdAt: Date;
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface IEvent {
    _id: Types.ObjectId | string;
    title: string;
    slug: string;
    description?: string;
    /** Cloudinary URL */
    coverImage?: string;
    type: EventType;
    /** Matches ICategory.slug */
    category: string;
    department: Types.ObjectId | string;
    createdBy: Types.ObjectId | string;
    date: IEventDate;
    venue?: string;
    /** 0 = unlimited */
    capacity: number;
    /** 0 = free */
    price: number;
    /** When true, price is charged per team member (total = price × teamSize) */
    pricePerPerson?: boolean;
    rules?: string;
    isTeamEvent: boolean;
    teamSize?: ITeamSize;
    customForm: IFormField[];
    status: EventStatus;
    /** Maintained by pre/post hooks */
    registrationCount: number;
    /** When true, new registrations are blocked even if event is published */
    registrationsClosed: boolean;
    /** Google Sheets spreadsheet ID (shared across all events in the same category) */
    googleSheetId?: string;
    /** Tab name within the category spreadsheet for this event */
    sheetTabName?: string;
    /** Secret token for the public CSV feed URL */
    csvToken?: string;
    /** WhatsApp group/channel invite link shown after registration */
    whatsappLink?: string;
    /** If set, the Register button links here instead of the internal registration flow */
    externalRegistrationUrl?: string;
    /** Markdown shown at the top of the registration form — useful for multi-step instructions */
    registrationInstructions?: string;
    /** Optional Markdown message on checkout explaining what the fee includes */
    checkoutChargeDetails?: string;
    /** Optional time slots; when present, registrations must pick a slot */
    slots?: IEventSlot[];
    /** Sequential rounds (e.g. prelims, semi-finals, finals) — informational only */
    rounds?: IEventRound[];
    createdAt: Date;
    updatedAt: Date;
}

// ─── Registration ────────────────────────────────────────────────────────────

export interface IRegistration {
    _id: Types.ObjectId | string;
    eventId: Types.ObjectId | string;
    /** Team leader or solo registrant */
    userId: Types.ObjectId | string;
    formResponses: IFormResponse[];
    isTeamRegistration: boolean;
    teamMembers: ITeamMember[];
    /** Shared UUID across all tickets for this registration */
    teamId?: string;
    /** The slot chosen during registration (only when event has slots) */
    slotId?: string;
    paymentId?: string;
    amountPaid?: number;
    addMemberOrderIds?: string[];
    paymentStatus: PaymentStatus;
    status: RegistrationStatus;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Ticket ──────────────────────────────────────────────────────────────────

export interface ITicket {
    _id: Types.ObjectId | string;
    registrationId: Types.ObjectId | string;
    eventId: Types.ObjectId | string;
    userId: Types.ObjectId | string;
    /** Unique UUID used in QR code URL: /verify/:qrCode */
    qrCode: string;
    teamRole: TeamRole;
    teamId?: string;
    attendanceStatus: boolean;
    checkedInAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Invite ──────────────────────────────────────────────────────────────────

export interface IInvite {
    _id: Types.ObjectId | string;
    email: string;
    name: string;
    role: "coordinator" | "dept_admin";
    departmentId: Types.ObjectId | string;
    invitedBy: Types.ObjectId | string;
    /** Secure random token sent in email link */
    token: string;
    status: InviteStatus;
    /** 72 hours from creation */
    expiresAt: Date;
    createdAt: Date;
}

// ─── API Response Envelope ───────────────────────────────────────────────────

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// ─── NextAuth Session Extension ──────────────────────────────────────────────

export interface SessionUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    departments: string[];
    image?: string;
}

// ─── Filter / Query Types ────────────────────────────────────────────────────

export interface EventFilters {
    type?: EventType;
    category?: string;
    search?: string;
    status?: EventStatus;
    departmentId?: string;
    page?: number;
    limit?: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}