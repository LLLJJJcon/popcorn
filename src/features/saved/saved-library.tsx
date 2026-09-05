"use client";

import { useState } from "react";

import type { SavedVideoSummary } from "./api";
import styles from "./saved-workspace.module.css";
import { SavedVideoCard } from "./video-card";

export type SavedLibraryFilter = "all" | "ready" | "processing";

const filters: readonly { readonly value: SavedLibraryFilter; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready to learn" },
  { value: "processing", label: "Processing" },
];

export function SavedLibrary({ videos }: { readonly videos: readonly SavedVideoSummary[] }): React.JSX.Element {
  const [filter, setFilter] = useState<SavedLibraryFilter>("all");
  const hasReady = videos.some(({ processingState }) => processingState === "ready");
  const hasProcessing = videos.some(({ processingState }) => processingState !== "ready");
  const showFilters = hasReady && hasProcessing;
  const filtered = videos.filter((video) =>
    filter === "all"
      || (filter === "ready" && video.processingState === "ready")
      || (filter === "processing" && video.processingState !== "ready"),
  );

  return (
    <main className={styles.workspace}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>YouTube learning library</p>
        <h1>Saved</h1>
        <p>Return to the moments you captured, then choose an expression to practice.</p>
      </header>

      {videos.length === 0 ? (
        <section className={styles.emptyState} aria-label="Empty Saved library">
          <h2>Your Saved library is ready</h2>
          <p>Save a moment from the Popcorn extension while watching a Chinese YouTube video, and it will appear here.</p>
        </section>
      ) : (
        <>
          {showFilters ? (
            <div className={styles.filters} aria-label="Filter saved videos">
              {filters.map(({ value, label }) => (
                <button
                  className={styles.filterButton}
                  type="button"
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles.videoGrid}>{filtered.map((video) => (
            <SavedVideoCard key={video.sourceId} video={video} />
          ))}</div>
        </>
      )}
    </main>
  );
}
