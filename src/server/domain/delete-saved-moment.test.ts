import { createClient } from "@supabase/supabase-js";
import { createSavedMomentDeletionHandler, createSavedMomentRemover } from "./delete-saved-moment";
import type { Database } from "@/types/database.generated";

const USER = "11111111-1111-4111-8111-111111111111";
const SOURCE = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const request = () => new Request("https://popcorn.test/api/v1/saved/moments", { method: "DELETE" });

function setup() {
  const remove = vi.fn(async () => ({ deleted: true as const, remainingCount: 2 }));
  const authenticate = vi.fn(async () => ({ ok: true as const, userId: USER }));
  return { remove, authenticate, handler: createSavedMomentDeletionHandler({ remove, authenticate, requestId: () => "request" }) };
}

describe("saved moment deletion", () => {
  it("only marks the owner-scoped bookmark and counts visible moments without deleting learning data", async () => {
    const requests: Request[] = [];
    const client = createClient<Database>("https://database.popcorn.test", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        const req = new Request(input, init);
        requests.push(req);
        return req.method === "PATCH"
          ? Response.json([{ id: ITEM }])
          : new Response(null, { headers: { "content-range": "0-1/2" } });
      } },
    });
    await expect(createSavedMomentRemover(client)(USER, SOURCE, ITEM))
      .resolves.toEqual({ deleted: true, remainingCount: 2 });
    expect(requests).toHaveLength(2);
    const update = new URL(requests[0]!.url);
    expect(requests[0]!.method).toBe("PATCH");
    expect(update.pathname).toBe("/rest/v1/saved_items");
    expect(update.searchParams.get("user_id")).toBe(`eq.${USER}`);
    expect(update.searchParams.get("video_source_id")).toBe(`eq.${SOURCE}`);
    expect(update.searchParams.get("id")).toBe(`eq.${ITEM}`);
    expect(Object.keys(await requests[0]!.json())).toEqual(["removed_from_saved_at"]);
    const count = new URL(requests[1]!.url);
    expect(requests[1]!.method).toBe("HEAD");
    expect(count.pathname).toBe("/rest/v1/saved_items");
    expect(count.searchParams.get("user_id")).toBe(`eq.${USER}`);
    expect(count.searchParams.get("video_source_id")).toBe(`eq.${SOURCE}`);
    expect(count.searchParams.get("removed_from_saved_at")).toBe("is.null");
  });

  it("passes the authenticated owner and both IDs to removal and returns a no-store receipt", async () => {
    const { handler, remove } = setup();
    const result = await handler(request(), SOURCE, ITEM);
    expect(remove).toHaveBeenCalledExactlyOnceWith(USER, SOURCE, ITEM);
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(await result.json()).toMatchObject({ ok: true, data: { deleted: true, remainingCount: 2 } });
  });

  it("rejects invalid identifiers before mutation", async () => {
    const { handler, remove } = setup();
    expect((await handler(request(), "bad", ITEM)).status).toBe(404);
    expect((await handler(request(), SOURCE, "bad")).status).toBe(404);
    expect(remove).not.toHaveBeenCalled();
  });

  it("requires a signed-in session", async () => {
    const remove = vi.fn();
    const handler = createSavedMomentDeletionHandler({
      remove, authenticate: async () => ({ ok: false, reason: "missing" }), requestId: () => "request",
    });
    expect((await handler(request(), SOURCE, ITEM)).status).toBe(401);
    expect(remove).not.toHaveBeenCalled();
  });

  it("returns unavailable for another owner's or missing moment", async () => {
    const handler = createSavedMomentDeletionHandler({
      remove: async () => null,
      authenticate: async () => ({ ok: true, userId: USER }), requestId: () => "request",
    });
    expect((await handler(request(), SOURCE, ITEM)).status).toBe(404);
  });

  it("does not expose database errors", async () => {
    const handler = createSavedMomentDeletionHandler({
      remove: async () => { throw new Error("private database secret"); },
      authenticate: async () => ({ ok: true, userId: USER }), requestId: () => "request",
    });
    const response = await handler(request(), SOURCE, ITEM);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/private|secret/);
  });
});
