"use client";

import { Button } from "@/components/ui/button";

interface ShareModalProps {
  memberName: string;
  selfSubmitted: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirms sharing the manager's review with the employee ahead of the 1:1. */
export function ShareModal({ memberName, selfSubmitted, busy, onConfirm, onCancel }: ShareModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4">
      <div className="card max-w-md w-full p-6 shadow-xl">
        <div className="eyebrow mb-2">Share ahead of the 1:1</div>
        <h3 className="serif text-xl mb-2">Share your review with {memberName}?</h3>
        <p className="text-sm muted-2 mb-3">
          {memberName} will be able to read your ratings and comments before your 1:1, so they can prepare.
          You can still edit afterwards; edits after sharing need a short reason and are logged.
        </p>
        {!selfSubmitted && (
          <div className="rounded-lg bg-paper-2 border border-amber/40 p-3 mb-4">
            <p className="text-sm text-ink-2">
              {memberName} hasn&apos;t submitted their self-assessment yet. You can share now, or wait so you can respond to their comments first.
            </p>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} disabled={busy}>{busy ? "Sharing..." : "Share review"}</Button>
        </div>
      </div>
    </div>
  );
}
