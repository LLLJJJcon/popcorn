import { createProgressHttpHandlers, createProgressRuntime } from "@/server/repositories/progress-repository";

export async function GET(request: Request) {
  const runtime = await createProgressRuntime();
  return createProgressHttpHandlers({
    authenticate: runtime.authenticate,
    repository: runtime.repository,
    now: () => new Date().toISOString(),
    requestId: () => crypto.randomUUID(),
  }).get(request);
}
