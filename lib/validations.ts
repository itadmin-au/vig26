// lib/validations.ts
import { z } from "zod";

export const signupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").trim(),
    email: z.string().email("Invalid email address").toLowerCase().trim(),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain at least one uppercase letter")
        .regex(/[0-9]/, "Must contain at least one number"),
    collegeId: z.string().trim().min(1, "USN is required"),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email address").toLowerCase().trim(),
    password: z.string().min(1, "Password is required"),
});

export const acceptInviteSchema = z
    .object({
        token: z.string().min(1),
        password: z
            .string()
            .min(8, "Password must be at least 8 characters")
            .regex(/[A-Z]/, "Must contain at least one uppercase letter")
            .regex(/[0-9]/, "Must contain at least one number"),
        confirmPassword: z.string().min(1),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

export const sendInviteSchema = z.object({
    name: z.string().min(2).trim(),
    email: z.string().email().toLowerCase().trim(),
    role: z.enum(["coordinator", "dept_admin"]),
    departmentId: z.string().min(1, "Department is required"),
});

export const createDepartmentSchema = z.object({
    name: z.string().min(2, "Department name must be at least 2 characters").trim(),
    description: z.string().trim().optional(),
});

export const createCategorySchema = z.object({
    name: z.string().min(2, "Category name must be at least 2 characters").trim(),
});

export const eventSlotSchema = z.object({
    _id: z.string().optional(),
    label: z.string().trim().optional(),
    start: z.string().datetime({ message: "Invalid slot start date" }),
    end: z.string().datetime({ message: "Invalid slot end date" }),
    capacity: z.number().int().min(0).default(0),
});

export const formFieldSchema = z.object({
    label: z.string().min(1, "Field label is required").trim(),
    type: z.enum(["short_text", "long_text", "dropdown", "checkbox", "file_upload"]),
    placeholder: z.string().trim().optional(),
    isRequired: z.boolean().default(false),
    options: z.array(z.string().trim().min(1)).optional(),
    order: z.number().int().min(0),
});

const eventBaseSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").trim(),
    description: z.string().trim().optional(),
    coverImage: z.string().url().optional().or(z.literal("")),
    type: z.enum(["inter", "intra"]),
    category: z.string().min(1, "Category is required").toLowerCase().trim(),
    departmentId: z.string().min(1, "Department is required"),
    dateStart: z.string().datetime({ message: "Invalid start date" }),
    dateEnd: z.string().datetime({ message: "Invalid end date" }),
    venue: z.string().trim().optional(),
    capacity: z.number().int().min(0).default(0),
    price: z.number().min(0).default(0),
    rules: z.string().trim().optional(),
    isTeamEvent: z.boolean().default(false),
    teamSizeMin: z.number().int().min(2).optional(),
    teamSizeMax: z.number().int().min(2).optional(),
    customForm: z.array(formFieldSchema).default([]),
    slots: z.array(eventSlotSchema).default([]),
    status: z.enum(["draft", "published"]).default("draft"),
});

export const createEventSchema = eventBaseSchema
    .refine(
        (d) => new Date(d.dateEnd) > new Date(d.dateStart),
        { message: "End date must be after start date", path: ["dateEnd"] }
    )
    .refine(
        (d) => !d.isTeamEvent || (d.teamSizeMin !== undefined && d.teamSizeMax !== undefined),
        { message: "Team size min and max are required for team events", path: ["teamSizeMin"] }
    )
    .refine(
        (d) =>
            !d.isTeamEvent ||
            (d.teamSizeMin !== undefined &&
                d.teamSizeMax !== undefined &&
                d.teamSizeMax >= d.teamSizeMin),
        { message: "Max team size must be >= min team size", path: ["teamSizeMax"] }
    );

export const updateEventSchema = eventBaseSchema
    .partial()
    .extend({
        status: z.enum(["draft", "published", "cancelled"]).optional(),
    });

export const teamMemberSchema = z.object({
    name: z.string().min(2).trim(),
    email: z.string().email().toLowerCase().trim(),
});

export const formResponseSchema = z.object({
    fieldId: z.string().min(1),
    value: z.union([z.string(), z.array(z.string()), z.boolean()]),
});

export const createRegistrationSchema = z.object({
    eventId: z.string().min(1),
    slotId: z.string().optional(),
    teamMembers: z.array(teamMemberSchema).default([]),
    formResponses: z.array(formResponseSchema).default([]),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type SendInviteInput = z.infer<typeof sendInviteSchema>;
export type EventSlotInput = z.infer<typeof eventSlotSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type FormFieldInput = z.infer<typeof formFieldSchema>;