import { expect, type Locator } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KnowledgeJobSchema } from "../../src/contracts/knowledge";
import { createAnalyzeSavedItemHandler } from "../../src/server/jobs/handlers/analyze-saved-item";
import { createSupabaseDurableJobStore } from "../../src/server/jobs/process-jobs";
import { createAnalyzeMarkedExpressionsFixtureGateway } from "../../src/server/ai/prompts/analyze-saved-item.v3";
import type { Database } from "../../src/types/database.generated";

/** Browser Range selection uses the same UTF-16 text-node coordinates as a mouse drag. */
export async function selectUnmarkedText(raw: Locator, text: string) {
  await raw.evaluate((root, target) => {
    const run = [...root.querySelectorAll<HTMLElement>("[data-target-text]")].find(node => node.textContent?.includes(target));
    if (!run?.firstChild) throw new Error("Expected unmarked target text");
    const offset = run.textContent!.indexOf(target);
    const range = document.createRange();
    range.setStart(run.firstChild, offset); range.setEnd(run.firstChild, offset + target.length);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, text);
}

/** Process only this reserved test owner's job, never claim the shared local queue. */
export async function completeFixtureAnalysis(admin: SupabaseClient, jobId: string, ownerId: string) {
  if (ownerId !== "52000000-0000-4000-8000-000000000001") throw new Error("Reserved E2E owner required");
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 60_000).toISOString();
  const result = await admin.from("knowledge_jobs").update({ status: "leased", attempt_count: 1, next_attempt_at: null, lease_expires_at: expires, updated_at: now })
    .eq("id", jobId).eq("user_id", ownerId).eq("job_type", "analyze_saved_item").eq("status", "pending").select("*").single();
  expect(result.error).toBeNull();
  const row = result.data!;
  const job = KnowledgeJobSchema.parse({ id: row.id, userId: row.user_id, sourceId: row.video_source_id, savedItemId: row.saved_item_id,
    type: row.job_type, status: row.status, dedupeKey: row.dedupe_key, attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at, leaseExpiresAt: row.lease_expires_at, lastErrorCode: row.last_error_code, createdAt: row.created_at, updatedAt: row.updated_at });
  if (job.status !== "leased") throw new Error("Expected leased test job");
  const handler = createAnalyzeSavedItemHandler({ store: createSupabaseDurableJobStore(admin as SupabaseClient<Database>),
    gatewayResolver: { resolve: async () => createAnalyzeMarkedExpressionsFixtureGateway() } });
  expect(await handler(job, ownerId, now)).toBe("completed");
}
