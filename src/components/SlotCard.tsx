"use client";

import { useState } from "react";
import type { PlayerSlot, ImageSet } from "@/lib/types";

const IMAGE_LABELS: { key: keyof ImageSet; label: string }[] = [
  { key: "healthyIdle", label: "Healthy Idle" },
  { key: "healthySpeaking", label: "Healthy Speaking" },
  { key: "bloodiedIdle", label: "Bloodied Idle" },
  { key: "bloodiedSpeaking", label: "Bloodied Speaking" },
];

interface SlotCardProps {
  slot: PlayerSlot;
  speaking: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SlotCard({ slot, speaking, onEdit, onDelete }: SlotCardProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function copyOverlayUrl() {
    const url = `${window.location.origin}/overlay/${slot.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete();
  }

  return (
    <div className="flex flex-col rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-lg transition hover:border-gray-600">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">{slot.name}</h3>
        <span
          className={`h-3 w-3 rounded-full ${speaking ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-gray-500"}`}
          title={speaking ? "Speaking" : "Idle"}
        />
      </div>

      {/* Assignments */}
      <div className="mb-3 space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Discord:</span>
          <span className={slot.discordUsername ? "text-gray-200" : "text-gray-500 italic"}>
            {slot.discordUsername || "Not assigned"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Foundry:</span>
          <span className={slot.foundryActorName ? "text-gray-200" : "text-gray-500 italic"}>
            {slot.foundryActorName || "Not assigned"}
          </span>
        </div>
      </div>

      {/* Image thumbnails - 2x2 grid */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {IMAGE_LABELS.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center">
            {slot.images[key] ? (
              <img
                src={slot.images[key]!}
                alt={label}
                className="h-16 w-16 rounded border border-gray-600 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded border border-gray-700 bg-gray-900 text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
            <span className="mt-1 text-[10px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap gap-2">
        <button
          onClick={onEdit}
          className="rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-400 transition hover:bg-indigo-600/30"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            confirmDelete
              ? "bg-red-600 text-white"
              : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
          }`}
        >
          {confirmDelete ? "Confirm?" : "Delete"}
        </button>
        <button
          onClick={copyOverlayUrl}
          className="rounded-lg bg-purple-600/20 px-3 py-1.5 text-xs font-medium text-purple-400 transition hover:bg-purple-600/30"
        >
          {copied ? "Copied!" : "Copy Overlay URL"}
        </button>
      </div>
    </div>
  );
}
