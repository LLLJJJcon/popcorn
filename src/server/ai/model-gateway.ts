import {
  createFixtureLearningArtifactProvider,
  ModelGatewayError,
  type LearningArtifactProviderResolver,
} from "@/server/ai/provider";
import { createOpenAiCompatibleLearningArtifactProvider } from "@/server/ai/openai-compatible-provider";
import type { ModelGatewayRuntimeResolver } from "@/server/model-gateway/runtime-resolver";

export { ModelGatewayError } from "@/server/ai/provider";

type ResolverOptions = {
  readonly ci: boolean;
  readonly createRuntimeResolver: () => ModelGatewayRuntimeResolver;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxRequestBytes?: number;
  readonly maxResponseBytes?: number;
};

/**
 * Closed provider registry. The CI branch is chosen before construction of any
 * runtime resolver, so fixtures cannot read configuration, Vault, or network.
 */
export function createLearningArtifactProviderResolver(
  options: ResolverOptions,
): LearningArtifactProviderResolver {
  if (options.ci) {
    const provider = createFixtureLearningArtifactProvider();
    return {
      async resolve() {
        return { provider, model: "popcorn-ci-fixture-v1" };
      },
    };
  }

  return {
    async resolve(expectedUserId, pin) {
      const runtime = await options.createRuntimeResolver().resolve(expectedUserId, pin);
      if (runtime.adapterKind !== "openai-compatible") {
        throw new ModelGatewayError("PROVIDER_UNAVAILABLE");
      }
      return {
        provider: createOpenAiCompatibleLearningArtifactProvider({
          config: runtime,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.timeoutMs,
          maxRequestBytes: options.maxRequestBytes,
          maxResponseBytes: options.maxResponseBytes,
        }),
        model: runtime.model,
      };
    },
  };
}
