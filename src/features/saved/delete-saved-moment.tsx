"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./saved-workspace.module.css";

export function DeleteSavedMoment({ sourceId, savedItemId }: {
  readonly sourceId: string;
  readonly savedItemId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/saved/${sourceId}/moments/${savedItemId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("deletion failed");
      const result = await response.json();
      if (!result.ok || result.data?.deleted !== true) throw new Error("invalid receipt");
      if (result.data.remainingCount === 0) router.push("/saved");
      router.refresh();
      setConfirming(false);
    } catch {
      setError("Could not delete this saved moment. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.momentDelete} onKeyDown={(event) => {
      if (event.key === "Escape" && !submitting) setConfirming(false);
    }}>
      <button className={styles.momentDeleteTrigger} type="button" aria-label="Delete saved moment"
        aria-expanded={confirming} disabled={submitting} onClick={() => { setError(null); setConfirming(!confirming); }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
        </svg>
        Delete
      </button>
      {confirming ? (
        <div className={styles.momentDeleteConfirm} role="group" aria-label="Delete this saved moment?">
          <p className={styles.momentDeleteTitle}>Delete this saved moment?</p>
          <p>It will be removed from Saved. Your practice history, mastery, and reviews will stay.</p>
          <div className={styles.momentDeleteActions}>
            <button type="button" disabled={submitting} onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" disabled={submitting} onClick={remove}>{submitting ? "Deleting…" : "Delete moment"}</button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
