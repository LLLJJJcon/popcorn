import { redirect } from "next/navigation";

import { createSavedRuntime } from "@/features/saved/api";
import { SavedVideoCard } from "@/features/saved/video-card";

export default async function SavedPage() {
  const runtime = await createSavedRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");
  const videos = await runtime.service.list(session.userId);

  return (
    <main>
      <h1>Saved</h1>
      <p>Your saved learning snapshots, grouped by the YouTube video you were watching.</p>
      {videos.length === 0
        ? <p>No saved moments yet. Save one while watching a Chinese YouTube video.</p>
        : <div>{videos.map((video) => <SavedVideoCard key={video.sourceId} video={video} />)}</div>}
    </main>
  );
}
