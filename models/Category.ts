import mongoose, { Schema, Document, Model } from "mongoose";
import type { ICategory } from "@/types";

export interface ICategoryDocument extends Omit<ICategory, "_id">, Document { }

const CategorySchema = new Schema<ICategoryDocument>(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            unique: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

const Category: Model<ICategoryDocument> =
    mongoose.models.Category ??
    mongoose.model<ICategoryDocument>("Category", CategorySchema);

export default Category;