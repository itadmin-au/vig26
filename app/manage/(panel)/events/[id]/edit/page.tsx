// app/manage/(panel)/events/[id]/edit/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getManageEvents, updateEvent, getCategories } from "@/actions/events";
import { toast } from "sonner";
import {
    IconPlus, IconTrash, IconGripVertical, IconUpload,
    IconChevronDown, IconChevronUp, IconArrowLeft,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IFormField, FormFieldType, IEvent } from "@/types";

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
    { value: "short_text", label: "Short Text" },
    { value: "long_text", label: "Long Text" },
    { value: "dropdown", label: "Dropdown" },
    { value: "file_upload", label: "File Upload" },
];

function FormFieldRow({
    field, index, onUpdate, onRemove,
}: {
    field: IFormField;
    index: number;
    onUpdate: (i: number, u: Partial<IFormField>) => void;
    onRemove: (i: number) => void;
}) {
    const [optionInput, setOptionInput] = useState("");
    return (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
                <div className="mt-1 text-zinc-300"><IconGripVertical size={18} /></div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-xs mb-1">Label</Label>
                        <Input value={field.label} onChange={(e) => onUpdate(index, { label: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                        <Label className="text-xs mb-1">Type</Label>
                        <select value={field.type} onChange={(e) => onUpdate(index, { type: e.target.value as FormFieldType })}
                            className="w-full h-8 text-sm border border-zinc-200 rounded-lg px-2 bg-white focus:outline-none">
                            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs mb-1">Placeholder</Label>
                        <Input value={field.placeholder ?? ""} onChange={(e) => onUpdate(index, { placeholder: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={field.isRequired} onChange={(e) => onUpdate(index, { isRequired: e.target.checked })} className="w-4 h-4 accent-orange-500" />
                            <span className="text-sm text-zinc-700">Required</span>
                        </label>
                    </div>
                </div>
                <button onClick={() => onRemove(index)} className="mt-1 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <IconTrash size={16} />
                </button>
            </div>
            {field.type === "dropdown" && (
                <div className="ml-6">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {(field.options ?? []).map((opt, i) => (
                            <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-zinc-200 rounded-full text-xs">
                                {opt}
                                <button onClick={() => onUpdate(index, { options: field.options?.filter((_, oi) => oi !== i) })} className="text-zinc-400 hover:text-red-500">×</button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input value={optionInput} onChange={(e) => setOptionInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && optionInput.trim()) { e.preventDefault(); onUpdate(index, { options: [...(field.options ?? []), optionInput.trim()] }); setOptionInput(""); } }}
                            placeholder="Add option (Enter)" className="h-7 text-xs" />
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2"
                            onClick={() => { if (optionInput.trim()) { onUpdate(index, { options: [...(field.options ?? []), optionInput.trim()] }); setOptionInput(""); } }}>
                            Add
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function EditEventPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [event, setEvent] = useState<IEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [formFields, setFormFields] = useState<IFormField[]>([]);
    const [isTeamEvent, setIsTeamEvent] = useState(false);
    const [expanded, setExpanded] = useState({ basic: true, details: true, rules: true, team: false, form: false });

    useEffect(() => {
        async function load() {
            const [events, cats] = await Promise.all([
                getManageEvents(),
                getCategories(),
            ]);
            const found = events.find((e) => e._id.toString() === id) ?? null;
            setEvent(found);
            if (found) {
                setFormFields(found.customForm ?? []);
                setIsTeamEvent(found.isTeamEvent);
                setCoverPreview(found.coverImage ?? null);
            }
            setCategories((cats as any[]).map((c) => c.slug));
            setLoading(false);
        }
        load();
    }, [id]);

    const addField = useCallback(() => {
        setFormFields((prev) => [...prev, { _id: Math.random().toString(36).slice(2), label: "", type: "short_text", placeholder: "", isRequired: false, order: prev.length }]);
    }, []);
    const updateField = useCallback((i: number, u: Partial<IFormField>) => {
        setFormFields((prev) => prev.map((f, idx) => idx === i ? { ...f, ...u } : f));
    }, []);
    const removeField = useCallback((i: number) => {
        setFormFields((prev) => prev.filter((_, idx) => idx !== i));
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        const formData = new FormData(e.currentTarget);
        formData.set("isTeamEvent", String(isTeamEvent));
        formData.set("customForm", JSON.stringify(formFields.map((f, i) => ({ ...f, order: i }))));
        const result = await updateEvent(id, formData);
        setSaving(false);
        if (result.success) {
            toast.success("Event updated.");
            router.push(`/manage/events/${id}`);
        } else {
            toast.error(result.error ?? "Failed to update event.");
        }
    }

    function SectionHeader({ title, sectionKey }: { title: string; sectionKey: keyof typeof expanded }) {
        return (
            <button type="button" onClick={() => setExpanded((p) => ({ ...p, [sectionKey]: !p[sectionKey] }))}
                className="w-full flex items-center justify-between py-4 text-left">
                <p className="text-sm font-semibold text-zinc-900">{title}</p>
                {expanded[sectionKey] ? <IconChevronUp size={16} className="text-zinc-400" /> : <IconChevronDown size={16} className="text-zinc-400" />}
            </button>
        );
    }

    if (loading) return <div className="animate-pulse space-y-4"><div className="h-6 bg-zinc-100 rounded w-48" /><div className="bg-white rounded-xl border border-zinc-200 h-48" /></div>;
    if (!event) return <div className="text-center py-20 text-zinc-400">Event not found.</div>;

    const toDatetimeLocal = (d: any) => d ? new Date(d).toISOString().slice(0, 16) : "";

    return (
        <div className="space-y-5 max-w-3xl">
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                    <IconArrowLeft size={18} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Edit Event</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">{event.title}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic Info */}
                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Basic Info" sectionKey="basic" />
                    {expanded.basic && (
                        <div className="pb-5 space-y-4">
                            <div>
                                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                                <Input id="title" name="title" defaultValue={event.title} required className="mt-1" />
                            </div>
                            <div>
                                <Label htmlFor="description">Description</Label>
                                <textarea id="description" name="description" rows={4} defaultValue={event.description ?? ""}
                                    className="mt-1 w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none" />
                            </div>
                            <div>
                                <Label>Cover Image</Label>
                                <div className="mt-1">
                                    {coverPreview ? (
                                        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-zinc-200">
                                            <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => setCoverPreview(null)}
                                                className="absolute top-2 right-2 p-1.5 bg-white rounded-lg border shadow-sm text-zinc-500 hover:text-red-500">
                                                <IconTrash size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
                                            <IconUpload size={20} className="text-zinc-300 mb-2" />
                                            <span className="text-sm text-zinc-400">Click to upload new cover</span>
                                            <input type="file" name="coverImageFile" accept="image/*" className="hidden"
                                                onChange={(e) => { const f = e.target.files?.[0]; if (f) setCoverPreview(URL.createObjectURL(f)); }} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Event Details" sectionKey="details" />
                    {expanded.details && (
                        <div className="pb-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="type">Type</Label>
                                    <select id="type" name="type" defaultValue={event.type}
                                        className="mt-1 w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none">
                                        <option value="inter">Inter College</option>
                                        <option value="intra">Intra College</option>
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="category">Category</Label>
                                    <select id="category" name="category" defaultValue={event.category}
                                        className="mt-1 w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none">
                                        {categories.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="dateStart">Start</Label>
                                    <Input id="dateStart" name="dateStart" type="datetime-local" defaultValue={toDatetimeLocal(event.date.start)} className="mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="dateEnd">End</Label>
                                    <Input id="dateEnd" name="dateEnd" type="datetime-local" defaultValue={toDatetimeLocal(event.date.end)} className="mt-1" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="venue">Venue</Label>
                                <Input id="venue" name="venue" defaultValue={event.venue ?? ""} className="mt-1" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="capacity">Capacity</Label>
                                    <Input id="capacity" name="capacity" type="number" min="0" defaultValue={event.capacity} className="mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="price">Price (₹)</Label>
                                    <Input id="price" name="price" type="number" min="0" defaultValue={event.price} className="mt-1" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rules */}
                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Rules" sectionKey="rules" />
                    {expanded.rules && (
                        <div className="pb-5">
                            <textarea name="rules" rows={5} defaultValue={event.rules ?? ""}
                                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none" />
                        </div>
                    )}
                </div>

                {/* Team */}
                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Team Settings" sectionKey="team" />
                    {expanded.team && (
                        <div className="pb-5 space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={isTeamEvent} onChange={(e) => setIsTeamEvent(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                                <span className="text-sm font-medium text-zinc-900">Team Event</span>
                            </label>
                            {isTeamEvent && (
                                <div className="grid grid-cols-2 gap-4 pl-7">
                                    <div>
                                        <Label htmlFor="teamSizeMin">Min</Label>
                                        <Input id="teamSizeMin" name="teamSizeMin" type="number" min="2" defaultValue={event.teamSize?.min ?? 2} className="mt-1" />
                                    </div>
                                    <div>
                                        <Label htmlFor="teamSizeMax">Max</Label>
                                        <Input id="teamSizeMax" name="teamSizeMax" type="number" min="2" defaultValue={event.teamSize?.max ?? 5} className="mt-1" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Form Builder */}
                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Registration Form" sectionKey="form" />
                    {expanded.form && (
                        <div className="pb-5 space-y-3">
                            {formFields.map((field, index) => (
                                <FormFieldRow key={field._id} field={field} index={index} onUpdate={updateField} onRemove={removeField} />
                            ))}
                            <button type="button" onClick={addField}
                                className="flex items-center gap-2 w-full justify-center py-2.5 border-2 border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500 hover:border-orange-300 hover:text-orange-600 transition-colors">
                                <IconPlus size={16} />
                                Add Field
                            </button>
                        </div>
                    )}
                </div>

                {/* Submit */}
                <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 flex items-center justify-between">
                    <button type="button" onClick={() => router.back()} className="text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
                    <Button type="submit" disabled={saving} className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm">
                        {saving ? "Saving…" : "Save Changes"}
                    </Button>
                </div>
            </form>
        </div>
    );
}