// app/manage/(panel)/departments/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
    getDepartments,
    createDepartment,
    deleteDepartment,
} from "@/actions/admin";
import { toast } from "sonner";
import {
    IconPlus, IconTrash, IconBuilding, IconUsers, IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ManageDepartmentsPage() {
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [deptName, setDeptName] = useState("");
    const [deptDesc, setDeptDesc] = useState("");
    const [creating, setCreating] = useState(false);

    async function load() {
        setLoading(true);
        const depts = await getDepartments();
        setDepartments(depts as any[]);
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        const result = await createDepartment({ name: deptName.trim(), description: deptDesc.trim() || undefined });
        setCreating(false);
        if (result.success) {
            toast.success(`Department "${deptName.trim()}" created.`);
            setDeptName(""); setDeptDesc(""); setShowModal(false);
            load();
        } else {
            toast.error(result.error ?? "Failed to create department.");
        }
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Delete department "${name}"? This will not delete its events or members.`)) return;
        setDeletingId(id);
        const result = await deleteDepartment(id);
        setDeletingId(null);
        if (result.success) {
            toast.success(`Department "${name}" deleted.`);
            setDepartments((prev) => prev.filter((d) => d._id !== id));
        } else {
            toast.error("Failed to delete department.");
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Departments</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">Create and manage departments for Vigyanrang.</p>
                </div>
                <Button
                    onClick={() => setShowModal(true)}
                    className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm flex items-center gap-2"
                >
                    <IconPlus size={16} />
                    New Department
                </Button>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200">
                {loading ? (
                    <div className="divide-y divide-zinc-100">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-5 animate-pulse">
                                <div className="w-10 h-10 rounded-xl bg-zinc-100 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-zinc-100 rounded w-40" />
                                    <div className="h-3 bg-zinc-100 rounded w-60" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : departments.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                        <IconBuilding size={40} className="mx-auto text-zinc-200 mb-3" />
                        <p className="text-sm text-zinc-400">No departments yet.</p>
                        <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-orange-600 font-medium hover:underline">
                            Create your first department →
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {departments.map((dept: any) => (
                            <div key={dept._id} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors">
                                {dept.logo ? (
                                    <img src={dept.logo} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                                        <IconBuilding size={20} className="text-orange-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-900">{dept.name}</p>
                                    {dept.description && (
                                        <p className="text-xs text-zinc-400 mt-0.5 truncate">{dept.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-zinc-400 shrink-0">
                                    <IconUsers size={14} />
                                    <span>{dept.members?.length ?? 0} members</span>
                                </div>
                                <button
                                    onClick={() => handleDelete(dept._id, dept.name)}
                                    disabled={deletingId === dept._id}
                                    className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <IconTrash size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-zinc-900">New Department</h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors">
                                <IconX size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <Label htmlFor="deptName">Department Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="deptName"
                                    value={deptName}
                                    onChange={(e) => setDeptName(e.target.value)}
                                    placeholder="e.g. Computer Science"
                                    required
                                    autoFocus
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="deptDesc">Description</Label>
                                <textarea
                                    id="deptDesc"
                                    value={deptDesc}
                                    onChange={(e) => setDeptDesc(e.target.value)}
                                    placeholder="Brief description of this department…"
                                    rows={3}
                                    className="mt-1 w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                                <Button type="submit" disabled={creating || !deptName.trim()} className="flex-1 bg-zinc-900 hover:bg-zinc-700 text-white">
                                    {creating ? "Creating…" : "Create Department"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}