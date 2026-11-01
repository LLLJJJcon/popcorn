import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ReviewPractice } from "@/features/practice/review-practice";
import { createTodayPracticeRuntime } from "@/server/today-practice-runtime";
export default async function ReviewPage({ params }: {
  readonly params: Promise<{
    readonly reviewTaskId: string;
  }>;
}) {
  const runtime = await createTodayPracticeRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok)
    redirect("/sign-in");
  const parsed = z.string().uuid().safeParse((await params).reviewTaskId);
  if (!parsed.success)
    notFound();
  return <main><ReviewPractice key={parsed.data} reviewTaskId={parsed.data}/></main>;
}
