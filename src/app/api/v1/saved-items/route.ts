import { createCaptureSave, createSavedItemHandler } from "@/server/domain/capture-save";
import { createSavedItemRepository } from "@/server/repositories/saved-item-repository";
import {
  authenticateCaptureRequest,
  type CaptureRpcClient,
} from "@/server/repositories/video-source-repository";

const capture = async (
  userId: string,
  input: unknown,
  client: CaptureRpcClient,
) => createCaptureSave(createSavedItemRepository(client))(userId, input);

export async function POST(request: Request) {
  return createSavedItemHandler({
    authenticate: authenticateCaptureRequest,
    capture,
    requestId: () => crypto.randomUUID(),
  })(request);
}
