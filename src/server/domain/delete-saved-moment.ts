import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { failure, success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import type { Database } from "@/types/database.generated";

type RemovalResult = { readonly deleted: true; readonly remainingCount: number };
type RemoveSavedMoment = (userId: string, sourceId: string, itemId: string) => Promise<RemovalResult | null>;

// Remove the bookmark, retaining the source graph used by existing learning records.
export function createSavedMomentRemover(client: SupabaseClient<Database>): RemoveSavedMoment {
  return async (userId, sourceId, itemId) => {
    const removed = await client.from("saved_items")
      .update({ removed_from_saved_at: new Date().toISOString() })
      .eq("user_id", userId).eq("video_source_id", sourceId).eq("id", itemId)
      .select("id");
    if (removed.error) throw new Error("saved moment removal failed");
    if (removed.data.length !== 1) return null;
    const remaining = await client.from("saved_items").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("video_source_id", sourceId).is("removed_from_saved_at", null);
    if (remaining.error || remaining.count === null) throw new Error("saved moment count failed");
    return { deleted: true, remainingCount: remaining.count };
  };
}

export function createSavedMomentDeletionHandler(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly remove: RemoveSavedMoment;
  readonly requestId: () => string;
}) {
  return async (request: Request, sourceId: string, itemId: string) => {
    const requestId = dependencies.requestId();
    const respond = (body: unknown, status: number) => Response.json(body, {
      status, headers: { "Cache-Control": "no-store" },
    });
    const unavailable = () => respond(failure({
      code: "FORBIDDEN", message: "Saved moment is unavailable.", retryable: false,
    }, requestId), 404);
    const session = await dependencies.authenticate(request);
    if (!session.ok) return respond(failure({
      code: session.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED",
      message: "Sign in to manage Saved.", retryable: false,
    }, requestId), 401);
    if (!z.string().uuid().safeParse(sourceId).success || !z.string().uuid().safeParse(itemId).success) {
      return unavailable();
    }
    try {
      const result = await dependencies.remove(session.userId, sourceId, itemId);
      return result ? respond(success(result, requestId), 200) : unavailable();
    } catch {
      return respond(failure({
        code: "INTERNAL_ERROR", message: "Could not delete this saved moment. Try again.", retryable: true,
      }, requestId), 500);
    }
  };
}
