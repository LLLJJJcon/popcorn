import Link from "next/link";
import { z } from "zod";

import { CandidateExpressionListSchema, HighlightAnalysisStateSchema } from "@/contracts/knowledge";
import {
  isReadableOverviewPromptVersion,
  OverviewContentSchema,
} from "@/server/ai/prompts/youtube-overview.v1";
import type { DeletionImpact as SourceDeletionImpact } from "@/server/domain/plan-source-deletion";
import type { SavedArtifactView, SavedVideoDetail } from "./api";
import { isReadableSavedAnalysisPromptVersion } from "@/server/ai/prompts/analyze-saved-item.v1";
import { type CandidateAnalysis } from "./candidate-list";
import { DeleteSavedSource } from "./delete-saved-source";
import { ProcessingState } from "./processing-state";
import { SavedDetailPanels } from "./saved-detail-panels";
import { SavedLearningWorkspace } from "./saved-learning-workspace";
import { LocalDate } from "@/features/home/local-date";
import styles from "./saved-workspace.module.css";

const CandidateArtifactContentSchema = z.object({ candidates: CandidateExpressionListSchema, highlightStates: z.array(HighlightAnalysisStateSchema).optional() });

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
        promptVersion: artifact.promptVersion,
        highlightStates: parsed.data.highlightStates,
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
}: {
  readonly video: SavedVideoDetail;
  readonly deletionImpact: SourceDeletionImpact;
}): React.JSX.Element {
  return (
    <main data-saved-workspace className={`${styles.workspace} ${styles.detailWorkspace}`}>
      <p>
        <Link className={styles.backLink} href="/saved">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 5-7 7 7 7M5 12h14" />
          </svg>
          Back to Saved
        </Link>
      </p>
      <div className={styles.detailToolbar}><span>Manage saved video</span><DeleteSavedSource sourceId={video.sourceId} title={video.title}/></div>
      <header className={styles.detailHeader}>
        {/* eslint-disable-next-line @next/next/no-img-element -- this is the persisted, source-owned YouTube thumbnail URL. */}
        <img className={styles.detailThumbnail} src={video.thumbnailUrl} alt="" width={320} height={180} />
        <div className={styles.detailInfo}>
          <p className={styles.eyebrow}>Saved YouTube video</p>
          <h1 title={video.title}>{video.title}</h1>
          <p>{video.channel} · {video.savedCount} saved {video.savedCount === 1 ? "moment" : "moments"}</p>
          <p className={styles.sourceUpdated}>Latest activity <LocalDate instant={video.latestSavedAt} /></p>
          {video.processingState !== "failed" ? <ProcessingState state={video.processingState} /> : null}
          <p className={styles.detailAction}>
            <a className={styles.youtubeAction} href={video.canonicalUrl}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch on YouTube
            </a>
          </p>
        </div>
      </header>

      {video.processingErrors.map((message, index) => (
        <p className={styles.alert} role="alert" key={`${message}-${index}`}>{message}</p>
      ))}

      <SavedDetailPanels overview={PersistedOverview({ video })}><section className={styles.paperSection} aria-labelledby="saved-moments-heading">

        <h2 id="saved-moments-heading">Saved moments</h2>
        <p className={styles.sectionIntroduction}>Keep the expressions you want to use. Mark the words, explore their meaning, then try them in a new situation.</p>
        <SavedLearningWorkspace videoSourceId={video.sourceId} youtubeUrl={video.canonicalUrl} items={video.items} analyses={Object.fromEntries(video.items.map(item => [item.id, latestCandidateAnalysis(video.artifacts, item.id)]))} />
      </section>

      </SavedDetailPanels>


    </main>
  );
}
