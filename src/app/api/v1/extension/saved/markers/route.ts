import {
  createExtensionSavedMarkersHandler,
  createSavedMarkerRuntime,
} from "@/features/saved/extension-markers";
import { authenticateCaptureRequest } from "@/server/repositories/video-source-repository";

export async function GET(request: Request) {
  const runtime = createSavedMarkerRuntime();
  return createExtensionSavedMarkersHandler({
    authenticate: authenticateCaptureRequest,
    repository: runtime.repository,
    requestId: () => crypto.randomUUID(),
  })(request);
}
