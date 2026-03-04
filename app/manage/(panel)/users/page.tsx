// app/manage/(panel)/users/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
    getDepartments,
    getDepartmentMembers,
    sendInvite,
    cancelInvite,
    removeDepartmentMember,
} from "@/actions/admin";
import { toast } from "sonner";
import {
    IconUserPlus, IconX, IconTrash, IconMail, IconClock,
    IconShield, IconUsers,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "coordinator" | "dept_admin";

export default function ManageUsersPage() {
    const { data: session } = useSession();
    const isSuperAdmin = session?.user?.role === "super_admin";

    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>("");
    const [members, setMembers] = useState<any[]>([]);
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Invite form state
    const [inviteName, setInviteName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<Role>("coordinator");
    const [inviteLoading, setInviteLoading] = useState(false);

    // Load departments
    useEffect(() => {
        getDepartments().then((depts: any[]) => {
            setDepartments(depts);
            if (depts.length > 0) setSelectedDeptId(depts[0]._id);
        }).catch(() => toast.error("Failed to load departments."));
    }, []);

    // Load members when dept changes
    useEffect(() => {
        if (!selectedDeptId) return;
        setLoading(true);
        getDepartmentMembers(selectedDeptId).then((res: any) => {
            if (res.success) {
                setMembers(res.data.members);
                setPendingInvites(res.data.pendingInvites);
            }
        }).catch(() => { }).finally(() => setLoading(false));
    }, [selectedDeptId]);

    async function handleSendInvite(e: React.FormEvent) {
        e.preventDefault();
        setInviteLoading(true);
        const result = await sendInvite({
            name: inviteName,
            email: inviteEmail,
            role: inviteRole,
            departmentId: selectedDeptId,
        });
        setInviteLoading(false);
        if (result.success) {
            toast.success(result.message ?? "Invite sent.");
            setShowInviteModal(false);
            setInviteName(""); setInviteEmail(""); setInviteRole("coordinator");
            // Refresh
            const res: any = await getDepartmentMembers(selectedDeptId);
            if (res.success) { setMembers(res.data.members); setPendingInvites(res.data.pendingInvites); }
        } else {
            toast.error(result.error ?? "Failed to send invite.");
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
            setMembers((prev) => prev.filter((m: any) => m.userId?._id !== userId && m.userId !== userId));
        } else {
            toast.error("Failed to remove member.");
        }
    }

    const roleLabel = (role: string) => role === "dept_admin" ? "Admin" : role === "super_admin" ? "Super Admin" : "Coordinator";
    const roleBadge = (role: string) => role === "dept_admin" || role === "super_admin"
        ? "bg-zinc-900 text-white"
        : "bg-zinc-100 text-zinc-600";

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Users</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">Manage department members and invites.</p>
                </div>
                <Button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm flex items-center gap-2"
                >
                    <IconUserPlus size={16} />
                    Invite Member
                </Button>
            </div>

            {/* Department selector */}
            {departments.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                    {departments.map((dept) => (
                        <button
                            key={dept._id}
                            onClick={() => setSelectedDeptId(dept._id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedDeptId === dept._id
                                    ? "bg-zinc-900 text-white"
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
                    {/* Members */}
                    <div className="bg-white rounded-xl border border-zinc-200">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
                            <IconUsers size={16} className="text-zinc-400" />
                            <h2 className="text-sm font-semibold text-zinc-900">
                                Members <span className="text-zinc-400 font-normal ml-1">({members.length})</span>
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
                                    const memberRole = member.role;

                                    return (
                                        <div key={userId} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 transition-colors">
                                            <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-semibold text-zinc-500">
                                                    {name?.[0]?.toUpperCase() ?? "?"}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-900 truncate">{name}</p>
                                                <p className="text-xs text-zinc-400 truncate">{email}</p>
                                            </div>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge(memberRole)}`}>
                                                {roleLabel(memberRole)}
                                            </span>
                                            {isSuperAdmin && (
                                                <button
                                                    onClick={() => handleRemoveMember(userId, name)}
                                                    className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <IconTrash size={15} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Pending Invites */}
                    {pendingInvites.length > 0 && (
                        <div className="bg-white rounded-xl border border-zinc-200">
                            <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
                                <IconClock size={16} className="text-zinc-400" />
                                <h2 className="text-sm font-semibold text-zinc-900">
                                    Pending Invites <span className="text-zinc-400 font-normal ml-1">({pendingInvites.length})</span>
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
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge(invite.role)}`}>
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

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-xl p-6">
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <IconShield size={18} className="text-orange-500" />
                                    <h2 className="text-lg font-bold text-zinc-900">Invite Member</h2>
                                </div>
                                <p className="text-sm text-zinc-500">
                                    They&apos;ll receive an email to set their password and join{" "}
                                    <span className="font-medium text-zinc-700">
                                        {departments.find((d) => d._id === selectedDeptId)?.name ?? "the department"}
                                    </span>.
                                </p>
                            </div>
                            <button onClick={() => setShowInviteModal(false)} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors">
                                <IconX size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSendInvite} className="space-y-4">
                            <div>
                                <Label htmlFor="inviteName">Full Name</Label>
                                <Input
                                    id="inviteName"
                                    value={inviteName}
                                    onChange={(e) => setInviteName(e.target.value)}
                                    placeholder="e.g. Riya Sharma"
                                    required
                                    autoFocus
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="inviteEmail">Email Address</Label>
                                <Input
                                    id="inviteEmail"
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="riya@college.edu"
                                    required
                                    className="mt-1"
                                />
                            </div>
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

                            {departments.length > 1 && (
                                <div>
                                    <Label htmlFor="inviteDept">Department</Label>
                                    <select
                                        id="inviteDept"
                                        value={selectedDeptId}
                                        onChange={(e) => setSelectedDeptId(e.target.value)}
                                        className="mt-1 w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none"
                                    >
                                        {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={inviteLoading} className="flex-1 bg-zinc-900 hover:bg-zinc-700 text-white">
                                    {inviteLoading ? "Sending…" : "Send Invite"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}