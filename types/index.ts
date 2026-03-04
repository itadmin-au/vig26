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
    /** Populated once the invitee creates their account */
    userId?: Types.ObjectId | string;
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface IUser {
    _id: Types.ObjectId | string;
    name: string;
    email: string;
    /** Null for Google OAuth users */
    passwordHash?: string;
    /** Null for email/password users */
    googleId?: string;
    role: UserRole;
    /** Optional — free text, no format enforced */
    collegeId?: string;
    /** Department ObjectIds this user belongs to */
    departments: (Types.ObjectId | string)[];
    /** Registration ObjectIds */
    registeredEvents: (Types.ObjectId | string)[];
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
    rules?: string;
    isTeamEvent: boolean;
    teamSize?: ITeamSize;
    customForm: IFormField[];
    status: EventStatus;
    /** Maintained by pre/post hooks */
    registrationCount: number;
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
    paymentId?: string;
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