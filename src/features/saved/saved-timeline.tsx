import type { SavedItemView } from "./api";
import { sortSavedTimeline } from "./api";
import { ProcessingState } from "./processing-state";
import { DeleteSavedMoment } from "./delete-saved-moment";
import styles from "./saved-workspace.module.css";

function formatTimestamp(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` : `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function SavedTimeline({
  items,
  renderAfter,
  videoSourceId,
}: {
  readonly items: readonly SavedItemView[];
  readonly renderAfter?: (item: SavedItemView) => React.ReactNode;
  readonly videoSourceId?: string;
}) {
  return (
    <ol className={styles.timeline}>
      {sortSavedTimeline(items).map((item) => (
        <li className={styles.moment} id={`saved-item-${item.id}`} key={item.id}>
          <div className={styles.momentHeading}>
            <a className={styles.momentTimestamp} href={item.youtubeUrl}><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7z" /></svg>{item.startSeconds === null ? "Watch video" : formatTimestamp(item.startSeconds)}</a>
            {videoSourceId ? <DeleteSavedMoment sourceId={videoSourceId} savedItemId={item.id} /> : null}
          </div>
          {!(renderAfter && item.status === "ready" && item.targetSegments?.length) ? <>
            <p className={styles.rawText} data-testid="raw-text" lang="zh-CN">{item.rawText}</p>
            {item.englishTranslation ? <p className={styles.translation}>{item.englishTranslation}</p> : null}
          </> : null}
          {item.status === "ready" ? (
            !(renderAfter && item.targetSegments?.length) ? <p className={styles.savedStatus} role="status">Saved</p> : null
          ) : (
            <ProcessingState state={item.status} />
          )}
          {renderAfter?.(item)}
        </li>
      ))}
    </ol>
  );
}
