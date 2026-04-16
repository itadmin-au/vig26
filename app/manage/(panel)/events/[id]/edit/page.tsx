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
import type { IFormField, FormFieldType, IEvent, IEventSlot, IEventRound } from "@/types";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

// ─── Slot row ─────────────────────────────────────────────────────────────────
function SlotRow({
    slot, index, onUpdate, onRemove,
}: {
    slot: Omit<IEventSlot, "registrationCount">;
    index: number;
    onUpdate: (i: number, u: Partial<Omit<IEventSlot, "registrationCount">>) => void;
    onRemove: (i: number) => void;
}) {
    return (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Slot {index + 1}</span>
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <IconTrash size={15} />
                </button>
            </div>
            <div>
                <Label className="text-xs mb-1">Label <span className="text-zinc-400">(optional)</span></Label>
                <Input
                    value={slot.label ?? ""}
                    onChange={(e) => onUpdate(index, { label: e.target.value })}
                    placeholder="e.g. Morning Session"
                    className="h-8 text-sm"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs mb-1">Start <span className="text-red-500">*</span></Label>
                    <Input
                        type="datetime-local"
                        value={slot.start as unknown as string}
                        onChange={(e) => onUpdate(index, { start: e.target.value as unknown as Date })}
                        className="h-8 text-sm"
                    />
                </div>
                <div>
                    <Label className="text-xs mb-1">End <span className="text-red-500">*</span></Label>
                    <Input
                        type="datetime-local"
                        value={slot.end as unknown as string}
                        onChange={(e) => onUpdate(index, { end: e.target.value as unknown as Date })}
                        className="h-8 text-sm"
                    />
                </div>
            </div>
            <div>
                <Label className="text-xs mb-1">Capacity (seats)</Label>
                <Input
                    type="number"
                    min="0"
                    value={slot.capacity}
                    onChange={(e) => onUpdate(index, { capacity: Number(e.target.value) })}
                    className="h-8 text-sm"
                />
                <p className="text-xs text-zinc-400 mt-1">0 = unlimited for this slot.</p>
            </div>
        </div>
    );
}

