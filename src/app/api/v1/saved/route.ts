import { createSavedLibraryHttpHandlers, createSavedRuntime } from "@/features/saved/api";

export async function GET(request: Request) {
  const runtime = await createSavedRuntime();
  return createSavedLibraryHttpHandlers({
    authenticate: runtime.authenticate,
    service: runtime.service,
    requestId: () => crypto.randomUUID(),
  }).list(request);
}
