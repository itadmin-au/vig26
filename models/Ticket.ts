import mongoose, { Schema, Document, Model } from "mongoose";
import type { ITicket } from "@/types";

export interface ITicketDocument extends Omit<ITicket, "_id">, Document { }

const TicketSchema = new Schema<ITicketDocument>(
    {
        registrationId: {
            type: Schema.Types.ObjectId,
            ref: "Registration",
            required: true,
            index: true,
        },
        eventId: {
            type: Schema.Types.ObjectId,
            ref: "Event",
            required: true,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: false,
            index: true,
        },
        qrCode: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        teamRole: {
            type: String,
            enum: ["leader", "member", "solo"],
            default: "solo",
        },
        teamId: {
            type: String,
            default: null,
            index: true,
        },
        attendanceStatus: {
            type: Boolean,
            default: false,
        },
        checkedInAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Ticket: Model<ITicketDocument> =
    mongoose.models.Ticket ?? mongoose.model<ITicketDocument>("Ticket", TicketSchema);

export default Ticket;