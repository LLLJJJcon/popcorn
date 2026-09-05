import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

import { createJobStatusRoute } from "@/server/jobs/process-jobs";
import { createStatusReader } from "@/server/jobs/public-job-status";
import type { Database } from "@/types/database.generated";

const USER_ID = "51000000-0000-4000-8000-000000000001";
const JOB_ID = "52000000-0000-4000-8000-000000000001";

function terminalJobClient(): SupabaseClient<Database> {
  const row = {
    id: JOB_ID,
    user_id: USER_ID,
    status: "terminal_failed",
    job_type: "analyze_saved_item",
    last_error_code: "PROVIDER_OUTPUT_INVALID:wire_schema:candidates.0.expression",
    prompt: "private transcript text",
    model_response: "private model response",
    api_key: "private-key",
  };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  return { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>;
}

describe("production public job status boundary", () => {
  test("returns a safe category without raw failure or private job data", async () => {
    const readPublicStatus = createStatusReader(terminalJobClient());
    const route = createJobStatusRoute({
      authenticate: vi.fn(async () => ({ userId: USER_ID })),
      readPublicStatus,
      requestId: () => "public-job-request",
    });

    const response = await route(
      new Request(`https://popcorn.test/api/v1/jobs/${JOB_ID}`, {
        headers: { authorization: "Bearer user-token" },
      }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        id: JOB_ID,
        status: "terminal_failed",
        retryable: false,
        result: null,
        failureCategory: "model_output",
      },
      requestId: "public-job-request",
    });
    expect(JSON.stringify(body)).not.toMatch(
      /last_error_code|PROVIDER_OUTPUT_INVALID|private transcript|private model|private-key|user_id/i,
    );
  });
});
