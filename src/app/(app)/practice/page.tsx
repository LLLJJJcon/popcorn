import { redirect } from "next/navigation";
import { TodayPractice } from "@/features/practice/today-practice";
import { createTodayPracticeRuntime } from "@/server/today-practice-runtime";
export default async function PracticePage() {
  const runtime = await createTodayPracticeRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok)
    redirect("/sign-in");
  const data = await runtime.service.today(session.userId, new Date().toISOString());
  return <main><TodayPractice userId={session.userId} initialData={data}/></main>;
}
