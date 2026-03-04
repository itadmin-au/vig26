import mongoose, { Schema, Document, Model } from "mongoose";
import type { IDepartment } from "@/types";

export interface IDepartmentDocument extends Omit<IDepartment, "_id">, Document { }

const DepartmentSchema = new Schema<IDepartmentDocument>(
    {
        name: {
            type: String,
            required: [true, "Department name is required"],
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
            default: null,
        },
        logo: {
            type: String,
            default: null,
        },
        members: [
            {
                userId: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                role: {
                    type: String,
                    enum: ["dept_admin", "coordinator"],
                    required: true,
                },
            },
        ],
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Department: Model<IDepartmentDocument> =
    mongoose.models.Department ??
    mongoose.model<IDepartmentDocument>("Department", DepartmentSchema);

export default Department;