import type { SavedItemView } from "./api";
import { sortSavedTimeline } from "./api";
import { ProcessingState } from "./processing-state";
import styles from "./saved-workspace.module.css";

export function SavedTimeline({
  items,
  renderAfter,
}: {
  readonly items: readonly SavedItemView[];
  readonly renderAfter?: (item: SavedItemView) => React.ReactNode;
}) {
  return (
    <ol className={styles.timeline}>
      {sortSavedTimeline(items).map((item) => (
        <li className={styles.moment} id={`saved-item-${item.id}`} key={item.id}>
          <a href={item.youtubeUrl}>{item.startSeconds === null ? "Watch video" : `${Math.floor(item.startSeconds)}s`}</a>
          <p className={styles.rawText} data-testid="raw-text" lang="zh-CN">{item.rawText}</p>
          {item.englishTranslation ? <p className={styles.translation}>{item.englishTranslation}</p> : null}
          {item.status === "ready" ? (
            <p className={styles.savedStatus} role="status">Saved</p>
          ) : (
            <ProcessingState state={item.status} />
          )}
          {renderAfter?.(item)}
        </li>
      ))}
    </ol>
  );
}
