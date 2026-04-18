import mongoose, { Schema, Document, Model } from "mongoose";
import type { IRegistration } from "@/types";

export interface IRegistrationDocument
    extends Omit<IRegistration, "_id">,
    Document { }

const RegistrationSchema = new Schema<IRegistrationDocument>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: "Event",
            required: true,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        formResponses: [
            {
                fieldId: { type: String, required: true },
                value: { type: Schema.Types.Mixed, required: true },
            },
        ],
        isTeamRegistration: {
            type: Boolean,
            default: false,
        },
        teamMembers: [
            {
                name: { type: String, required: true, trim: true },
                email: { type: String, required: true, lowercase: true, trim: true },
                usn: { type: String, default: null, trim: true },
                userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
            },
        ],
        teamId: {
            type: String,
            default: null,
            index: true,
        },
        slotId: {
            type: Schema.Types.ObjectId,
            default: null,
        },
        paymentId: {
            type: String,
            default: null,
        },
        addMemberOrderIds: {
            type: [String],
            default: [],
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "completed", "failed", "na"],
            default: "na",
        },
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled"],
            default: "pending",
        },
    },
    {
        timestamps: true,
    }
);

// ─── Compound index: one registration per user per event ─────────────────────
RegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

// ─── Unique index: one registration per paymentId (prevents race-condition duplicates) ──
RegistrationSchema.index({ paymentId: 1 }, { unique: true, sparse: true });

// ─── Post-save: decrement on cancellation ────────────────────────────────────
RegistrationSchema.post("findOneAndUpdate", async function (doc) {
    if (doc?.status === "cancelled") {
        const Event = mongoose.model("Event");
        await Event.findByIdAndUpdate(doc.eventId, {
            $inc: { registrationCount: -1 },
        });
        if (doc.slotId) {
            await Event.findByIdAndUpdate(
                doc.eventId,
                { $inc: { "slots.$[slot].registrationCount": -1 } },
                { arrayFilters: [{ "slot._id": doc.slotId }] }
            );
        }
    }
});

const Registration: Model<IRegistrationDocument> =
    mongoose.models.Registration ??
    mongoose.model<IRegistrationDocument>("Registration", RegistrationSchema);

export default Registration;