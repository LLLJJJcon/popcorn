import {
  classifyCaptureRpcError,
  createKnowledgeJobRepository,
} from "@/server/repositories/knowledge-job-repository";
import {
  assertCaptureScope,
  type CaptureRpcArgs,
  type CaptureRpcClient,
} from "@/server/repositories/video-source-repository";

export type { CaptureRpcClient } from "@/server/repositories/video-source-repository";

export function createSavedItemRepository(client: CaptureRpcClient) {
  const resultRepository = createKnowledgeJobRepository(client);
  return {
    async capture(userId: string, args: CaptureRpcArgs) {
      assertCaptureScope(userId, client);
      let response: Awaited<ReturnType<CaptureRpcClient["rpc"]>>;
      try {
        response = await client.rpc("capture_saved_item", args);
      } catch (error) {
        throw classifyCaptureRpcError(error);
      }
      if (response.error) throw classifyCaptureRpcError(response.error);
      return resultRepository.acceptCaptureResult(userId, response.data);
    },
  };
}
