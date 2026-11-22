import type { SavedItemView } from "./api";
import styles from "./saved-workspace.module.css";

/** Project saved segment-relative marks onto the untouched source text. */
export function SavedSentencePreview({ item }: { readonly item: SavedItemView }) {
  const segments = item.targetSegments ?? [];
  const sourceText = segments.length ? segments.map(segment=>segment.text).join("\n") : item.rawText;
  const starts = new Map<string, number>();
  let searchFrom = 0;
  for (const segment of segments) {
    const start = sourceText.indexOf(segment.text, searchFrom);
    if (start >= 0) { starts.set(segment.id, start); searchFrom = start + segment.text.length; }
  }
  const ranges = (item.highlights ?? []).flatMap(highlight => {
    if (highlight.status !== "active") return [];
    const startBase = starts.get(highlight.startSegmentId), endBase = starts.get(highlight.endSegmentId);
    if (startBase === undefined || endBase === undefined) return [];
    const start = startBase + highlight.startOffset, end = endBase + highlight.endOffset;
    return start >= 0 && end > start && end <= sourceText.length ? [{ start, end }] : [];
  }).sort((a,b) => a.start - b.start);
  const runs: React.ReactNode[] = [];
  let cursor = 0;
  for (const {start,end} of ranges) {
    if (start < cursor) continue;
    if (start > cursor) runs.push(sourceText.slice(cursor,start));
    runs.push(<mark key={`${start}-${end}`} className={styles.previewHighlight}>{sourceText.slice(start,end)}</mark>);
    cursor = end;
  }
  runs.push(sourceText.slice(cursor));
  return <><span lang="zh-CN" data-testid="raw-text">{runs}</span>{sourceText!==item.rawText?<span className={styles.savedSelectionNote}>Saved selection: <span lang="zh-CN">{item.rawText}</span></span>:null}</>;
}
