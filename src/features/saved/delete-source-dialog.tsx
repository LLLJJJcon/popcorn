"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DeletionImpact } from "@/server/domain/plan-source-deletion";

export function DeleteSourceDialog({ impact }: { readonly impact: DeletionImpact }) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const practiced = impact.mode === "remove_source_keep_evidence";

  async function remove() {
    if (!acknowledged || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/saved/${impact.videoSourceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: impact.mode }),
      });
      if (!response.ok) throw new Error("source deletion failed");
      router.push("/saved");
      router.refresh();
    } catch {
      setError("Popcorn could not delete this source. Review the effect and try again.");
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="delete-source-heading">
      <h2 id="delete-source-heading">Delete {impact.videoTitle}?</h2>
      <p>This will remove {impact.savedCount} saved moments and all source content.</p>
      {practiced ? (
        <p>
          {impact.affectedExpressionCount} practiced expressions are affected. Their attempts, mastery, and reviews will stay,
          marked Source deleted; video links, timestamps, and source evidence will be removed.
        </p>
      ) : (
        <p>No practiced expressions depend on this source, so all source-derived material will be removed.</p>
      )}
      <label>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.currentTarget.checked)}
        />
        I understand this permanently removes the saved source content.
      </label>
      <button type="button" disabled={!acknowledged || submitting} onClick={remove}>
        {submitting ? "Deleting…" : "Delete source"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
