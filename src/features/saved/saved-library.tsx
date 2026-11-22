"use client";

import Link from "next/link";

import type { SavedVideoSummary } from "./api";
import styles from "./saved-workspace.module.css";
import { SavedVideoCard } from "./video-card";

export type SavedLibraryFilter = "all" | "ready" | "processing";

export function SavedLibrary({ videos, initialFilter = "all" }: {
  readonly videos: readonly SavedVideoSummary[];
  readonly initialFilter?: "all" | "needs-analysis";
}): React.JSX.Element {
  const needsAnalysisOnly = initialFilter === "needs-analysis";

  return (
    <main className={styles.workspace}>
      <header className={styles.pageHeader}>

        <h1>Saved</h1>
        <p>Return to the moments you captured, then choose an expression to practice.</p>
      </header>

      {needsAnalysisOnly ? <nav className={styles.filters} aria-label="Filter saved videos">
        <Link className={styles.filterButton} href="/saved">All</Link>
        <span className={styles.filterButton} aria-current="page">Needs analysis</span>
      </nav> : null}

      {videos.length === 0 ? (
        <section className={styles.emptyState} aria-label="Empty Saved library">
          <h2>{needsAnalysisOnly ? "No saves need analysis" : "Your Saved library is ready"}</h2>
          <p>{needsAnalysisOnly ? "There are no marked saves waiting for analysis. Choose All to see your Saved library." : "Save a moment from the Popcorn extension while watching a Chinese YouTube video, and it will appear here."}</p>
        </section>
      ) : (
        <>
          <div className={styles.videoGrid}>{videos.map((video) => (
            <SavedVideoCard key={video.sourceId} video={video} />
          ))}</div>
        </>
      )}
    </main>
  );
}
