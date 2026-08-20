import { redirect } from "next/navigation";

import { DuePractice } from "@/features/practice/due-practice";
import { createLearningMemoryRuntime } from "@/server/repositories/review-task-repository";

export default async function PracticePage() {
  const runtime = await createLearningMemoryRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");
  const tasks = await runtime.repository.listDue(session.userId, new Date().toISOString());
  return <main><DuePractice tasks={tasks} /></main>;
}
