import { redirect } from "next/navigation";
import { TodaySession } from "@/features/practice/today-session";
import { createTodayPracticeRuntime } from "@/server/today-practice-runtime";
export default async function SessionPage() {
  const runtime = await createTodayPracticeRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok)
    redirect("/sign-in");
  return <main><TodaySession key={session.userId} userId={session.userId}/></main>;
}
