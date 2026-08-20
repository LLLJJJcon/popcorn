import { redirect } from "next/navigation";

import { NextAction, selectNextAction } from "@/features/home/next-action";
import { createSavedRuntime } from "@/features/saved/api";

export default async function HomePage() {
  const runtime = await createSavedRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");
  const counts = await runtime.service.home(session.userId, new Date().toISOString());

  return (
    <main>
      <h1>Home</h1>
      <p>Keep turning moments from the Chinese YouTube videos you watch into language you can use.</p>
      <section aria-labelledby="next-action-heading">
        <h2 id="next-action-heading">Next action</h2>
        <NextAction action={selectNextAction(counts)} />
      </section>
    </main>
  );
}
