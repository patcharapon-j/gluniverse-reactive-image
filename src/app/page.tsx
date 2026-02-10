"use client";

import { useState, useEffect, useCallback } from "react";
import type { PlayerSlot } from "@/lib/types";
import SlotList from "@/components/SlotList";
import SlotEditor from "@/components/SlotEditor";
import DiscordBotSetup from "@/components/DiscordBotSetup";
import FoundrySetup from "@/components/FoundrySetup";

export default function DashboardPage() {
  const [slots, setSlots] = useState<PlayerSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<PlayerSlot | null>(null);
  const [speakingUserIds, setSpeakingUserIds] = useState<Set<string>>(new Set());
  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch("/api/slots");
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } catch {
      // silently fail - slots will remain empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Poll for slot updates every 5s
  useEffect(() => {
    const interval = setInterval(fetchSlots, 5000);
    return () => clearInterval(interval);
  }, [fetchSlots]);

  // Poll for speaking state (derived from overlay state per slot)
  // The speaking indicators are informational in the dashboard; polling is sufficient

  function openCreate() {
    setEditingSlot(null);
    setEditorOpen(true);
  }

  function openEdit(slot: PlayerSlot) {
    setEditingSlot(slot);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingSlot(null);
  }

  function handleSaved() {
    closeEditor();
    fetchSlots();
  }

  async function handleDelete(slotId: string) {
    try {
      const res = await fetch(`/api/slots/${slotId}`, { method: "DELETE" });
      if (res.ok) {
        setSlots((prev) => prev.filter((s) => s.id !== slotId));
      }
    } catch {
      // silently fail
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">VTT Stream Overlay</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure player slots for your stream overlay
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Slot
        </button>
      </div>

      {/* Discord Bot Setup */}
      <DiscordBotSetup />

      {/* Foundry VTT Setup */}
      <FoundrySetup />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500" />
        </div>
      ) : (
        <SlotList
          slots={slots}
          speakingUserIds={speakingUserIds}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Editor Modal */}
      {editorOpen && (
        <SlotEditor slot={editingSlot} onClose={closeEditor} onSaved={handleSaved} />
      )}
    </div>
  );
}
