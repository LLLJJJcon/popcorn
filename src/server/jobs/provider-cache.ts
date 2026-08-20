import type { StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";

export function createProcessorScopedGatewayResolver(_: {
  readonly delegate: StructuredJsonGatewayResolver;
  readonly cacheFixture: boolean;
  readonly maxEntries: number;
}): StructuredJsonGatewayResolver {
  if (!Number.isInteger(_.maxEntries) || _.maxEntries < 1 || _.maxEntries > 5) {
    throw new RangeError("processor gateway cache must contain between one and five entries");
  }
  if (!_.cacheFixture) return _.delegate;

  const cache = new Map<string, ReturnType<StructuredJsonGatewayResolver["resolve"]>>();
  return {
    async resolve(expectedUserId, pin) {
      const key = `${expectedUserId}:${pin.configId}:${pin.revision}:${pin.fingerprint}`;
      const existing = cache.get(key);
      if (existing) return existing;
      if (cache.size >= _.maxEntries) {
        throw new RangeError("processor gateway cache is full");
      }
      const resolved = _.delegate.resolve(expectedUserId, pin);
      cache.set(key, resolved);
      try {
        return await resolved;
      } catch (error) {
        cache.delete(key);
        throw error;
      }
    },
  };
}
