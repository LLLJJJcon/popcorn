import Link from "next/link";
import { z } from "zod";

import { CandidateExpressionListSchema } from "@/contracts/knowledge";
import {
  isReadableOverviewPromptVersion,
  OverviewContentSchema,
} from "@/server/ai/prompts/youtube-overview.v1";
import type { DeletionImpact as SourceDeletionImpact } from "@/server/domain/plan-source-deletion";
import type { SavedArtifactView, SavedVideoDetail } from "./api";
import { isReadableSavedAnalysisPromptVersion } from "@/server/ai/prompts/analyze-saved-item.v1";
import { CandidateList, type CandidateAnalysis } from "./candidate-list";
import { DeleteSourceDialog } from "./delete-source-dialog";
import { ProcessingState } from "./processing-state";
import { SavedTimeline } from "./saved-timeline";
import styles from "./saved-workspace.module.css";

const CandidateArtifactContentSchema = z.strictObject({ candidates: CandidateExpressionListSchema });

function latestCandidateAnalysis(
  artifacts: readonly SavedArtifactView[],
  savedItemId: string,
): CandidateAnalysis {
  let foundCandidateArtifact = false;
  for (let index = artifacts.length - 1; index >= 0; index -= 1) {
    const artifact = artifacts[index]!;
    if (artifact.type !== "saved_item_analysis" || artifact.savedItemId !== savedItemId) continue;
    foundCandidateArtifact = true;
    if (!isReadableSavedAnalysisPromptVersion(artifact.promptVersion)) continue;
    const parsed = CandidateArtifactContentSchema.safeParse(artifact.content);
    if (!parsed.success) continue;
    return {
      state: "ready",
      artifact: {
        artifactId: artifact.artifactId,
        savedItemId,
        candidates: parsed.data.candidates,
      },
    };
  }
  return foundCandidateArtifact ? { state: "unavailable" } : { state: "missing" };
}

function timestampUrl(canonicalUrl: string, seconds: number) {
  const url = new URL(canonicalUrl);
  url.searchParams.set("t", `${Math.max(0, Math.floor(seconds))}s`);
  return url.toString();
}

function PersistedOverview({ video }: { readonly video: SavedVideoDetail }) {
  let overview: z.infer<typeof OverviewContentSchema> | null = null;
  for (let index = video.artifacts.length - 1; index >= 0; index -= 1) {
    const artifact = video.artifacts[index]!;
    if (artifact.type !== "overview" || !isReadableOverviewPromptVersion(artifact.promptVersion)) continue;
    const parsed = OverviewContentSchema.safeParse(artifact.content);
    if (!parsed.success) continue;
    overview = parsed.data;
    break;
  }
  if (!overview) return null;

  return (
    <section className={styles.paperSection} aria-labelledby="saved-overview-heading">
      <p className={styles.eyebrow}>Generated from this saved video</p>
      <h2 id="saved-overview-heading">Video overview</h2>
      <p>{overview.overview}</p>
      <div className={styles.chapterGrid}>
        {overview.chapters.map((chapter) => (
          <article className={styles.chapter} key={`${chapter.timestampSeconds}-${chapter.title}`}>
            <h3>{chapter.title}</h3>
            <p>{chapter.summary}</p>
            <a href={timestampUrl(video.canonicalUrl, chapter.timestampSeconds)}>Watch this chapter</a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SavedVideoDetailView({
  video,
  deletionImpact,
}: {
  readonly video: SavedVideoDetail;
  readonly deletionImpact: SourceDeletionImpact;
}): React.JSX.Element {
  return (
    <main className={styles.workspace}>
      <p><Link className={styles.backLink} href="/saved">Back to Saved</Link></p>
      <header className={styles.detailHeader}>
        {/* eslint-disable-next-line @next/next/no-img-element -- this is the persisted, source-owned YouTube thumbnail URL. */}
        <img className={styles.detailThumbnail} src={video.thumbnailUrl} alt="" width={320} height={180} />
        <div>
          <p className={styles.eyebrow}>Saved YouTube video</p>
          <h1>{video.title}</h1>
          <p>{video.channel} · {video.savedCount} saved {video.savedCount === 1 ? "moment" : "moments"}</p>
          <p><a href={video.canonicalUrl}>Watch on YouTube</a></p>
          <ProcessingState state={video.processingState} />
        </div>
      </header>

      {video.processingErrors.map((message, index) => (
        <p className={styles.alert} role="alert" key={`${message}-${index}`}>{message}</p>
      ))}

      <section className={styles.paperSection} aria-labelledby="saved-moments-heading">
        <p className={styles.eyebrow}>Your source material</p>
        <h2 id="saved-moments-heading">Saved moments</h2>
        <SavedTimeline
          items={video.items}
          renderAfter={(item) => (
            <CandidateList
              savedItemId={item.id}
              videoSourceId={video.sourceId}
              youtubeUrl={video.canonicalUrl}
              analysis={latestCandidateAnalysis(video.artifacts, item.id)}
            />
          )}
        />
      </section>

      <PersistedOverview video={video} />

      <div className={styles.deleteSection}>
        <DeleteSourceDialog impact={deletionImpact} />
      </div>
    </main>
  );
}
