import { redirect } from "next/navigation";

import { ProgressDashboard } from "@/features/progress/progress-dashboard";
import { createProgressRuntime } from "@/server/repositories/progress-repository";

export default async function ProgressPage() {
  const runtime = await createProgressRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");
  const summary = await runtime.repository.read(session.userId, new Date().toISOString());

  return <main><h1>Progress</h1><ProgressDashboard summary={summary} /></main>;
}
