// actions/admin.ts
"use server";

import { connectDB } from "@/lib/db";
import { User, Department, Invite, Event, Registration, Ticket } from "@/models";
import {
    requireSuperAdmin,
    requireManagement,
    requireDepartmentAccess,
    isDeptAdmin,
} from "@/lib/auth-helpers";
import {
    createDepartmentSchema,
    sendInviteSchema,
} from "@/lib/validations";
import {
    generateInviteToken,
    getInviteExpiry,
    serialize,
    hashPassword,
} from "@/lib/utils";
import { sendManagementInviteEmail } from "@/lib/email";

export async function getDepartments() {
    const session = await requireManagement();
    await connectDB();

    let departments;

    if (session.user.role === "super_admin") {
        departments = await Department.find()
            .populate("members.userId", "name email")
            .sort({ name: 1 })
            .lean();
    } else {
        departments = await Department.find({
            _id: { $in: session.user.departments },
        })
            .populate("members.userId", "name email")
            .sort({ name: 1 })
            .lean();
    }

    return serialize(departments);
}

export async function getDepartment(id: string) {
    await requireDepartmentAccess(id);
    await connectDB();

    const department = await Department.findById(id)
        .populate("members.userId", "name email role")
        .lean();

    if (!department) return { success: false, error: "Department not found." };
    return { success: true, data: serialize(department) };
}

export async function createDepartment(input: unknown) {
    const session = await requireSuperAdmin();
    await connectDB();

    const parsed = createDepartmentSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const existing = await Department.findOne({ name: parsed.data.name });
    if (existing) return { success: false, error: "A department with this name already exists." };

    const department = await Department.create({
        ...parsed.data,
        createdBy: session.user.id,
    });
    return { success: true, data: serialize(department) };
}

export async function updateDepartment(id: string, input: unknown) {
    await requireSuperAdmin();
    await connectDB();

    const parsed = createDepartmentSchema.partial().safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const updated = await Department.findByIdAndUpdate(id, parsed.data, {
        returnDocument: "after",
    }).lean();

    if (!updated) return { success: false, error: "Department not found." };
    return { success: true, data: serialize(updated) };
}

export async function deleteDepartment(id: string) {
    await requireSuperAdmin();
    await connectDB();

    await Department.findByIdAndDelete(id);
    return { success: true };
}

export async function getDepartmentMembers(departmentId: string) {
    await requireDepartmentAccess(departmentId);
    await connectDB();

    const department = await Department.findById(departmentId)
        .populate("members.userId", "name email role")
        .lean();

    if (!department) return { success: false, error: "Department not found." };

    const pendingInvites = await Invite.find({
        departmentId,
        status: "pending",
    }).lean();

    return {
        success: true,
        data: {
            members: serialize(department.members),
            pendingInvites: serialize(pendingInvites),
        },
    };
}

export async function sendInvite(input: unknown) {
    const session = await requireManagement();

    if (!isDeptAdmin(session.user.role)) {
        return { success: false, error: "Only admins can send invites." };
    }

    const parsed = sendInviteSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { name, email, role, departmentId } = parsed.data;

    if (
        session.user.role !== "super_admin" &&
        !session.user.departments.includes(departmentId)
    ) {
        return { success: false, error: "You do not have access to this department." };
    }

    await connectDB();

    const department = await Department.findById(departmentId);
    if (!department) return { success: false, error: "Department not found." };

    await Invite.findOneAndUpdate(
        { email, departmentId, status: "pending" },
        { status: "cancelled" }
    );

    const token = generateInviteToken();
    const expiresAt = getInviteExpiry();

    await Invite.create({
        email,
        name,
        role,
        departmentId,
        invitedBy: session.user.id,
        token,
        status: "pending",
        expiresAt,
    });

    try {
        await sendManagementInviteEmail({
            to: email,
            name,
            departmentName: department.name,
            invitedBy: session.user.name ?? "An admin",
            token,
            role: role === "dept_admin" ? "Admin" : "Coordinator",
        });
    } catch (err: any) {
        console.error("[sendInvite] email failed:", err?.message);
        return { success: false, error: `Invite created but email failed to send: ${err?.message}` };
    }

    return { success: true, message: `Invite sent to ${email}.` };
}

export async function upgradeExistingUser(input: {
    userId: string;
    departmentId: string;
    role: "coordinator" | "dept_admin";
}) {
    const session = await requireManagement();

    if (!isDeptAdmin(session.user.role)) {
        return { success: false, error: "Only admins can add members." };
    }

    if (
        session.user.role !== "super_admin" &&
        !session.user.departments.includes(input.departmentId)
    ) {
        return { success: false, error: "You do not have access to this department." };
    }

    await connectDB();

    const department = await Department.findById(input.departmentId);
    if (!department) return { success: false, error: "Department not found." };

    const user = await User.findById(input.userId);
    if (!user) return { success: false, error: "User not found." };

    const alreadyMember = department.members?.some(
        (m: any) => m.userId?.toString() === input.userId
    );

    if (alreadyMember) {
        await Department.findByIdAndUpdate(input.departmentId, {
            $set: { "members.$[m].role": input.role },
        }, {
            arrayFilters: [{ "m.userId": user._id }],
        });
    } else {
        await Department.findByIdAndUpdate(input.departmentId, {
            $addToSet: { members: { userId: user._id, role: input.role } },
        });
    }

    const shouldUpgradeRole =
        input.role === "dept_admin" ||
        (input.role === "coordinator" && user.role === "student");

    if (shouldUpgradeRole) {
        await User.findByIdAndUpdate(user._id, {
            role: input.role,
            $addToSet: { departments: input.departmentId },
        });
    } else {
        await User.findByIdAndUpdate(user._id, {
            $addToSet: { departments: input.departmentId },
        });
    }

    return { success: true, message: `${user.name} added to ${department.name}.` };
}

