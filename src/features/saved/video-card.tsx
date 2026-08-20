import type { SavedVideoSummary } from "./api";
import { ProcessingState } from "./processing-state";

export function SavedVideoCard({ video }: { readonly video: SavedVideoSummary }) {
  return (
    <article aria-labelledby={`saved-video-${video.sourceId}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- persisted YouTube thumbnail URL is already constrained by the frozen source contract. */}
      <img src={video.thumbnailUrl} alt="" width={240} height={135} />
      <h2 id={`saved-video-${video.sourceId}`}>
        <a href={`/saved/${video.sourceId}`}>{video.title}</a>
      </h2>
      <p>{video.channel}</p>
      <p>{video.savedCount} saved {video.savedCount === 1 ? "moment" : "moments"}</p>
      <ProcessingState state={video.processingState} />
    </article>
  );
}
