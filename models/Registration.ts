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
                userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
            },
        ],
        teamId: {
            type: String,
            default: null,
            index: true,
        },
        paymentId: {
            type: String,
            default: null,
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

// ─── Post-save: increment event's registrationCount ──────────────────────────
RegistrationSchema.post("save", async function () {
    if (this.status === "confirmed") {
        const Event = mongoose.model("Event");
        await Event.findByIdAndUpdate(this.eventId, {
            $inc: { registrationCount: 1 },
        });
    }
});

// ─── Post-save: decrement on cancellation ────────────────────────────────────
RegistrationSchema.post("findOneAndUpdate", async function (doc) {
    if (doc?.status === "cancelled") {
        const Event = mongoose.model("Event");
        await Event.findByIdAndUpdate(doc.eventId, {
            $inc: { registrationCount: -1 },
        });
    }
});

const Registration: Model<IRegistrationDocument> =
    mongoose.models.Registration ??
    mongoose.model<IRegistrationDocument>("Registration", RegistrationSchema);

export default Registration;