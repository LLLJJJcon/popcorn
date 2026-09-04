import {
  createSavedLibraryHttpHandlers,
  createSavedLibraryRuntime,
  createSavedLibraryService,
} from "@/features/saved/api";
import {
  authenticateCaptureRequest,
  type CaptureAuthentication,
} from "@/server/repositories/video-source-repository";

export function createExtensionSavedLibraryHandler({
  authenticate,
  service,
  requestId,
}: {
  readonly authenticate: (request: Request) => Promise<CaptureAuthentication>;
  readonly service: ReturnType<typeof createSavedLibraryService>;
  readonly requestId: () => string;
}) {
  return createSavedLibraryHttpHandlers({ authenticate, service, requestId }).list;
}

export async function GET(request: Request) {
  const runtime = createSavedLibraryRuntime();
  return createExtensionSavedLibraryHandler({
    authenticate: authenticateCaptureRequest,
    service: runtime.service,
    requestId: () => crypto.randomUUID(),
  })(request);
}
