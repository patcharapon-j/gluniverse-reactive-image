"use client";

import type { PlayerSlot } from "@/lib/types";
import SlotCard from "./SlotCard";

interface SlotListProps {
  slots: PlayerSlot[];
  speakingUserIds: Set<string>;
  onEdit: (slot: PlayerSlot) => void;
  onDelete: (slotId: string) => void;
}

export default function SlotList({ slots, speakingUserIds, onEdit, onDelete }: SlotListProps) {
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-16">
        <svg
          className="mb-3 h-12 w-12 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <p className="text-gray-500">No player slots configured yet.</p>
        <p className="mt-1 text-sm text-gray-600">Click "Add Slot" to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {slots.map((slot) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          speaking={slot.discordUserId ? speakingUserIds.has(slot.discordUserId) : false}
          onEdit={() => onEdit(slot)}
          onDelete={() => onDelete(slot.id)}
        />
      ))}
    </div>
  );
}
