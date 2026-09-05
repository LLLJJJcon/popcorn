import { redirect } from "next/navigation";

import { HomeDashboard } from "@/features/home/home-dashboard";
import { createHomeRuntime } from "@/features/home/home-runtime";

export default async function HomePage() {
  const runtime = await createHomeRuntime();
  const result = await runtime.load(new Request(runtime.appUrl), new Date().toISOString());
  if (!result.ok) redirect("/sign-in");

  return <HomeDashboard view={result.view} />;
}
