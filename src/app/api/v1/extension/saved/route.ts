import {
  createSavedLibraryRuntime,
} from "@/features/saved/api";
import { createExtensionSavedLibraryHandler } from "@/features/saved/extension-library-handler";
import { authenticateCaptureRequest } from "@/server/repositories/video-source-repository";

export async function GET(request: Request) {
  const runtime = createSavedLibraryRuntime();
  return createExtensionSavedLibraryHandler({
    authenticate: authenticateCaptureRequest,
    service: runtime.service,
    requestId: () => crypto.randomUUID(),
  })(request);
}
