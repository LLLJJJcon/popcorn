import { createSavedRuntime } from "@/features/saved/api";
import { createSourceDeletionHttpHandlers, createSourceDeletionService } from "@/server/domain/delete-source";

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly videoSourceId: string }> },
) {
  const runtime = await createSavedRuntime();
  const { videoSourceId } = await context.params;
  return createSourceDeletionHttpHandlers({
    authenticate: runtime.authenticate,
    planner: runtime.deletionPlanner,
    service: createSourceDeletionService({
      planner: runtime.deletionPlanner,
      repository: runtime.deletionRepository,
      now: () => new Date().toISOString(),
    }),
    requestId: () => crypto.randomUUID(),
  }).preview(request, videoSourceId);
}
