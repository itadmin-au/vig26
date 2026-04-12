// app/manage/(panel)/users/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
    getDepartments,
    getDepartmentMembers,
    sendInvite,
    cancelInvite,
    removeDepartmentMember,
    upgradeExistingUser,
    deleteUser,
    resetUserPassword,
} from "@/actions/admin";
import { toast } from "sonner";
import {
    IconUserPlus, IconX, IconTrash, IconMail, IconClock,
    IconShield, IconUsers, IconUserCheck, IconLoader2, IconUserMinus, IconKey,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "coordinator" | "dept_admin";

interface ExistingUser {
    id: string;
    name: string;
    email: string;
    role: string;
}

function roleBadgeClass(role: string) {
    return role === "dept_admin" || role === "super_admin"
        ? "bg-zinc-900 text-white"
        : "bg-zinc-100 text-zinc-600";
}

function roleLabel(role: string) {
    if (role === "dept_admin") return "Admin";
    if (role === "super_admin") return "Super Admin";
    return "Coordinator";
}

export default function ManageUsersPage() {
    const { data: session } = useSession();
    const isSuperAdmin = session?.user?.role === "super_admin";

    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState("");
    const [members, setMembers] = useState<any[]>([]);
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [resetModal, setResetModal] = useState<{ userId: string; name: string } | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [resetLoading, setResetLoading] = useState(false);

    const [inviteName, setInviteName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<Role>("coordinator");
    const [inviteDeptId, setInviteDeptId] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);

    const [lookupLoading, setLookupLoading] = useState(false);
    const [existingUser, setExistingUser] = useState<ExistingUser | null>(null);
    const [lookupDone, setLookupDone] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    async function refreshMembers(deptId: string) {
        if (!deptId) return;
        setLoading(true);
        const res: any = await getDepartmentMembers(deptId).catch(() => null);
        if (res?.success) {
            setMembers(res.data.members);
            setPendingInvites(res.data.pendingInvites);
        }
        setLoading(false);
    }

    useEffect(() => {
        getDepartments().then((depts: any[]) => {
            setDepartments(depts);
            if (depts.length) {
                setSelectedDeptId(depts[0]._id);
                setInviteDeptId(depts[0]._id);
            }
        }).catch(() => toast.error("Failed to load departments."));
    }, []);

    useEffect(() => {
        refreshMembers(selectedDeptId);
    }, [selectedDeptId]);

    function resetInviteModal() {
        setInviteName("");
        setInviteEmail("");
        setInviteRole("coordinator");
        setInviteDeptId(selectedDeptId);
        setExistingUser(null);
        setLookupDone(false);
    }

    function openModal() {
        resetInviteModal();
        setShowModal(true);
    }

    function handleEmailChange(email: string) {
        setInviteEmail(email);
        setExistingUser(null);
        setLookupDone(false);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;

        setLookupLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(trimmed)}`);
                const data = await res.json();
                if (data.exists) {
                    setExistingUser(data.user);
                    setInviteName(data.user.name);
                } else {
                    setExistingUser(null);
                }
            } catch {
                setExistingUser(null);
            } finally {
                setLookupLoading(false);
                setLookupDone(true);
            }
        }, 500);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!inviteDeptId) {
            toast.error("Please select a department.");
            return;
        }

        setInviteLoading(true);

        if (existingUser) {
            const result = await upgradeExistingUser({
                userId: existingUser.id,
                departmentId: inviteDeptId,
                role: inviteRole,
            });
            setInviteLoading(false);
            if (result.success) {
                toast.success(result.message ?? "Member added.");
                setShowModal(false);
                resetInviteModal();
                refreshMembers(selectedDeptId);
            } else {
                toast.error(result.error ?? "Failed to add member.");
            }
        } else {
            const result = await sendInvite({
                name: inviteName,
                email: inviteEmail,
                role: inviteRole,
                departmentId: inviteDeptId,
            });
            setInviteLoading(false);
            if (result.success) {
                toast.success(result.message ?? "Invite sent.");
                setShowModal(false);
                resetInviteModal();
                refreshMembers(selectedDeptId);
            } else {
                toast.error(result.error ?? "Failed to send invite.");
            }
        }
    }

    async function handleCancelInvite(inviteId: string) {
        if (!confirm("Cancel this invite?")) return;
        const result = await cancelInvite(inviteId);
        if (result.success) {
            toast.success("Invite cancelled.");
            setPendingInvites((prev) => prev.filter((i) => i._id !== inviteId));
        } else {
            toast.error("Failed to cancel invite.");
        }
    }

    async function handleRemoveMember(userId: string, name: string) {
        if (!confirm(`Remove ${name} from this department?`)) return;
        const result = await removeDepartmentMember(selectedDeptId, userId);
        if (result.success) {
            toast.success(`${name} removed.`);
            setMembers((prev) => prev.filter((m: any) => {
                const uid = typeof m.userId === "object" ? m.userId?._id : m.userId;
                return uid !== userId;
            }));
        } else {
            toast.error("Failed to remove member.");
        }
    }

    async function handleDeleteUser(userId: string, name: string) {
        if (!confirm(`Permanently delete ${name}? This will remove all their registrations, tickets, and department memberships.`)) return;
        const result = await deleteUser(userId);
        if (result.success) {
            toast.success(`${name} deleted.`);
            setMembers((prev) => prev.filter((m: any) => {
                const uid = typeof m.userId === "object" ? m.userId?._id : m.userId;
                return uid !== userId;
            }));
        } else {
            toast.error(result.error ?? "Failed to delete user.");
        }
    }

    async function handleResetPassword(e: React.FormEvent) {
        e.preventDefault();
        if (!resetModal) return;
        setResetLoading(true);
        const result = await resetUserPassword(resetModal.userId, newPassword);
        setResetLoading(false);
        if (result.success) {
            toast.success(result.message ?? "Password reset.");
            setResetModal(null);
            setNewPassword("");
        } else {
            toast.error(result.error ?? "Failed to reset password.");
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Users</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">Manage department members and invites.</p>
                </div>
                <Button
                    onClick={openModal}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground text-sm flex items-center gap-2"
                >
                    <IconUserPlus size={16} />
                    Invite Member
                </Button>
            </div>

            {departments.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                    {departments.map((dept) => (
                        <button
                            key={dept._id}
                            onClick={() => setSelectedDeptId(dept._id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                selectedDeptId === dept._id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                            }`}
                        >
                            {dept.name}
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse">
                            <div className="w-9 h-9 rounded-full bg-zinc-100" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-4 bg-zinc-100 rounded w-36" />
                                <div className="h-3 bg-zinc-100 rounded w-48" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-xl border border-zinc-200">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
                            <IconUsers size={16} className="text-zinc-400" />
                            <h2 className="text-sm font-semibold text-zinc-900">
                                Members
                                <span className="text-zinc-400 font-normal ml-1">({members.length})</span>
                            </h2>
                        </div>
                        {members.length === 0 ? (
                            <div className="px-5 py-10 text-center text-sm text-zinc-400">
                                No members yet. Invite someone to get started.
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-100">
                                {members.map((member: any) => {
                                    const user = member.userId;
                                    const userId = typeof user === "object" ? user?._id : user;
                                    const name = typeof user === "object" ? user?.name : "—";
                                    const email = typeof user === "object" ? user?.email : "—";
                                    return (
                                        <div key={member._id ?? userId} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 transition-colors">
                                            <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-semibold text-zinc-500">
                                                    {name?.[0]?.toUpperCase() ?? "?"}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-900 truncate">{name}</p>
                                                <p className="text-xs text-zinc-400 truncate">{email}</p>
                                            </div>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeClass(member.role)}`}>
                                                {roleLabel(member.role)}
                                            </span>
                                            {isSuperAdmin && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => { setResetModal({ userId, name }); setNewPassword(""); }}
                                                        title="Reset password"
                                                        className="p-1.5 text-zinc-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <IconKey size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveMember(userId, name)}
                                                        title="Remove from department"
                                                        className="p-1.5 text-zinc-300 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                                                    >
                                                        <IconUserMinus size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(userId, name)}
                                                        title="Delete user account"
                                                        className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <IconTrash size={15} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {pendingInvites.length > 0 && (
                        <div className="bg-white rounded-xl border border-zinc-200">
                            <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
                                <IconClock size={16} className="text-zinc-400" />
                                <h2 className="text-sm font-semibold text-zinc-900">
                                    Pending Invites
                                    <span className="text-zinc-400 font-normal ml-1">({pendingInvites.length})</span>
                                </h2>
                            </div>
                            <div className="divide-y divide-zinc-100">
                                {pendingInvites.map((invite: any) => (
                                    <div key={invite._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 transition-colors">
                                        <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                                            <IconMail size={15} className="text-orange-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 truncate">{invite.name}</p>
                                            <p className="text-xs text-zinc-400 truncate">{invite.email}</p>
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeClass(invite.role)}`}>
                                            {roleLabel(invite.role)}
                                        </span>
                                        <span className="text-xs text-orange-500 font-medium bg-orange-50 px-2 py-0.5 rounded-full">
                                            Pending
                                        </span>
                                        <button
                                            onClick={() => handleCancelInvite(invite._id)}
                                            className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <IconX size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {resetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-xl p-6">
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <IconKey size={18} className="text-blue-500" />
                                    <h2 className="text-lg font-bold text-zinc-900">Reset Password</h2>
                                </div>
                                <p className="text-sm text-zinc-500">
                                    Set a new password for <span className="font-medium text-zinc-700">{resetModal.name}</span>.
                                </p>
                            </div>
                            <button
                                onClick={() => setResetModal(null)}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
                            >
                                <IconX size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    required
                                    autoFocus
                                    minLength={8}
                                    className="mt-1"
                                />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setResetModal(null)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={resetLoading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {resetLoading ? "Resetting…" : "Reset Password"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-xl p-6">
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <IconShield size={18} className="text-orange-500" />
                                    <h2 className="text-lg font-bold text-zinc-900">
                                        {existingUser ? "Add to Department" : "Invite Member"}
                                    </h2>
                                </div>
                                <p className="text-sm text-zinc-500">
                                    {existingUser
                                        ? "This account already exists. Select a role to add them directly."
                                        : "They'll receive an email with a link to set their password."}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="inviteEmail">Email Address</Label>
                                <div className="relative mt-1">
                                    <Input
                                        id="inviteEmail"
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => handleEmailChange(e.target.value)}
                                        placeholder="colleague@college.edu"
                                        required
                                        autoFocus
                                        className="pr-8"
                                    />
                                    {lookupLoading && (
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                            <IconLoader2 size={15} className="text-zinc-400 animate-spin" />
                                        </div>
                                    )}
                                    {!lookupLoading && existingUser && (
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                            <IconUserCheck size={15} className="text-green-500" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {existingUser && (
                                <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-semibold text-green-700">
                                            {existingUser.name[0]?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-zinc-900">{existingUser.name}</p>
                                        <p className="text-xs text-zinc-500">
                                            Current role:{" "}
                                            <span className="font-medium">{roleLabel(existingUser.role)}</span>
                                        </p>
                                    </div>
                                    <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                                        Existing user
                                    </span>
                                </div>
                            )}

                            {!existingUser && lookupDone && (
                                <div>
                                    <Label htmlFor="inviteName">Full Name</Label>
                                    <Input
                                        id="inviteName"
                                        value={inviteName}
                                        onChange={(e) => setInviteName(e.target.value)}
                                        placeholder="e.g. Riya Sharma"
                                        required={!existingUser}
                                        className="mt-1"
                                    />
                                </div>
                            )}

                            {!existingUser && !lookupDone && inviteEmail === "" && (
                                <div>
                                    <Label htmlFor="inviteName">Full Name</Label>
                                    <Input
                                        id="inviteName"
                                        value={inviteName}
                                        onChange={(e) => setInviteName(e.target.value)}
                                        placeholder="e.g. Riya Sharma"
                                        className="mt-1"
                                    />
                                </div>
                            )}

                            <div>
                                <Label htmlFor="inviteRole">Role</Label>
                                <select
                                    id="inviteRole"
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value as Role)}
                                    className="mt-1 w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                >
                                    <option value="coordinator">Coordinator</option>
                                    <option value="dept_admin">Dept Admin</option>
                                </select>
                                <p className="text-xs text-zinc-400 mt-1.5">
                                    {inviteRole === "dept_admin"
                                        ? "Admins can invite others and manage all department events."
                                        : "Coordinators can create and manage events for this department."}
                                </p>
                            </div>

                            <div>
                                <Label htmlFor="inviteDept">Department</Label>
                                <select
                                    id="inviteDept"
                                    value={inviteDeptId}
                                    onChange={(e) => setInviteDeptId(e.target.value)}
                                    required
                                    className="mt-1 w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                >
                                    <option value="" disabled>Select a department…</option>
                                    {departments.map((d) => (
                                        <option key={d._id} value={d._id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={inviteLoading || lookupLoading}
                                    className="flex-1 bg-primary hover:bg-primary/80 text-primary-foreground"
                                >
                                    {inviteLoading
                                        ? existingUser ? "Adding…" : "Sending…"
                                        : existingUser ? "Add to Department" : "Send Invite"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}