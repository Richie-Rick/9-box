"use client";

import { useEffect, useState } from "react";
import type { AgreedActionData } from "./meeting-view";

interface FromYourMeetingProps {
  assessmentId?: string;
  notes: string | null;
  heldAt: string;
}

/** What the employee sees after the 1:1: the manager's notes and the agreed actions. */
export function FromYourMeeting({ assessmentId, notes, heldAt }: FromYourMeetingProps) {
  const [actions, setActions] = useState<AgreedActionData[]>([]);

  useEffect(() => {
    if (!assessmentId) return;
    fetch(`/api/assessments/manager/actions?assessmentId=${assessmentId}`)
      .then((r) => r.json())
      .then((data) => setActions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [assessmentId]);

  async function toggle(action: AgreedActionData) {
    const res = await fetch("/api/assessments/manager/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: action.id, done: !action.done }),
    });
    if (res.ok) {
      const updated = await res.json();
      setActions((a) => a.map((x) => (x.id === action.id ? updated : x)));
    }
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/40 p-4">
      <h3 className="text-sm font-semibold text-visory-navy uppercase mb-1">From your 1:1</h3>
      <p className="text-xs text-gray-500 mb-3">
        Held {new Date(heldAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
      </p>
      {notes ? (
        <p className="text-sm text-visory-navy whitespace-pre-wrap mb-3">{notes}</p>
      ) : (
        <p className="text-sm text-gray-400 italic mb-3">No notes were recorded.</p>
      )}
      {actions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Agreed actions</p>
          <ul className="space-y-1">
            {actions.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={a.done}
                  onChange={() => toggle(a)}
                  className="mt-1 rounded border-gray-300 text-visory focus:ring-visory"
                />
                <span className={`text-sm ${a.done ? "line-through text-gray-400" : "text-visory-navy"}`}>{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
