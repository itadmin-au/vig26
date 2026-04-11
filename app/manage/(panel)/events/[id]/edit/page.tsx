// app/manage/(panel)/events/[id]/edit/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { getManageEvents, updateEvent, getCategories } from "@/actions/events";
import { getDepartments } from "@/actions/admin";
import { toast } from "sonner";
import {
    IconPlus, IconTrash, IconGripVertical,
    IconChevronDown, IconChevronUp, IconArrowLeft,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/manage/image-upload";
import type { IFormField, FormFieldType, IEvent } from "@/types";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
    { value: "short_text", label: "Short Text" },
    { value: "long_text", label: "Long Text" },
    { value: "dropdown", label: "Dropdown" },
    { value: "file_upload", label: "File Upload" },
];

function FormFieldRow({
    field,
    index,
    onUpdate,
    onRemove,
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
                <div className="mt-1 text-zinc-300 cursor-grab">
                    <IconGripVertical size={18} />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-xs mb-1">Label</Label>
                        <Input
                            value={field.label}
                            onChange={(e) => onUpdate(index, { label: e.target.value })}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div>
                        <Label className="text-xs mb-1">Type</Label>
                        <select
                            value={field.type}
                            onChange={(e) => onUpdate(index, { type: e.target.value as FormFieldType })}
                            className="w-full h-8 text-sm border border-zinc-200 rounded-lg px-2 bg-white focus:outline-none"
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
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="flex items-end">
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
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {(field.options ?? []).map((opt, i) => (
                            <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-zinc-200 rounded-full text-xs">
                                {opt}
                                <button
                                    type="button"
                                    onClick={() => onUpdate(index, {
                                        options: field.options?.filter((_, oi) => oi !== i),
                                    })}
                                    className="text-zinc-400 hover:text-red-500"
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
                            placeholder="Add option (Enter)"
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

export default function EditEventPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { data: session } = useSession();
    const isSuperAdmin = session?.user?.role === "super_admin";

    const [event, setEvent] = useState<IEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState("");
    // coverImageUrl holds the Cloudinary URL (pre-existing from DB, or freshly uploaded)
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    const [rules, setRules] = useState("");
    const [formFields, setFormFields] = useState<IFormField[]>([]);
    const [isTeamEvent, setIsTeamEvent] = useState(false);
    const [teamSizeMin, setTeamSizeMin] = useState(2);
    const [teamSizeMax, setTeamSizeMax] = useState(5);
    const [googleSheetId, setGoogleSheetId] = useState("");
    const [expanded, setExpanded] = useState({
        basic: true, details: true, rules: false, team: false, form: false,
    });

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
                setTeamSizeMin(found.teamSize?.min ?? 2);
                setTeamSizeMax(found.teamSize?.max ?? 5);
                // Load existing cover image URL from DB into state
                setCoverImageUrl(found.coverImage ?? null);
                setDescription(found.description ?? "");
                setGoogleSheetId(found.googleSheetId ?? "");
                setRules(found.rules ?? "");
                setSelectedDeptId(
                    typeof found.department === "string"
                        ? found.department
                        : (found.department as any)?._id ?? ""
                );
            }

            setCategories((cats as any[]).map((c) => c.slug));

            if (isSuperAdmin) {
                const depts = await getDepartments();
                setDepartments(depts as any[]);
            }

            setLoading(false);
        }
        load();
    }, [id, isSuperAdmin]);

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

    const updateField = useCallback((i: number, u: Partial<IFormField>) => {
        setFormFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...u } : f)));
    }, []);

    const removeField = useCallback((i: number) => {
        setFormFields((prev) => prev.filter((_, idx) => idx !== i));
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);

        const formData = new FormData(e.currentTarget);
        formData.set("isTeamEvent", String(isTeamEvent));
        formData.set("description", description);
        formData.set("rules", rules);
        formData.set("departmentId", selectedDeptId);
        formData.set("customForm", JSON.stringify(formFields.map((f, i) => ({ ...f, order: i }))));
        formData.set("googleSheetId", googleSheetId.trim());

        // Pass current Cloudinary URL (or empty string to signal removal)
        formData.set("coverImage", coverImageUrl ?? "");

        if (isTeamEvent) {
            formData.set("teamSizeMin", String(teamSizeMin));
            formData.set("teamSizeMax", String(teamSizeMax));
        }

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
            <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, [sectionKey]: !p[sectionKey] }))}
                className="w-full flex items-center justify-between py-4 text-left"
            >
                <p className="text-sm font-semibold text-zinc-900">{title}</p>
                {expanded[sectionKey] ? (
                    <IconChevronUp size={16} className="text-zinc-400" />
                ) : (
                    <IconChevronDown size={16} className="text-zinc-400" />
                )}
            </button>
        );
    }

    const toDatetimeLocal = (d: any) =>
        d ? new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace(" ", "T").slice(0, 16) : "";

    if (loading) {
        return (
            <div className="animate-pulse space-y-4 max-w-3xl mx-auto">
                <div className="h-6 bg-zinc-100 rounded w-48" />
                <div className="bg-white rounded-xl border border-zinc-200 h-48" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="text-center py-20 text-zinc-400">Event not found.</div>
        );
    }

    return (
        <div className="space-y-5 max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                    <IconArrowLeft size={18} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Edit Event</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">{event.title}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

                {isSuperAdmin && (
                    <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
                        <Label htmlFor="deptSelect">Department</Label>
                        <select
                            id="deptSelect"
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            className="mt-1 w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        >
                            {departments.map((d) => (
                                <option key={d._id} value={d._id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Basic Info" sectionKey="basic" />
                    {expanded.basic && (
                        <div className="pb-5 space-y-4">
                            <div>
                                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                                <Input
                                    id="title"
                                    name="title"
                                    defaultValue={event.title}
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
                                <p className="text-xs text-zinc-400 mt-0.5 mb-1.5">
                                    Uploaded directly to Cloudinary. JPEG, PNG, WebP · Max 5MB.
                                </p>
                                {/* ImageUpload is pre-seeded with the existing DB URL.
                                    New uploads go to Cloudinary first, then the URL is stored in state. */}
                                <ImageUpload
                                    value={coverImageUrl}
                                    onChange={setCoverImageUrl}
                                    folder="event-covers"
                                    label="Click or drag to upload new cover"
                                    height="h-44"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Event Details" sectionKey="details" />
                    {expanded.details && (
                        <div className="pb-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="type">Type</Label>
                                    <select
                                        id="type"
                                        name="type"
                                        defaultValue={event.type}
                                        className="mt-1 w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    >
                                        <option value="inter">Inter College</option>
                                        <option value="intra">Intra College</option>
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="category">Category</Label>
                                    <select
                                        id="category"
                                        name="category"
                                        defaultValue={event.category}
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
                                    <Label htmlFor="dateStart">Start Date & Time</Label>
                                    <Input
                                        id="dateStart"
                                        name="dateStart"
                                        type="datetime-local"
                                        defaultValue={toDatetimeLocal(event.date?.start)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="dateEnd">End Date & Time</Label>
                                    <Input
                                        id="dateEnd"
                                        name="dateEnd"
                                        type="datetime-local"
                                        defaultValue={toDatetimeLocal(event.date?.end)}
                                        className="mt-1"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="venue">Venue</Label>
                                <Input
                                    id="venue"
                                    name="venue"
                                    defaultValue={event.venue ?? ""}
                                    placeholder="e.g. Main Auditorium or Zoom link"
                                    className="mt-1"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="capacity">Capacity</Label>
                                    <Input
                                        id="capacity"
                                        name="capacity"
                                        type="number"
                                        min="0"
                                        defaultValue={event.capacity ?? 0}
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-zinc-400 mt-1">0 = unlimited.</p>
                                </div>
                                <div>
                                    <Label htmlFor="price">Price (₹)</Label>
                                    <Input
                                        id="price"
                                        name="price"
                                        type="number"
                                        min="0"
                                        defaultValue={event.price ?? 0}
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-zinc-400 mt-1">0 = free event.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Rules" sectionKey="rules" />
                    {expanded.rules && (
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
                    <SectionHeader title="Team Settings" sectionKey="team" />
                    {expanded.team && (
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
                                    <p className="text-xs text-zinc-400">Enable team registration</p>
                                </div>
                            </label>

                            {isTeamEvent && (
                                <div className="pl-7 grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Min Team Size</Label>
                                        <Input
                                            type="number"
                                            min="2"
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
                                        <Label>Max Team Size</Label>
                                        <Input
                                            type="number"
                                            min={teamSizeMin}
                                            value={teamSizeMax}
                                            onChange={(e) => setTeamSizeMax(Math.max(teamSizeMin, Number(e.target.value)))}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Registration Form" sectionKey="form" />
                    {expanded.form && (
                        <div className="pb-5 space-y-3">
                            {formFields.map((field, index) => (
                                <FormFieldRow
                                    key={field._id}
                                    field={field}
                                    index={index}
                                    onUpdate={updateField}
                                    onRemove={removeField}
                                />
                            ))}
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

                <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 space-y-2">
                    <Label htmlFor="googleSheetId">Google Sheet ID</Label>
                    <p className="text-xs text-zinc-400">
                        Registrations will be appended automatically after each confirmed payment.
                        Share the sheet with your service account email (Editor access).
                    </p>
                    <Input
                        id="googleSheetId"
                        value={googleSheetId}
                        onChange={(e) => setGoogleSheetId(e.target.value)}
                        placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                        className="mt-1 font-mono text-xs"
                    />
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="text-sm text-zinc-500 hover:text-zinc-700"
                    >
                        Cancel
                    </button>
                    <Button
                        type="submit"
                        disabled={saving}
                        className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm"
                    >
                        {saving ? "Saving…" : "Save Changes"}
                    </Button>
                </div>
            </form>
        </div>
    );
}