import mongoose, { Schema, Document, Model } from "mongoose";
import type { IInvite } from "@/types";

export interface IInviteDocument extends Omit<IInvite, "_id">, Document { }

const InviteSchema = new Schema<IInviteDocument>(
    {
        email: {
            type: String,
            required: [true, "Email is required"],
            lowercase: true,
            trim: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
        },
        role: {
            type: String,
            enum: ["coordinator", "dept_admin"],
            required: true,
        },
        departmentId: {
            type: Schema.Types.ObjectId,
            ref: "Department",
            required: true,
        },
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        token: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "cancelled"],
            default: "pending",
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// Auto-expire documents after expiresAt using MongoDB TTL index
// (documents are NOT auto-deleted — we keep them for audit; status is checked at runtime)
InviteSchema.index({ expiresAt: 1 });

const Invite: Model<IInviteDocument> =
    mongoose.models.Invite ?? mongoose.model<IInviteDocument>("Invite", InviteSchema);

export default Invite;