// ─── Round row ────────────────────────────────────────────────────────────────
function RoundRow({
    round, index, onUpdate, onRemove,
}: {
    round: Omit<IEventRound, "_id">;
    index: number;
    onUpdate: (i: number, u: Partial<Omit<IEventRound, "_id">>) => void;
    onRemove: (i: number) => void;
}) {
    return (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Round {index + 1}</span>
                <button type="button" onClick={() => onRemove(index)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <IconTrash size={15} />
                </button>
            </div>
            <div>
                <Label className="text-xs mb-1">Round Name <span className="text-red-500">*</span></Label>
                <Input value={round.label} onChange={(e) => onUpdate(index, { label: e.target.value })} placeholder={`e.g. Round ${index + 1} — Preliminary`} className="h-8 text-sm" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs mb-1">Start <span className="text-red-500">*</span></Label>
                    <Input type="datetime-local" value={round.start as unknown as string} onChange={(e) => onUpdate(index, { start: e.target.value as unknown as Date })} className="h-8 text-sm" />
                </div>
                <div>
                    <Label className="text-xs mb-1">End <span className="text-red-500">*</span></Label>
                    <Input type="datetime-local" value={round.end as unknown as string} onChange={(e) => onUpdate(index, { end: e.target.value as unknown as Date })} className="h-8 text-sm" />
                </div>
            </div>
            <div>
                <Label className="text-xs mb-1">Venue <span className="text-zinc-400">(optional)</span></Label>
                <Input value={round.venue ?? ""} onChange={(e) => onUpdate(index, { venue: e.target.value })} placeholder="e.g. Lab 3B or Online" className="h-8 text-sm" />
            </div>
            <div>
                <Label className="text-xs mb-1">Notes <span className="text-zinc-400">(optional)</span></Label>
                <Input value={round.description ?? ""} onChange={(e) => onUpdate(index, { description: e.target.value })} placeholder="e.g. Top 20 teams advance" className="h-8 text-sm" />
            </div>
        </div>
    );
}

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
    const [useSlots, setUseSlots] = useState(false);
    const [slots, setSlots] = useState<Omit<IEventSlot, "registrationCount">[]>([]);
    const [rounds, setRounds] = useState<Omit<IEventRound, "_id">[]>([]);
    const [isTeamEvent, setIsTeamEvent] = useState(false);
    const [pricePerPerson, setPricePerPerson] = useState(false);
    const [priceValue, setPriceValue] = useState("0");
    const [teamSizeMin, setTeamSizeMin] = useState(2);
    const [teamSizeMax, setTeamSizeMax] = useState(5);
    const [googleSheetId, setGoogleSheetId] = useState("");
    const [whatsappLink, setWhatsappLink] = useState("");
    const [externalRegistrationUrl, setExternalRegistrationUrl] = useState("");
    const [expanded, setExpanded] = useState({
        basic: true, details: true, rules: false, team: false, form: false, slots: false, rounds: false,
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
                setPricePerPerson((found as any).pricePerPerson ?? false);
                setPriceValue(String(found.price ?? 0));
                setTeamSizeMin(found.teamSize?.min ?? 2);
                setTeamSizeMax(found.teamSize?.max ?? 5);
                // Load existing cover image URL from DB into state
                setCoverImageUrl(found.coverImage ?? null);
                setDescription(found.description ?? "");
                setGoogleSheetId(found.googleSheetId ?? "");
                setWhatsappLink((found as any).whatsappLink ?? "");
                setExternalRegistrationUrl((found as any).externalRegistrationUrl ?? "");
                setRules(found.rules ?? "");
                setSelectedDeptId(
                    typeof found.department === "string"
                        ? found.department
                        : (found.department as any)?._id ?? ""
                );
                // Load existing slots
                const existingSlots = (found.slots ?? []) as IEventSlot[];
                if (existingSlots.length > 0) {
                    setUseSlots(true);
                    setSlots(existingSlots.map((s) => ({
                        _id: s._id,
                        label: s.label,
                        start: toDatetimeLocal(s.start) as unknown as Date,
                        end: toDatetimeLocal(s.end) as unknown as Date,
                        capacity: s.capacity,
                    })));
                }
                // Load existing rounds
                const existingRounds = (found.rounds ?? []) as IEventRound[];
                if (existingRounds.length > 0) {
                    setRounds(existingRounds.map((r) => ({
                        label: r.label,
                        start: toDatetimeLocal(r.start) as unknown as Date,
                        end: toDatetimeLocal(r.end) as unknown as Date,
                        venue: r.venue ?? "",
                        description: r.description ?? "",
                    })));
                }
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

    const addSlot = useCallback(() => {
        setSlots((prev) => [
            ...prev,
            { _id: Math.random().toString(36).slice(2), label: "", start: "" as unknown as Date, end: "" as unknown as Date, capacity: 0 },
        ]);
    }, []);

    const updateSlot = useCallback((index: number, updates: Partial<Omit<IEventSlot, "registrationCount">>) => {
        setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
    }, []);

    const removeSlot = useCallback((index: number) => {
        setSlots((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const addRound = useCallback(() => {
        setRounds((prev) => [
            ...prev,
            { label: "", start: "" as unknown as Date, end: "" as unknown as Date, venue: "", description: "" },
        ]);
    }, []);

    const updateRound = useCallback((index: number, updates: Partial<Omit<IEventRound, "_id">>) => {
        setRounds((prev) => prev.map((r, i) => (i === index ? { ...r, ...updates } : r)));
    }, []);

    const removeRound = useCallback((index: number) => {
        setRounds((prev) => prev.filter((_, i) => i !== index));
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);

        const formData = new FormData(e.currentTarget);
        const currentPrice = Number(formData.get("price") ?? 0);
        formData.set("pricePerPerson", String(isTeamEvent && currentPrice > 0 && pricePerPerson));
        formData.set("isTeamEvent", String(isTeamEvent));
        formData.set("description", description);
        formData.set("rules", rules);
        formData.set("departmentId", selectedDeptId);
        formData.set("customForm", JSON.stringify(formFields.map((f, i) => ({ ...f, order: i }))));
        formData.set("slots", useSlots ? JSON.stringify(slots) : "[]");
        formData.set("rounds", JSON.stringify(rounds));
        formData.set("googleSheetId", googleSheetId.trim());
        formData.set("whatsappLink", whatsappLink.trim());
        formData.set("externalRegistrationUrl", externalRegistrationUrl.trim());

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

                            {useSlots ? (
                                <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
                                    <p className="text-xs text-orange-700">
                                        Dates and capacity are managed per slot in the <strong>Time Slots</strong> section above.
                                        The event date will be auto-set to the range of your slots.
                                    </p>
                                </div>
                            ) : (
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
                            )}

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
                                {!useSlots && (
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
                                )}
                                <div>
                                    <Label htmlFor="price">Price (₹)</Label>
                                    <Input
                                        id="price"
                                        name="price"
                                        type="number"
                                        min="0"
                                        value={priceValue}
                                        onChange={(e) => { setPriceValue(e.target.value); if (Number(e.target.value) === 0) setPricePerPerson(false); }}
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-zinc-400 mt-1">0 = free event.</p>
                                    {Number(priceValue) > 0 && (
                                        <div className="flex items-center gap-4 mt-2">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="pricingMode"
                                                    checked={!pricePerPerson}
                                                    onChange={() => setPricePerPerson(false)}
                                                    className="accent-orange-500"
                                                />
                                                <span className="text-xs text-zinc-700">Per team</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="pricingMode"
                                                    checked={pricePerPerson}
                                                    onChange={() => setPricePerPerson(true)}
                                                    className="accent-orange-500"
                                                />
                                                <span className="text-xs text-zinc-700">Per person</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Time Slots" sectionKey="slots" />
                    {expanded.slots && (
                        <div className="pb-5 space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useSlots}
                                    onChange={(e) => {
                                        setUseSlots(e.target.checked);
                                        if (e.target.checked && slots.length === 0) addSlot();
                                    }}
                                    className="w-4 h-4 accent-orange-500"
                                />
                                <div>
                                    <p className="text-sm font-medium text-zinc-900">Enable multiple time slots</p>
                                    <p className="text-xs text-zinc-400">Participants will choose a slot when registering. Each slot has its own capacity.</p>
                                </div>
                            </label>

                            {useSlots && (
                                <div className="space-y-3">
                                    {slots.map((slot, i) => (
                                        <SlotRow
                                            key={slot._id}
                                            slot={slot}
                                            index={i}
                                            onUpdate={updateSlot}
                                            onRemove={removeSlot}
                                        />
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addSlot}
                                        className="flex items-center gap-2 w-full justify-center py-2.5 border-2 border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                                    >
                                        <IconPlus size={16} />
                                        Add Slot
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader title="Rounds" sectionKey="rounds" />
                    {expanded.rounds && (
                        <div className="pb-5 space-y-3">
                            {rounds.length === 0 ? (
                                <p className="text-sm text-zinc-400 text-center py-4">
                                    No rounds yet. Add rounds to show participants the event schedule.
                                </p>
                            ) : (
                                rounds.map((round, i) => (
                                    <RoundRow
                                        key={i}
                                        round={round}
                                        index={i}
                                        onUpdate={updateRound}
                                        onRemove={removeRound}
                                    />
                                ))
                            )}
                            <button
                                type="button"
                                onClick={addRound}
                                className="flex items-center gap-2 w-full justify-center py-2.5 border-2 border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                            >
                                <IconPlus size={16} />
                                Add Round
                            </button>
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
                    <Label htmlFor="whatsappLink">WhatsApp Group Link <span className="text-zinc-400 font-normal">(optional)</span></Label>
                    <p className="text-xs text-zinc-400">
                        Shown to participants after successful registration on the confirmation screen and in their My Tickets page.
                    </p>
                    <Input
                        id="whatsappLink"
                        value={whatsappLink}
                        onChange={(e) => setWhatsappLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                        className="mt-1"
                    />
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 space-y-2">
                    <Label htmlFor="externalRegistrationUrl">External Registration URL <span className="text-zinc-400 font-normal">(optional)</span></Label>
                    <p className="text-xs text-zinc-400">
                        If set, the Register button on the event page will redirect to this URL instead of the internal registration flow.
                    </p>
                    <Input
                        id="externalRegistrationUrl"
                        value={externalRegistrationUrl}
                        onChange={(e) => setExternalRegistrationUrl(e.target.value)}
                        placeholder="https://devfolio.co/..."
                        className="mt-1"
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