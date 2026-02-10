"use client";

import { useState, useEffect, useRef } from "react";
import type { PlayerSlot, DiscordUser, FoundryActor, ImageSet, DeepPartial, OverlaySettings } from "@/lib/types";
import OverlaySettingsEditor from "./OverlaySettingsEditor";

const IMAGE_KEYS: { key: keyof ImageSet; label: string }[] = [
  { key: "healthyIdle", label: "Healthy Idle" },
  { key: "healthySpeaking", label: "Healthy Speaking" },
  { key: "bloodiedIdle", label: "Bloodied Idle" },
  { key: "bloodiedSpeaking", label: "Bloodied Speaking" },
];

interface SlotEditorProps {
  slot: PlayerSlot | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function SlotEditor({ slot, onClose, onSaved }: SlotEditorProps) {
  const [name, setName] = useState(slot?.name ?? "");
  const [discordUserId, setDiscordUserId] = useState(slot?.discordUserId ?? "");
  const [foundryActorId, setFoundryActorId] = useState(slot?.foundryActorId ?? "");
  const [discordUsers, setDiscordUsers] = useState<DiscordUser[]>([]);
  const [foundryActors, setFoundryActors] = useState<FoundryActor[]>([]);
  const [imageFiles, setImageFiles] = useState<Partial<Record<keyof ImageSet, File>>>({});
  const [imagePreviews, setImagePreviews] = useState<Partial<Record<keyof ImageSet, string>>>({});
  const [overlaySettings, setOverlaySettings] = useState<DeepPartial<OverlaySettings>>(slot?.overlaySettings ?? {});
  const [showOverlaySettings, setShowOverlaySettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/discord-users")
      .then((r) => r.json())
      .then(setDiscordUsers)
      .catch(() => setDiscordUsers([]));

    fetch("/api/foundry-actors")
      .then((r) => r.json())
      .then(setFoundryActors)
      .catch(() => setFoundryActors([]));
  }, []);

  // Pre-populate discord username for dropdowns
  const selectedDiscordUser = discordUsers.find((u) => u.id === discordUserId);
  const selectedFoundryActor = foundryActors.find((a) => a.id === foundryActorId);

  function handleFileChange(key: keyof ImageSet, file: File | null) {
    if (!file) return;
    setImageFiles((prev) => ({ ...prev, [key]: file }));
    const url = URL.createObjectURL(file);
    setImagePreviews((prev) => ({ ...prev, [key]: url }));
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        discordUserId: discordUserId || null,
        discordUsername: selectedDiscordUser?.displayName ?? selectedDiscordUser?.username ?? null,
        foundryActorId: foundryActorId || null,
        foundryActorName: selectedFoundryActor?.name ?? null,
        overlaySettings,
      };

      let savedSlot: PlayerSlot;
      if (slot) {
        const res = await fetch(`/api/slots/${slot.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update slot");
        savedSlot = await res.json();
      } else {
        const res = await fetch("/api/slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create slot");
        savedSlot = await res.json();
      }

      // Upload images if any selected
      const fileKeys = Object.keys(imageFiles) as (keyof ImageSet)[];
      if (fileKeys.length > 0) {
        const formData = new FormData();
        for (const key of fileKeys) {
          const file = imageFiles[key];
          if (file) formData.append(key, file);
        }
        const imgRes = await fetch(`/api/slots/${savedSlot.id}/images`, {
          method: "POST",
          body: formData,
        });
        if (!imgRes.ok) throw new Error("Failed to upload images");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-100">
          {slot ? "Edit Slot" : "Create Slot"}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Name */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-400">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name or character"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Discord User */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-400">Discord User</label>
          <select
            value={discordUserId}
            onChange={(e) => setDiscordUserId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">
              {discordUsers.length === 0 ? "No users available" : "-- Select Discord User --"}
            </option>
            {discordUsers.map((u, i) => (
              <option key={`${u.id}-${i}`} value={u.id}>
                {u.displayName || u.username}
              </option>
            ))}
          </select>
        </div>

        {/* Foundry Actor */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-400">Foundry Actor</label>
          <select
            value={foundryActorId}
            onChange={(e) => setFoundryActorId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">
              {foundryActors.length === 0 ? "No actors available" : "-- Select Foundry Actor --"}
            </option>
            {foundryActors.map((a, i) => (
              <option key={`${a.id}-${i}`} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Image uploads - 2x2 grid */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-gray-400">Images</label>
          <div className="grid grid-cols-2 gap-3">
            {IMAGE_KEYS.map(({ key, label }) => {
              const preview = imagePreviews[key] || (slot?.images[key] ?? null);
              return (
                <label
                  key={key}
                  className="group flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-gray-600 bg-gray-800/50 p-3 transition hover:border-indigo-500 hover:bg-gray-800"
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt={label}
                      className="mb-1 h-16 w-16 rounded object-cover"
                    />
                  ) : (
                    <div className="mb-1 flex h-16 w-16 items-center justify-center rounded bg-gray-700 text-gray-500">
                      <svg
                        className="h-6 w-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </div>
                  )}
                  <span className="text-xs text-gray-400">{label}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(key, e.target.files?.[0] ?? null)}
                  />
                </label>
              );
            })}
          </div>
        </div>

        {/* Overlay Settings - collapsible */}
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setShowOverlaySettings(!showOverlaySettings)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
          >
            <span>Overlay Settings</span>
            <svg
              className={`h-4 w-4 text-gray-500 transition-transform ${showOverlaySettings ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showOverlaySettings && (
            <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
              <OverlaySettingsEditor
                settings={overlaySettings}
                onChange={setOverlaySettings}
              />
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
