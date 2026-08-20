import type { SavedItemView } from "./api";
import { sortSavedTimeline } from "./api";
import { ProcessingState } from "./processing-state";

export function SavedTimeline({ items }: { readonly items: readonly SavedItemView[] }) {
  return (
    <ol>
      {sortSavedTimeline(items).map((item) => (
        <li key={item.id}>
          <a href={item.youtubeUrl}>{item.startSeconds === null ? "Watch video" : `${Math.floor(item.startSeconds)}s`}</a>
          <p data-testid="raw-text" lang="zh-CN">{item.rawText}</p>
          {item.englishTranslation ? <p>{item.englishTranslation}</p> : null}
          <ProcessingState state={item.status} />
        </li>
      ))}
    </ol>
  );
}
