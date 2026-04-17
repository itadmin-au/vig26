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
    IconPlus, IconTrash, IconGripVertical,
    IconChevronDown, IconChevronUp,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/manage/image-upload";
import type { IFormField, FormFieldType, IEventSlot, IEventRound } from "@/types";
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
                    placeholder={`e.g. Morning Session`}
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
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <IconTrash size={15} />
                </button>
            </div>
            <div>
                <Label className="text-xs mb-1">Round Name <span className="text-red-500">*</span></Label>
                <Input
                    value={round.label}
                    onChange={(e) => onUpdate(index, { label: e.target.value })}
                    placeholder={`e.g. Round ${index + 1} — Preliminary`}
                    className="h-8 text-sm"
                    required
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs mb-1">Start <span className="text-red-500">*</span></Label>
                    <Input
                        type="datetime-local"
                        value={round.start as unknown as string}
                        onChange={(e) => onUpdate(index, { start: e.target.value as unknown as Date })}
                        className="h-8 text-sm"
                    />
                </div>
                <div>
                    <Label className="text-xs mb-1">End <span className="text-red-500">*</span></Label>
                    <Input
                        type="datetime-local"
                        value={round.end as unknown as string}
                        onChange={(e) => onUpdate(index, { end: e.target.value as unknown as Date })}
                        className="h-8 text-sm"
                    />
                </div>
            </div>
            <div>
                <Label className="text-xs mb-1">Venue <span className="text-zinc-400">(optional)</span></Label>
                <Input
                    value={round.venue ?? ""}
                    onChange={(e) => onUpdate(index, { venue: e.target.value })}
                    placeholder="e.g. Lab 3B or Online"
                    className="h-8 text-sm"
                />
            </div>
            <div>
                <Label className="text-xs mb-1">Notes <span className="text-zinc-400">(optional)</span></Label>
                <Input
                    value={round.description ?? ""}
                    onChange={(e) => onUpdate(index, { description: e.target.value })}
                    placeholder="e.g. Top 20 teams advance"
                    className="h-8 text-sm"
                />
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
    // coverImageUrl holds the Cloudinary URL after upload (or null)
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [eventType, setEventType] = useState("inter");
    const [category, setCategory] = useState("");
    const [dateStart, setDateStart] = useState("");
    const [dateEnd, setDateEnd] = useState("");
    const [venue, setVenue] = useState("");
    const [capacity, setCapacity] = useState("0");
    const [price, setPrice] = useState("0");
    const [description, setDescription] = useState("");
    const [rules, setRules] = useState("");
    const [formFields, setFormFields] = useState<IFormField[]>([]);
    const [useSlots, setUseSlots] = useState(false);
    const [slots, setSlots] = useState<Omit<IEventSlot, "registrationCount">[]>([]);
    const [rounds, setRounds] = useState<Omit<IEventRound, "_id">[]>([]);
    const [isTeamEvent, setIsTeamEvent] = useState(false);
    const [pricePerPerson, setPricePerPerson] = useState(false);
    const [teamSizeMin, setTeamSizeMin] = useState(2);
    const [teamSizeMax, setTeamSizeMax] = useState(5);
    const [whatsappLink, setWhatsappLink] = useState("");
    const [externalRegistrationUrl, setExternalRegistrationUrl] = useState("");
    const [registrationInstructions, setRegistrationInstructions] = useState("");
    const [expandedSections, setExpandedSections] = useState({
        basic: true, details: true, rules: false, team: false, form: false, slots: false, rounds: false,
    });

    useEffect(() => {
        getCategories().then((cats: any[]) => {
            if (cats.length) {
                const slugs = cats.map((c) => c.slug);
                setCategories(slugs);
                setCategory(slugs[0]);
            } else {
                setCategory(DEFAULT_CATEGORIES[0]);
            }
        }).catch(() => { setCategory(DEFAULT_CATEGORIES[0]); });

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

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>, status: "draft" | "published") {
        e.preventDefault();

        if (!selectedDeptId) {
            toast.error("Please select a department.");
            return;
        }

        if (useSlots) {
            if (slots.length === 0) {
                toast.error("Add at least one time slot, or disable multiple slots.");
                return;
            }
            for (let i = 0; i < slots.length; i++) {
                const s = slots[i];
                if (!s.start || !s.end) {
                    toast.error(`Slot ${i + 1}: start and end dates are required.`);
                    return;
                }
                if (new Date(s.end as unknown as string) <= new Date(s.start as unknown as string)) {
                    toast.error(`Slot ${i + 1}: end must be after start.`);
                    return;
                }
            }
        } else if (dateStart && dateEnd && new Date(dateEnd) <= new Date(dateStart)) {
            toast.error("End date must be after the start date.");
            return;
        }

        setLoading(true);

        const formData = new FormData();
        formData.set("title", title);
        formData.set("type", eventType);
        formData.set("category", category);
        formData.set("dateStart", dateStart);
        formData.set("dateEnd", dateEnd);
        formData.set("venue", venue);
        formData.set("capacity", capacity);
        formData.set("price", price);
        formData.set("pricePerPerson", String(isTeamEvent && Number(price) > 0 && pricePerPerson));
        formData.set("status", status);
        formData.set("isTeamEvent", String(isTeamEvent));
        formData.set("description", description);
        formData.set("rules", rules);
        formData.set("departmentId", selectedDeptId);
        formData.set("customForm", JSON.stringify(formFields.map((f, i) => ({ ...f, order: i }))));
        formData.set("slots", useSlots ? JSON.stringify(slots) : "[]");
        formData.set("rounds", JSON.stringify(rounds));
        formData.set("whatsappLink", whatsappLink.trim());
        formData.set("externalRegistrationUrl", externalRegistrationUrl.trim());
        formData.set("registrationInstructions", registrationInstructions.trim());

        // Pass the already-uploaded Cloudinary URL as a plain string
        if (coverImageUrl) {
            formData.set("coverImage", coverImageUrl);
        }

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
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
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
                                <p className="text-xs text-zinc-400 mt-0.5 mb-1.5">
                                    Uploaded directly to Cloudinary. JPEG, PNG, WebP · Max 5MB.
                                </p>
                                <ImageUpload
                                    value={coverImageUrl}
                                    onChange={setCoverImageUrl}
                                    folder="event-covers"
                                    label="Click or drag to upload cover image"
                                    height="h-44"
                                />
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
                                        value={eventType}
                                        onChange={(e) => setEventType(e.target.value)}
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
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        required
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
                                        <Label htmlFor="dateStart">
                                            Start Date & Time <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="dateStart"
                                            type="datetime-local"
                                            value={dateStart}
                                            onChange={(e) => {
                                                setDateStart(e.target.value);
                                                if (dateEnd && e.target.value && new Date(dateEnd) <= new Date(e.target.value)) {
                                                    setDateEnd("");
                                                }
                                            }}
                                            required={!useSlots}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="dateEnd">
                                            End Date & Time <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="dateEnd"
                                            type="datetime-local"
                                            value={dateEnd}
                                            min={dateStart || undefined}
                                            onChange={(e) => setDateEnd(e.target.value)}
                                            required={!useSlots}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <Label htmlFor="venue">Venue</Label>
                                <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Main Auditorium or Zoom link" className="mt-1" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {!useSlots && (
                                    <div>
                                        <Label htmlFor="capacity">
                                            Capacity{isTeamEvent ? " (teams)" : ""}
                                        </Label>
                                        <Input
                                            id="capacity"
                                            type="number"
                                            min="0"
                                            value={capacity}
                                            onChange={(e) => setCapacity(e.target.value)}
                                            className="mt-1"
                                        />
                                        <p className="text-xs text-zinc-400 mt-1">
                                            {isTeamEvent ? "Max teams. 0 = unlimited." : "0 = unlimited."}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <Label htmlFor="price">Price (₹)</Label>
                                    <Input id="price" type="number" min="0" value={price} onChange={(e) => { setPrice(e.target.value); if (Number(e.target.value) === 0) setPricePerPerson(false); }} className="mt-1" />
                                    <p className="text-xs text-zinc-400 mt-1">0 = free event.</p>
                                    {Number(price) > 0 && (
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

                            <div>
                                <Label htmlFor="whatsappLink">WhatsApp Group Link <span className="text-zinc-400 font-normal">(optional)</span></Label>
                                <Input
                                    id="whatsappLink"
                                    value={whatsappLink}
                                    onChange={(e) => setWhatsappLink(e.target.value)}
                                    placeholder="https://chat.whatsapp.com/..."
                                    className="mt-1"
                                />
                                <p className="text-xs text-zinc-400 mt-1">Shown to participants after successful registration.</p>
                            </div>

                            <div>
                                <Label htmlFor="externalRegistrationUrl">External Registration URL <span className="text-zinc-400 font-normal">(optional)</span></Label>
                                <Input
                                    id="externalRegistrationUrl"
                                    value={externalRegistrationUrl}
                                    onChange={(e) => setExternalRegistrationUrl(e.target.value)}
                                    placeholder="https://devfolio.co/..."
                                    className="mt-1"
                                />
                                <p className="text-xs text-zinc-400 mt-1">If set, the Register button will redirect to this URL instead of the internal registration flow.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 px-5">
                    <SectionHeader
                        title="Time Slots"
                        description="Optional: let participants choose from multiple date/time slots"
                        sectionKey="slots"
                    />
                    {expandedSections.slots && (
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
                    <SectionHeader
                        title="Rounds"
                        description="Add sequential rounds (e.g. Prelims, Semi-finals, Finals) — shown on the event page"
                        sectionKey="rounds"
                    />
                    {expandedSections.rounds && (
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
                        <div className="pb-5 space-y-4">
                            <div>
                                <Label>Registration Instructions <span className="text-zinc-400 font-normal">(optional)</span></Label>
                                <p className="text-xs text-zinc-400 mt-0.5 mb-1.5">Shown at the top of the registration form. Supports Markdown — great for multi-step instructions (e.g. "Register on Devfolio first, then enter your project ID below").</p>
                                <div data-color-mode="light">
                                    <MDEditor
                                        value={registrationInstructions}
                                        onChange={(val) => setRegistrationInstructions(val ?? "")}
                                        height={180}
                                        preview="edit"
                                    />
                                </div>
                            </div>
                            <div className="border-t border-zinc-100 pt-3 space-y-3">
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
                            onClick={() => handleSubmit({ preventDefault: () => {} } as any, "published")}
                        >
                            Publish Event
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}