import mongoose, { Schema, Document, Model } from "mongoose";
import type { IEvent } from "@/types";
import { slugify } from "@/lib/utils";

export interface IEventDocument extends Omit<IEvent, "_id">, Document {}

// ─── FormField Sub-schema ────────────────────────────────────────────────────
const FormFieldSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["short_text", "long_text", "dropdown", "checkbox", "file_upload"],
      required: true,
    },
    placeholder: { type: String, default: null },
    isRequired: { type: Boolean, default: false },
    options: { type: [String], default: [] }, // for dropdown
    order: { type: Number, required: true, default: 0 },
  },
  { _id: true }
);

// ─── Event Schema ────────────────────────────────────────────────────────────
const EventSchema = new Schema<IEventDocument>(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: null,
    },
    coverImage: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ["inter", "intra"],
      required: [true, "Event type (inter/intra) is required"],
    },
    category: {
      type: String,
      required: [true, "Event category is required"],
      trim: true,
      lowercase: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      start: { type: Date, required: [true, "Start date is required"] },
      end: { type: Date, required: [true, "End date is required"] },
    },
    venue: {
      type: String,
      trim: true,
      default: null,
    },
    capacity: {
      type: Number,
      default: 0, // 0 = unlimited
      min: 0,
    },
    price: {
      type: Number,
      default: 0, // 0 = free
      min: 0,
    },
    rules: {
      type: String,
      default: null,
    },
    isTeamEvent: {
      type: Boolean,
      default: false,
    },
    teamSize: {
      min: { type: Number, default: 2 },
      max: { type: Number, default: 5 },
    },
    customForm: {
      type: [FormFieldSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "published", "cancelled"],
      default: "draft",
    },
    registrationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtual: remainingSlots ─────────────────────────────────────────────────
EventSchema.virtual("remainingSlots").get(function () {
  if (this.capacity === 0) return null; // unlimited
  return Math.max(0, this.capacity - this.registrationCount);
});

// ─── Virtual: isFree ─────────────────────────────────────────────────────────
EventSchema.virtual("isFree").get(function () {
  return this.price === 0;
});

// ─── Pre-save: auto-generate unique slug from title ──────────────────────────
EventSchema.pre("save", async function () {
  if (!this.isModified("title") && this.slug) return;

  const base = slugify(this.title);
  let slug = base;
  let count = 1;

  // Keep appending -n until slug is unique
  while (await (this.constructor as Model<IEventDocument>).exists({ slug, _id: { $ne: this._id } })) {
    slug = `${base}-${count++}`;
  }

  this.slug = slug;
});

const Event: Model<IEventDocument> =
  mongoose.models.Event ?? mongoose.model<IEventDocument>("Event", EventSchema);

export default Event;