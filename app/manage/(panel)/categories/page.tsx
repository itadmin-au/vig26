// app/manage/(panel)/categories/page.tsx
"use client";

import { useState, useEffect } from "react";
import { getCategories, createCategory, deleteCategory } from "@/actions/events";
import { toast } from "sonner";
import { IconPlus, IconTrash, IconTag, IconLock } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ManageCategoriesPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        const cats = await getCategories();
        setCategories(cats as any[]);
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        const result = await createCategory(newName.trim());
        setCreating(false);
        if (result.success) {
            toast.success(`Category "${newName.trim()}" created.`);
            setNewName("");
            load();
        } else {
            toast.error(result.error ?? "Failed to create category.");
        }
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Delete category "${name}"? This may affect existing events.`)) return;
        setDeletingId(id);
        const result = await deleteCategory(id);
        setDeletingId(null);
        if (result.success) {
            toast.success(`Category "${name}" deleted.`);
            setCategories((prev) => prev.filter((c) => c._id !== id));
        } else {
            toast.error(result.error ?? "Failed to delete category.");
        }
    }

    const defaults = categories.filter((c) => c.isDefault);
    const custom = categories.filter((c) => !c.isDefault);

    return (
        <div className="space-y-5 max-w-2xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Categories</h1>
                <p className="text-sm text-zinc-500 mt-0.5">Manage event categories. Default categories cannot be deleted.</p>
            </div>

            {/* Add Category */}
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
                <h2 className="text-sm font-semibold text-zinc-900 mb-3">Add Custom Category</h2>
                <form onSubmit={handleCreate} className="flex gap-3">
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Robotics"
                        className="flex-1"
                    />
                    <Button type="submit" disabled={creating || !newName.trim()} className="bg-zinc-900 hover:bg-zinc-700 text-white shrink-0">
                        <IconPlus size={16} className="mr-1.5" />
                        {creating ? "Adding…" : "Add"}
                    </Button>
                </form>
                <p className="text-xs text-zinc-400 mt-2">
                    The slug will be auto-generated from the name (e.g. &quot;Robotics&quot; → &quot;robotics&quot;).
                </p>
            </div>

            {/* Default categories */}
            <div className="bg-white rounded-xl border border-zinc-200">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
                    <IconLock size={15} className="text-zinc-400" />
                    <h2 className="text-sm font-semibold text-zinc-900">Default Categories</h2>
                    <span className="text-xs text-zinc-400 ml-1">Cannot be deleted</span>
                </div>
                {loading ? (
                    <div className="p-5 space-y-2">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-zinc-100 rounded-lg animate-pulse" />)}
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {defaults.map((cat) => (
                            <div key={cat._id} className="flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                                        <IconTag size={14} className="text-zinc-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-900 capitalize">{cat.name}</p>
                                        <p className="text-xs text-zinc-400 font-mono">{cat.slug}</p>
                                    </div>
                                </div>
                                <span className="text-xs bg-zinc-100 text-zinc-400 px-2 py-0.5 rounded-full">Default</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Custom categories */}
            {(custom.length > 0 || !loading) && (
                <div className="bg-white rounded-xl border border-zinc-200">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
                        <IconTag size={15} className="text-zinc-400" />
                        <h2 className="text-sm font-semibold text-zinc-900">Custom Categories</h2>
                        <span className="text-xs text-zinc-400 ml-1">({custom.length})</span>
                    </div>
                    {custom.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-zinc-400">
                            No custom categories yet.
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100">
                            {custom.map((cat) => (
                                <div key={cat._id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                                            <IconTag size={14} className="text-orange-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900 capitalize">{cat.name}</p>
                                            <p className="text-xs text-zinc-400 font-mono">{cat.slug}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(cat._id, cat.name)}
                                        disabled={deletingId === cat._id}
                                        className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <IconTrash size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}