import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSavedRuntime } from "@/features/saved/api";
import { CandidateList } from "@/features/saved/candidate-list";
import { ProcessingState } from "@/features/saved/processing-state";
import { SavedTimeline } from "@/features/saved/saved-timeline";

function artifactTitle(type: string) {
  return type.split("_").map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`).join(" ");
}

export default async function SavedVideoPage({
  params,
}: {
  readonly params: Promise<{ readonly videoSourceId: string }>;
}) {
  const { videoSourceId } = await params;
  const runtime = await createSavedRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");
  const video = await runtime.service.detail(session.userId, videoSourceId);
  if (!video) notFound();

  return (
    <main>
      <p><Link href="/saved">Back to Saved</Link></p>
      <h1>{video.title}</h1>
      <p>{video.channel} · {video.savedCount} saved moments</p>
      <ProcessingState state={video.processingState} />
      {video.processingErrors.map((message, index) => <p role="alert" key={`${message}-${index}`}>{message}</p>)}

      <section aria-labelledby="saved-moments-heading">
        <h2 id="saved-moments-heading">Saved moments</h2>
        <SavedTimeline items={video.items} />
      </section>

      {video.items.map((item) => {
        const artifact = video.artifacts.find((entry) =>
          entry.type === "saved_item_analysis" && entry.savedItemId === item.id,
        );
        return (
          <CandidateList
            key={`candidates-${item.id}`}
            savedItemId={item.id}
            youtubeUrl={video.canonicalUrl}
            artifact={artifact ? {
              artifactId: artifact.artifactId,
              savedItemId: artifact.savedItemId!,
              content: artifact.content,
            } : null}
          />
        );
      })}

      {video.artifacts.filter(({ type }) => type !== "saved_item_analysis").map((artifact, index) => (
        <section key={`${artifact.type}-${index}`} aria-label={artifactTitle(artifact.type)}>
          <h2>{artifactTitle(artifact.type)}</h2>
          <pre>{JSON.stringify(artifact.content, null, 2)}</pre>
        </section>
      ))}
    </main>
  );
}
