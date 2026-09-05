import { notFound, redirect } from "next/navigation";

import { createSavedRuntime } from "@/features/saved/api";
import { SavedVideoDetailView } from "@/features/saved/saved-video-detail";

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
  const deletionImpact = await runtime.deletionPlanner.preview(session.userId, videoSourceId);
  if (!deletionImpact) notFound();

  return <SavedVideoDetailView video={video} deletionImpact={deletionImpact} />;
}
