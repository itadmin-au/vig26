// models/User.ts
import mongoose, { Schema, Document, Model } from "mongoose";
import type { IUser } from "@/types";

export interface IUserDocument extends Omit<IUser, "_id">, Document {}

const UserSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["student", "coordinator", "dept_admin", "super_admin"],
      default: "student",
    },
    collegeId: {
      type: String,
      trim: true,
      default: null,
    },
    departments: [
      {
        type: Schema.Types.ObjectId,
        ref: "Department",
      },
    ],
    registeredEvents: [
      {
        type: Schema.Types.ObjectId,
        ref: "Registration",
      },
    ],
    // ── Password reset ────────────────────────────────────────────────────────
    passwordResetToken: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent returning sensitive fields in JSON responses
UserSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    return ret;
  },
});

const User: Model<IUserDocument> =
  mongoose.models.User ?? mongoose.model<IUserDocument>("User", UserSchema);

export default User;