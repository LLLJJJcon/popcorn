import { z } from "zod";

import {
  createOpenAiCompatibleStructuredJsonClient,
} from "@/server/ai/openai-compatible-provider";
import {
  ModelGatewayError,
  type ModelGatewayPin,
} from "@/server/ai/provider";
import type { ModelGatewayRuntimeResolver } from "@/server/model-gateway/runtime-resolver";

const ModelSchema = z.string().trim().min(1).max(100);
const PromptVersionSchema = z.string().trim().min(1).max(100);
const PromptSchema = z.string().min(1).max(65_536);

export interface StructuredJsonGateway {
  readonly model: string;
  complete(promptVersion: string, prompt: string): Promise<unknown>;
}

export interface StructuredJsonGatewayResolver {
  resolve(
    expectedUserId: string,
    pin: ModelGatewayPin,
  ): Promise<StructuredJsonGateway>;
}

type ResolverOptions = {
  readonly ci: boolean;
  readonly fixture: StructuredJsonGateway;
  readonly createRuntimeResolver: () => ModelGatewayRuntimeResolver;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxRequestBytes?: number;
  readonly maxResponseBytes?: number;
};

function boundedGateway(gateway: StructuredJsonGateway): StructuredJsonGateway {
  const model = ModelSchema.parse(gateway.model);
  return {
    model,
    async complete(promptVersion, prompt) {
      return gateway.complete(
        PromptVersionSchema.parse(promptVersion),
        PromptSchema.parse(prompt),
      );
    },
  };
}

/**
 * Resolves a model-neutral structured-JSON transport for one exact owner/config pin.
 * CI selects its deterministic fixture before constructing any Vault-backed runtime.
 */
export function createStructuredJsonGatewayResolver(
  options: ResolverOptions,
): StructuredJsonGatewayResolver {
  if (options.ci) {
    const fixture = boundedGateway(options.fixture);
    return {
      async resolve() {
        return fixture;
      },
    };
  }

  return {
    async resolve(expectedUserId, pin) {
      const runtime = await options.createRuntimeResolver().resolve(expectedUserId, pin);
      if (runtime.adapterKind !== "openai-compatible") {
        throw new ModelGatewayError("PROVIDER_UNAVAILABLE");
      }
      const client = createOpenAiCompatibleStructuredJsonClient({
        config: runtime,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs,
        maxRequestBytes: options.maxRequestBytes,
        maxResponseBytes: options.maxResponseBytes,
      });
      return boundedGateway({
        model: runtime.model,
        complete: (promptVersion, prompt) => client.complete(promptVersion, prompt),
      });
    },
  };
}