export async function deleteUser(userId: string) {
    await requireSuperAdmin();
    await connectDB();

    const user = await User.findById(userId);
    if (!user) return { success: false, error: "User not found." };

    // 1. Remove from all department member arrays
    await Department.updateMany(
        { "members.userId": userId },
        { $pull: { members: { userId } } }
    );

    // 2. Delete tickets
    await Ticket.deleteMany({ userId });

    // 3. Delete registrations and decrement event counts for confirmed ones
    const confirmedRegs = await Registration.find({ userId, status: "confirmed" }).select("eventId").lean();
    if (confirmedRegs.length > 0) {
        const eventIds = confirmedRegs.map((r) => r.eventId);
        await Event.updateMany(
            { _id: { $in: eventIds } },
            { $inc: { registrationCount: -1 } }
        );
    }
    await Registration.deleteMany({ userId });

    // 4. Cancel pending invites sent by this user
    await Invite.updateMany(
        { invitedBy: userId, status: "pending" },
        { status: "cancelled" }
    );

    // 5. Delete the user
    await User.findByIdAndDelete(userId);

    return { success: true };
}

export async function cancelInvite(inviteId: string) {
    await requireManagement();
    await connectDB();

    const invite = await Invite.findById(inviteId);
    if (!invite) return { success: false, error: "Invite not found." };

    // Ensure the caller has access to the department this invite belongs to
    await requireDepartmentAccess(invite.departmentId.toString());

    await Invite.findByIdAndUpdate(inviteId, { status: "cancelled" });
    return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
    await requireSuperAdmin();

    if (!newPassword || newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters." };
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) return { success: false, error: "User not found." };

    const hash = await hashPassword(newPassword);
    await User.findByIdAndUpdate(userId, { passwordHash: hash });

    return { success: true, message: `Password reset for ${user.name}.` };
}

export async function removeDepartmentMember(departmentId: string, userId: string) {
    await requireDepartmentAccess(departmentId);
    await connectDB();

    await Department.findByIdAndUpdate(departmentId, {
        $pull: { members: { userId } },
    });

    await User.findByIdAndUpdate(userId, {
        $pull: { departments: departmentId },
    });

    return { success: true };
}

export async function getAnalytics() {
    await requireSuperAdmin();
    await connectDB();

    const [
        totalEvents,
        publishedEvents,
        totalRegistrations,
        confirmedRegistrations,
        recentRegistrations,
        pendingRegistrations,
        topEvents,
    ] = await Promise.all([
        Event.countDocuments(),
        Event.countDocuments({ status: "published" }),
        Registration.countDocuments(),
        Registration.countDocuments({ status: "confirmed" }),
        Registration.find({ status: "confirmed" })
            .populate("eventId", "title _id")
            .populate("userId", "name email")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),
        Registration.find({ status: { $ne: "confirmed" } })
            .populate("eventId", "title _id")
            .populate("userId", "name email")
            .sort({ createdAt: -1 })
            .lean(),
        Event.find({ status: "published" })
            .select("title registrationCount capacity")
            .sort({ registrationCount: -1 })
            .limit(5)
            .lean(),
    ]);

    const revenueResult = await Registration.aggregate([
        { $match: { status: "confirmed", paymentStatus: "completed" } },
        {
            $lookup: {
                from: "events",
                localField: "eventId",
                foreignField: "_id",
                as: "event",
            },
        },
        { $unwind: "$event" },
        { $group: { _id: null, total: { $sum: "$event.price" } } },
    ]);

    const totalRevenue = revenueResult[0]?.total ?? 0;

    return {
        success: true,
        data: serialize({
            totalEvents,
            publishedEvents,
            totalRegistrations,
            confirmedRegistrations,
            totalRevenue,
            recentRegistrations,
            pendingRegistrations,
            topEvents,
        }),
    };
}

export async function getAllRegistrationsAdmin(options: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    search?: string;
    eventId?: string;
} = {}) {
    await requireManagement();
    await connectDB();

    const { page = 1, limit = 50, status, paymentStatus, search, eventId } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (status && status !== "all") filter.status = status;
    if (paymentStatus && paymentStatus !== "all") filter.paymentStatus = paymentStatus;
    if (eventId) filter.eventId = new (await import("mongoose")).default.Types.ObjectId(eventId);

    let userIds: any[] | undefined;
    if (search) {
        const User = (await import("@/models")).User;
        const regex = new RegExp(search, "i");
        const users = await User.find({
            $or: [{ name: regex }, { email: regex }, { collegeId: regex }],
        }).select("_id").lean();
        userIds = users.map((u: any) => u._id);
        filter.userId = { $in: userIds };
    }

    const [registrations, total] = await Promise.all([
        Registration.find(filter)
            .populate("eventId", "title _id")
            .populate("userId", "name email collegeId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Registration.countDocuments(filter),
    ]);

    return {
        success: true,
        data: serialize(registrations),
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}