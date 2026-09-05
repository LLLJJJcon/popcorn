import {
  createSavedLibraryHttpHandlers,
  createSavedLibraryService,
} from "@/features/saved/api";
import type { CaptureAuthentication } from "@/server/repositories/video-source-repository";

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
