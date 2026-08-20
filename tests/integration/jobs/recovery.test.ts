import { describe, expect, test, vi } from "vitest";

import type { ModelGatewayPin } from "@/server/ai/provider";
import {
  createProcessorScopedGatewayResolver,
} from "@/server/jobs/provider-cache";
import {
  createJobProcessor,
  type DurableJobStore,
} from "@/server/jobs/process-jobs";

const NOW = "2026-08-21T00:00:00.000Z";
const PIN: ModelGatewayPin = {
  configId: "27000000-0000-4000-8000-000000000001",
  revision: 2,
  fingerprint: "f".repeat(64),
};

describe("knowledge-job recovery bound", () => {
  test("rejects every claim request above five before touching the queue", async () => {
    const claimJobs = vi.fn(async () => []);
    const processor = createJobProcessor({
      store: { claimJobs } as unknown as DurableJobStore,
      handlers: {},
    });

    await expect(processor.processBounded(NOW, 6)).rejects.toThrow(/between 1 and 5/);
    expect(claimJobs).not.toHaveBeenCalled();
  });

  test("caches only deterministic fixture resolution for one processor call and exact owner pin", async () => {
    const gateway = { model: "fixture/model", complete: vi.fn() };
    const delegate = { resolve: vi.fn(async () => gateway) };
    const cached = createProcessorScopedGatewayResolver({
      delegate,
      cacheFixture: true,
      maxEntries: 5,
    });

    await expect(cached.resolve("owner-a", PIN)).resolves.toBe(gateway);
    await expect(cached.resolve("owner-a", PIN)).resolves.toBe(gateway);
    await expect(cached.resolve("owner-b", PIN)).resolves.toBe(gateway);

    expect(delegate.resolve).toHaveBeenCalledTimes(2);
    expect(delegate.resolve).toHaveBeenNthCalledWith(1, "owner-a", PIN);
    expect(delegate.resolve).toHaveBeenNthCalledWith(2, "owner-b", PIN);
  });

  test("live resolution is never cached so revocation wins before every future outbound request", async () => {
    const delegate = {
      resolve: vi.fn()
        .mockResolvedValueOnce({ model: "provider/model", complete: vi.fn() })
        .mockRejectedValueOnce(new Error("revoked")),
    };
    const live = createProcessorScopedGatewayResolver({
      delegate,
      cacheFixture: false,
      maxEntries: 5,
    });

    await expect(live.resolve("owner-a", PIN)).resolves.toMatchObject({ model: "provider/model" });
    await expect(live.resolve("owner-a", PIN)).rejects.toThrow("revoked");
    expect(delegate.resolve).toHaveBeenCalledTimes(2);
  });
});
