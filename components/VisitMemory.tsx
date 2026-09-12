"use client";

import { useEffect, useState } from "react";
import type { TripStop } from "@/lib/types";

export function VisitMemory({
  stop,
  onSave,
}: {
  stop: TripStop;
  onSave: (patch: Pick<TripStop, "visitedAt" | "note">) => void;
}) {
  const [visitedAt, setVisitedAt] = useState(stop.visitedAt ?? "");
  const [note, setNote] = useState(stop.note ?? "");

  useEffect(() => {
    setVisitedAt(stop.visitedAt ?? "");
    setNote(stop.note ?? "");
  }, [stop.id, stop.visitedAt, stop.note]);

  function save() {
    const nextVisitedAt = visitedAt.trim() || undefined;
    const nextNote = note.trim() || undefined;
    if (nextVisitedAt === stop.visitedAt && nextNote === stop.note) return;
    onSave({ visitedAt: nextVisitedAt, note: nextNote });
  }

  return (
    <div className="visit-memory" onClick={(e) => e.stopPropagation()}>
      <label className="visit-memory-time">
        <span className="font-mono muted">到访时间</span>
        <input
          type="datetime-local"
          value={visitedAt}
          onChange={(e) => setVisitedAt(e.target.value)}
          onBlur={save}
        />
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={save}
        rows={2}
        maxLength={500}
        placeholder="写下这一站的回忆……"
        aria-label={`${stop.name}的旅行回忆`}
      />
    </div>
  );
}
