import { redirect } from "next/navigation";

import { createSavedRuntime } from "@/features/saved/api";
import { SavedLibrary } from "@/features/saved/saved-library";

export default async function SavedPage() {
  const runtime = await createSavedRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");
  const videos = await runtime.service.list(session.userId);

  return <SavedLibrary videos={videos} />;
}
