// app/manage/(panel)/events/new/page.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { createEvent, getCategories } from "@/actions/events";
import { getDepartments } from "@/actions/admin";
import { toast } from "sonner";
import {
    IconPlus, IconTrash, IconGripVertical, IconUpload,
    IconChevronDown, IconChevronUp,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IFormField, FormFieldType } from "@/types";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
    { value: "short_text", label: "Short Text" },
    { value: "long_text", label: "Long Text" },
    { value: "dropdown", label: "Dropdown" },
    { value: "file_upload", label: "File Upload" },
];

const EVENT_TYPES = [
    { value: "inter", label: "Inter College" },
    { value: "intra", label: "Intra College" },
];

const DEFAULT_CATEGORIES = ["tech", "cultural", "workshop", "hackathon", "esports", "sports"];

function FormFieldRow({
    field,
    index,
    onUpdate,
    onRemove,
}: {
    field: IFormField;
    index: number;
    onUpdate: (index: number, updates: Partial<IFormField>) => void;
    onRemove: (index: number) => void;
}) {
    const [optionInput, setOptionInput] = useState("");

    return (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
                <div className="mt-1 text-zinc-300 cursor-grab">
                    <IconGripVertical size={18} />
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <Label className="text-xs mb-1">Field Label</Label>
                        <Input
                            value={field.label}
                            onChange={(e) => onUpdate(index, { label: e.target.value })}
                            placeholder="e.g. Team Name"
                            className="h-8 text-sm"
                        />
                    </div>
                    <div>
                        <Label className="text-xs mb-1">Type</Label>
                        <select
                            value={field.type}
                            onChange={(e) => onUpdate(index, { type: e.target.value as FormFieldType })}
                            className="w-full h-8 text-sm border border-zinc-200 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        >
                            {FIELD_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs mb-1">Placeholder</Label>
                        <Input
                            value={field.placeholder ?? ""}
                            onChange={(e) => onUpdate(index, { placeholder: e.target.value })}
                            placeholder="Optional placeholder text"
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="flex items-end gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={field.isRequired}
                                onChange={(e) => onUpdate(index, { isRequired: e.target.checked })}
                                className="w-4 h-4 accent-orange-500"
                            />
                            <span className="text-sm text-zinc-700">Required</span>
                        </label>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="mt-1 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <IconTrash size={16} />
                </button>
            </div>

            {field.type === "dropdown" && (
                <div className="ml-6">
                    <Label className="text-xs mb-1">Options</Label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {(field.options ?? []).map((opt, i) => (
                            <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-zinc-200 rounded-full text-xs">
                                {opt}
                                <button
                                    type="button"
                                    onClick={() => onUpdate(index, {
                                        options: field.options?.filter((_, oi) => oi !== i),
                                    })}
                                    className="text-zinc-400 hover:text-red-500 ml-0.5"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            value={optionInput}
                            onChange={(e) => setOptionInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && optionInput.trim()) {
                                    e.preventDefault();
                                    onUpdate(index, {
                                        options: [...(field.options ?? []), optionInput.trim()],
                                    });
                                    setOptionInput("");
                                }
                            }}
                            placeholder="Add option (Enter to add)"
                            className="h-7 text-xs"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => {
                                if (optionInput.trim()) {
                                    onUpdate(index, {
                                        options: [...(field.options ?? []), optionInput.trim()],
                                    });
                                    setOptionInput("");
                                }
                            }}
                        >
                            Add
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NewEventPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const isSuperAdmin = session?.user?.role === "super_admin";

    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
    const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState("");
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    const [rules, setRules] = useState("");
    const [formFields, setFormFields] = useState<IFormField[]>([]);
    const [isTeamEvent, setIsTeamEvent] = useState(false);
    const [teamSizeMin, setTeamSizeMin] = useState(2);
    const [teamSizeMax, setTeamSizeMax] = useState(5);
    const [expandedSections, setExpandedSections] = useState({
        basic: true, details: true, rules: false, team: false, form: false,
    });

    useEffect(() => {
        getCategories().then((cats: any[]) => {
            if (cats.length) setCategories(cats.map((c) => c.slug));
        }).catch(() => { });

        if (isSuperAdmin) {
            getDepartments().then((depts: any[]) => {
                setDepartments(depts);
                if (depts.length) setSelectedDeptId(depts[0]._id);
            }).catch(() => { });
        } else if (session?.user?.departments?.length) {
            setSelectedDeptId(session.user.departments[0]);
        }
    }, [isSuperAdmin, session]);

    function toggleSection(key: keyof typeof expandedSections) {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    const addField = useCallback(() => {
        setFormFields((prev) => [
            ...prev,
            {
                _id: Math.random().toString(36).slice(2),
                label: "",
                type: "short_text",
                placeholder: "",
                isRequired: false,
                order: prev.length,
            },
        ]);
    }, []);

    const updateField = useCallback((index: number, updates: Partial<IFormField>) => {
        setFormFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
    }, []);

    const removeField = useCallback((index: number) => {
        setFormFields((prev) => prev.filter((_, i) => i !== index));
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>, status: "draft" | "published") {
        e.preventDefault();

        if (!selectedDeptId) {
            toast.error("Please select a department.");
            return;
        }

        setLoading(true);

        const formData = new FormData(e.currentTarget);
        formData.set("status", status);
        formData.set("isTeamEvent", String(isTeamEvent));
        formData.set("description", description);
        formData.set("rules", rules);
        formData.set("departmentId", selectedDeptId);
        formData.set("customForm", JSON.stringify(formFields.map((f, i) => ({ ...f, order: i }))));

        if (isTeamEvent) {
            formData.set("teamSizeMin", String(teamSizeMin));
            formData.set("teamSizeMax", String(teamSizeMax));
        }

        const result = await createEvent(formData);
        setLoading(false);

        if (result.success) {
            toast.success(status === "published" ? "Event published!" : "Event saved as draft.");
            router.push("/manage/events");
        } else {
            toast.error(result.error ?? "Failed to save event.");
        }
    }

    function SectionHeader({
        title,
        description: desc,
        sectionKey,
    }: {
        title: string;
        description?: string;
        sectionKey: keyof typeof expandedSections;
    }) {
        return (
            <button
                type="button"
                onClick={() => toggleSection(sectionKey)}
                className="w-full flex items-center justify-between py-4 text-left"
            >
                <div>
                    <p className="text-sm font-semibold text-zinc-900">{title}</p>
                    {desc && <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>}
                </div>
                {expandedSections[sectionKey] ? (
                    <IconChevronUp size={16} className="text-zinc-400" />
                ) : (
                    <IconChevronDown size={16} className="text-zinc-400" />
                )}
            </button>
        );
    }

    return (
        <div className="space-y-5 max-w-3xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">New Event</h1>
                <p className="text-sm text-zinc-500 mt-0.5">Fill in the details to create a new event.</p>
            </div>

            <form onSubmit={(e) => handleSubmit(e, "draft")} className="space-y-4">

                {isSuperAdmin && (
                    <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
                        <Label htmlFor="deptSelect">
                            Department <span className="text-red-500">*</span>
                        </Label>
                        <select
                            id="deptSelect"
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            required
                            className="mt-1 w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        >
                            <option value="" disabled>Select a department…</option>
                            {departments.map((d) => (
                                <option key={d._id} value={d._id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader
                        title="Basic Info"
                        description="Title, description, and cover image"
                        sectionKey="basic"
                    />
                    {expandedSections.basic && (
                        <div className="pb-5 space-y-4">
                            <div>
                                <Label htmlFor="title">
                                    Event Title <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="title"
                                    name="title"
                                    placeholder="e.g. National Hackathon 2026"
                                    required
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label>Description</Label>
                                <p className="text-xs text-zinc-400 mt-0.5 mb-1.5">Supports Markdown formatting.</p>
                                <div data-color-mode="light">
                                    <MDEditor
                                        value={description}
                                        onChange={(val) => setDescription(val ?? "")}
                                        height={220}
                                        preview="edit"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Cover Image</Label>
                                <div className="mt-1">
                                    {coverPreview ? (
                                        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-zinc-200">
                                            <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setCoverPreview(null)}
                                                className="absolute top-2 right-2 p-1.5 bg-white rounded-lg border border-zinc-200 text-zinc-500 hover:text-red-500 shadow-sm"
                                            >
                                                <IconTrash size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
                                            <IconUpload size={20} className="text-zinc-300 mb-2" />
                                            <span className="text-sm text-zinc-400">Click to upload cover image</span>
                                            <input
                                                type="file"
                                                name="coverImageFile"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) setCoverPreview(URL.createObjectURL(file));
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader
                        title="Event Details"
                        description="Type, category, date, venue, capacity, and pricing"
                        sectionKey="details"
                    />
                    {expandedSections.details && (
                        <div className="pb-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="type">
                                        Type <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="type"
                                        name="type"
                                        required
                                        className="mt-1 w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    >
                                        {EVENT_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="category">
                                        Category <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="category"
                                        name="category"
                                        required
                                        className="mt-1 w-full h-9 text-sm capitalize border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    >
                                        {categories.map((c) => (
                                            <option key={c} value={c} className="capitalize">{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="dateStart">
                                        Start Date & Time <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="dateStart" name="dateStart" type="datetime-local" required className="mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="dateEnd">
                                        End Date & Time <span className="text-red-500">*</span>
                                    </Label>
                                    <Input id="dateEnd" name="dateEnd" type="datetime-local" required className="mt-1" />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="venue">Venue</Label>
                                <Input id="venue" name="venue" placeholder="e.g. Main Auditorium or Zoom link" className="mt-1" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="capacity">
                                        Capacity{isTeamEvent ? " (teams)" : ""}
                                    </Label>
                                    <Input
                                        id="capacity"
                                        name="capacity"
                                        type="number"
                                        min="0"
                                        defaultValue="0"
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-zinc-400 mt-1">
                                        {isTeamEvent ? "Max teams. 0 = unlimited." : "0 = unlimited."}
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor="price">Price (₹)</Label>
                                    <Input id="price" name="price" type="number" min="0" defaultValue="0" className="mt-1" />
                                    <p className="text-xs text-zinc-400 mt-1">0 = free event.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader
                        title="Rules"
                        description="Event rules and guidelines — supports Markdown"
                        sectionKey="rules"
                    />
                    {expandedSections.rules && (
                        <div className="pb-5">
                            <div data-color-mode="light">
                                <MDEditor
                                    value={rules}
                                    onChange={(val) => setRules(val ?? "")}
                                    height={200}
                                    preview="edit"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader
                        title="Team Settings"
                        description="Configure team participation"
                        sectionKey="team"
                    />
                    {expandedSections.team && (
                        <div className="pb-5 space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isTeamEvent}
                                    onChange={(e) => setIsTeamEvent(e.target.checked)}
                                    className="w-4 h-4 accent-orange-500"
                                />
                                <div>
                                    <p className="text-sm font-medium text-zinc-900">Team Event</p>
                                    <p className="text-xs text-zinc-400">Enable team registration for this event</p>
                                </div>
                            </label>

                            {isTeamEvent && (
                                <div className="pl-7 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="teamSizeMinInput">Min Team Size</Label>
                                            <Input
                                                id="teamSizeMinInput"
                                                type="number"
                                                min="2"
                                                max={teamSizeMax}
                                                value={teamSizeMin}
                                                onChange={(e) => {
                                                    const v = Math.max(2, Number(e.target.value));
                                                    setTeamSizeMin(v);
                                                    if (v > teamSizeMax) setTeamSizeMax(v);
                                                }}
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="teamSizeMaxInput">Max Team Size</Label>
                                            <Input
                                                id="teamSizeMaxInput"
                                                type="number"
                                                min={teamSizeMin}
                                                value={teamSizeMax}
                                                onChange={(e) => {
                                                    const v = Math.max(teamSizeMin, Number(e.target.value));
                                                    setTeamSizeMax(v);
                                                }}
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
                                        <p className="text-xs font-medium text-orange-700 mb-1">How team registration works</p>
                                        <p className="text-xs text-orange-600">
                                            The team leader registers and enters{" "}
                                            {teamSizeMin - 1 === teamSizeMax - 1
                                                ? `exactly ${teamSizeMin - 1}`
                                                : `${teamSizeMin - 1}–${teamSizeMax - 1}`}{" "}
                                            teammate{teamSizeMax - 1 !== 1 ? "s" : ""} (name + email).
                                            Capacity counts teams, not individuals.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader
                        title="Registration Form"
                        description="Add custom fields for participants to fill out"
                        sectionKey="form"
                    />
                    {expandedSections.form && (
                        <div className="pb-5 space-y-3">
                            {formFields.length === 0 ? (
                                <p className="text-sm text-zinc-400 text-center py-4">
                                    No custom fields yet. Add fields below.
                                </p>
                            ) : (
                                formFields.map((field, index) => (
                                    <FormFieldRow
                                        key={field._id}
                                        field={field}
                                        index={index}
                                        onUpdate={updateField}
                                        onRemove={removeField}
                                    />
                                ))
                            )}
                            <button
                                type="button"
                                onClick={addField}
                                className="flex items-center gap-2 w-full justify-center py-2.5 border-2 border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                            >
                                <IconPlus size={16} />
                                Add Field
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 flex items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="text-sm text-zinc-500 hover:text-zinc-700"
                    >
                        Cancel
                    </button>
                    <div className="flex items-center gap-3">
                        <Button type="submit" variant="outline" disabled={loading} className="text-sm">
                            {loading ? "Saving…" : "Save as Draft"}
                        </Button>
                        <Button
                            type="button"
                            disabled={loading}
                            className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm"
                            onClick={(e) => {
                                const form = (e.target as HTMLElement).closest("form") as HTMLFormElement;
                                if (form) {
                                    handleSubmit(
                                        { currentTarget: form, preventDefault: () => { } } as any,
                                        "published"
                                    );
                                }
                            }}
                        >
                            Publish Event
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}