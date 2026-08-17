import { z } from "zod";

import {
  assertCaptureScope,
  type CaptureRpcClient,
} from "@/server/repositories/video-source-repository";

const captureResultSchema = z
  .array(
    z.strictObject({
      video_source_id: z.string().uuid(),
      saved_item_id: z.string().uuid(),
      status: z.literal("saved"),
    }),
  )
  .length(1);

export class CapturePersistenceError extends Error {
  constructor(
    readonly category: "forbidden" | "conflict" | "transport" | "invalid_result",
  ) {
    super("Capture persistence failed.");
    this.name = "CapturePersistenceError";
  }
}

export function createKnowledgeJobRepository(client: CaptureRpcClient) {
  return {
    acceptCaptureResult(userId: string, value: unknown) {
      assertCaptureScope(userId, client);
      const parsed = captureResultSchema.safeParse(value);
      if (!parsed.success) {
        throw new CapturePersistenceError("invalid_result");
      }
      const [row] = parsed.data;
      return {
        videoSourceId: row.video_source_id,
        savedItemId: row.saved_item_id,
        status: row.status,
      };
    },
  };
}

export function classifyCaptureRpcError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code === "42501") return new CapturePersistenceError("forbidden");
  if (code === "23505") return new CapturePersistenceError("conflict");
  return new CapturePersistenceError("transport");
}
