import { createSavedLibraryHttpHandlers, createSavedRuntime } from "@/features/saved/api";

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly videoSourceId: string }> },
) {
  const runtime = await createSavedRuntime();
  const { videoSourceId } = await context.params;
  return createSavedLibraryHttpHandlers({
    authenticate: runtime.authenticate,
    service: runtime.service,
    requestId: () => crypto.randomUUID(),
  }).detail(request, videoSourceId);
}
