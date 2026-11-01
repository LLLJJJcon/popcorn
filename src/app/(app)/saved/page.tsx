import { redirect } from "next/navigation";

import { createSavedRuntime } from "@/features/saved/api";
import { SavedLibrary } from "@/features/saved/saved-library";
import { createTodayPracticeRuntime } from "@/server/today-practice-runtime";

export default async function SavedPage({ searchParams }: {
  readonly searchParams: Promise<{ readonly filter?: string | string[] }>;
}) {
  const { filter } = await searchParams;
  if (filter === "needs-analysis") {
    const runtime = await createTodayPracticeRuntime();
    const session = await runtime.authenticate(new Request(runtime.appUrl));
    if (!session.ok) redirect("/sign-in");
    const videos = await runtime.service.needsAnalysisVideos(session.userId, new Date().toISOString());
    return <SavedLibrary key="needs-analysis" videos={videos} initialFilter="needs-analysis" />;
  }
  const runtime = await createSavedRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");
  const videos = await runtime.service.list(session.userId);

  return <SavedLibrary key="all" videos={videos} />;
}
