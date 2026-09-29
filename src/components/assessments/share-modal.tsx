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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-visory-navy mb-2">Share your review with {memberName}?</h3>
        <p className="text-sm text-gray-600 mb-3">
          This shares your ratings and comments with {memberName} ahead of your 1:1, so they can prepare.
          You can still edit afterwards; edits after sharing are logged with a reason.
        </p>
        {!selfSubmitted && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
            <p className="text-sm text-amber-800">
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
