import type { SavedVideoSummary } from "./api";
import { ProcessingState } from "./processing-state";
import styles from "./saved-workspace.module.css";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function SavedVideoCard({ video }: { readonly video: SavedVideoSummary }) {
  return (
    <article className={styles.videoCard} aria-labelledby={`saved-video-${video.sourceId}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- persisted YouTube thumbnail URL is already constrained by the frozen source contract. */}
      <img className={styles.videoThumbnail} src={video.thumbnailUrl} alt={`${video.title} thumbnail`} width={480} height={270} />
      <div className={styles.videoCardBody}>
        <h2 id={`saved-video-${video.sourceId}`}>
          <a href={`/saved/${video.sourceId}`}>{video.title}</a>
        </h2>
        <p className={styles.videoMeta}>{video.channel}</p>
        <p className={styles.videoMeta}>{video.savedCount} saved {video.savedCount === 1 ? "moment" : "moments"}</p>
        <p className={styles.latestActivity}>Latest activity {dateFormatter.format(new Date(video.latestSavedAt))}</p>
        <ProcessingState state={video.processingState} />
      </div>
    </article>
  );
}
