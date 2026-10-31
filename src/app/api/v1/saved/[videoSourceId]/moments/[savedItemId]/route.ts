import { createSavedRuntime } from "@/features/saved/api";
import { createSavedMomentDeletionHandler } from "@/server/domain/delete-saved-moment";

export async function DELETE(
  request: Request,
  context: { readonly params: Promise<{ readonly videoSourceId: string; readonly savedItemId: string }> },
) {
  const runtime = await createSavedRuntime();
  const { videoSourceId, savedItemId } = await context.params;
  return createSavedMomentDeletionHandler({
    authenticate: runtime.authenticate,
    remove: runtime.removeSavedMoment,
    requestId: () => crypto.randomUUID(),
  })(request, videoSourceId, savedItemId);
}
