import { z } from "zod";
import { FORMAT_RETRY_MAX } from "@/server/domain/learning-config";
import { MAX_MODEL_OUTPUT_TOKENS } from "./output-budgets";

import {
  createOpenAiCompatibleStructuredJsonClient,
} from "@/server/ai/openai-compatible-provider";
import {
  ModelGatewayError,
  type ModelGatewayPin,
} from "@/server/ai/provider";
import type { WireNormalizer } from "@/server/ai/model-output";
import type { ModelGatewayRuntimeResolver } from "@/server/model-gateway/runtime-resolver";

const ModelSchema = z.string().trim().min(1).max(100);
const PromptVersionSchema = z.string().trim().min(1).max(100);
const PromptSchema = z.string().min(1).max(65_536);
const SystemPromptSchema = z.string().min(1).max(32_768);
const TimeoutSchema = z.number().int().positive().max(120_000);
const MaxTokensSchema = z.number().int().positive().max(MAX_MODEL_OUTPUT_TOKENS);

export type StructuredJsonCompletionOptions<T> = {
  readonly systemPrompt: string;
  readonly timeoutMs: number;
  readonly maxTokens: number;
  readonly maxTransportRetries?: 0 | 1;
  readonly normalize: WireNormalizer<T>;
};

export interface StructuredJsonGateway {
  readonly model: string;
  complete<T>(
    promptVersion: string,
    userPrompt: string,
    options: StructuredJsonCompletionOptions<T>,
  ): Promise<T>;
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
    async complete<T>(
      promptVersion: string,
      prompt: string,
      completionOptions: StructuredJsonCompletionOptions<T>,
    ) {
      const parsedPromptVersion = PromptVersionSchema.parse(promptVersion);
      const parsedPrompt = PromptSchema.parse(prompt);
      return gateway.complete(
        parsedPromptVersion,
        parsedPrompt,
        {
          systemPrompt: SystemPromptSchema.parse(completionOptions.systemPrompt),
          timeoutMs: TimeoutSchema.parse(completionOptions.timeoutMs),
          maxTokens: MaxTokensSchema.parse(completionOptions.maxTokens),
          maxTransportRetries: completionOptions.maxTransportRetries === undefined
            ? undefined
            : z.union([z.literal(0), z.literal(1)]).parse(completionOptions.maxTransportRetries),
          normalize: completionOptions.normalize,
        },
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
        complete: (promptVersion, prompt, completionOptions) =>
          client.complete(promptVersion, prompt, completionOptions),
      });
    },
  };
}

/** Retry only malformed/ungrounded model output. Transport policy stays in the provider. */
export async function completeWithFormatRetries<T>(
  complete: () => Promise<T>,
  validate: (value: T) => T = (value) => value,
  maxRetries = FORMAT_RETRY_MAX,
): Promise<T> {
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > FORMAT_RETRY_MAX) throw new RangeError("Invalid format retry count");
  for (let attempt = 0; ; attempt += 1) {
    try { return validate(await complete()); }
    catch (error) {
      const formatError = error instanceof ModelGatewayError &&
        ["json_extract", "wire_schema", "grounding"].includes(error.stage);
      if (!formatError || attempt >= maxRetries) throw error;
    }
  }
}
