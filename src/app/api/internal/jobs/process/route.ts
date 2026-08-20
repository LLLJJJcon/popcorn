import { createLearningArtifactProviderResolver } from "@/server/ai/model-gateway";
import type { LearningArtifactProviderResolver } from "@/server/ai/provider";
import { createAnalyzeSavedItemFixtureGateway } from "@/server/ai/prompts/analyze-saved-item.v1";
import {
  createStructuredJsonGatewayResolver,
  type StructuredJsonGatewayResolver,
} from "@/server/ai/structured-json-gateway";
import { ServerEnvSchema } from "@/server/env";
import { createAnalyzeSavedItemHandler } from "@/server/jobs/handlers/analyze-saved-item";
import { createExplainSelectionHandler } from "@/server/jobs/handlers/explain-selection";
import { createGenerateOverviewHandler } from "@/server/jobs/handlers/generate-overview";
import { createResolveSnapshotHandler } from "@/server/jobs/handlers/resolve-snapshot";
import { createTranslateSegmentsHandler } from "@/server/jobs/handlers/translate-segments";
import {
  MAX_PROCESS_BATCH_SIZE,
  createInternalProcessRoute,
  createJobProcessor,
  createServiceJobClient,
  createSupabaseDurableJobStore,
} from "@/server/jobs/process-jobs";
import { createProcessorScopedGatewayResolver } from "@/server/jobs/provider-cache";
import { createSupabaseModelGatewayRuntimeResolver } from "@/server/model-gateway/runtime-resolver";
import type { TranscriptProvider } from "@/server/transcript/provider";
import { createSupadataTranscriptProvider } from "@/server/transcript/supadata-provider";

const ProcessorEnvSchema = ServerEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
  SUPADATA_API_KEY: true,
  INTERNAL_JOB_SECRET: true,
});

export function createProcessorHandlers({
  store,
  transcriptProvider,
  learningProviderResolver,
  analysisGatewayResolver,
}: {
  readonly store: ReturnType<typeof createSupabaseDurableJobStore>;
  readonly transcriptProvider: TranscriptProvider;
  readonly learningProviderResolver: LearningArtifactProviderResolver;
  readonly analysisGatewayResolver: StructuredJsonGatewayResolver;
}) {
  return {
    resolve_snapshot: createResolveSnapshotHandler({ store, provider: transcriptProvider }),
    generate_overview: createGenerateOverviewHandler({
      store,
      providerResolver: learningProviderResolver,
    }),
    translate_segments: createTranslateSegmentsHandler({
      store,
      providerResolver: learningProviderResolver,
    }),
    explain_selection: createExplainSelectionHandler({
      store,
      providerResolver: learningProviderResolver,
    }),
    analyze_saved_item: createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: analysisGatewayResolver,
    }),
  };
}

function runtimeRoute() {
  const environment = ProcessorEnvSchema.parse(process.env);
  const service = createServiceJobClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
  );
  const store = createSupabaseDurableJobStore(service);
  const transcriptProvider = createSupadataTranscriptProvider({
    apiKey: environment.SUPADATA_API_KEY,
  });
  const learningProviderResolver = createLearningArtifactProviderResolver({
    ci: process.env.CI === "true",
    createRuntimeResolver: () => createSupabaseModelGatewayRuntimeResolver(service),
  });
  const analysisGatewayResolver = createProcessorScopedGatewayResolver({
    delegate: createStructuredJsonGatewayResolver({
      ci: process.env.CI === "true",
      fixture: createAnalyzeSavedItemFixtureGateway(),
      createRuntimeResolver: () => createSupabaseModelGatewayRuntimeResolver(service),
    }),
    cacheFixture: process.env.CI === "true",
    maxEntries: MAX_PROCESS_BATCH_SIZE,
  });
  const processor = createJobProcessor({
    store,
    handlers: createProcessorHandlers({
      store,
      transcriptProvider,
      learningProviderResolver,
      analysisGatewayResolver,
    }),
  });
  return createInternalProcessRoute({
    secret: environment.INTERNAL_JOB_SECRET,
    maxBatchSize: MAX_PROCESS_BATCH_SIZE,
    processBounded: (limit) =>
      processor.processBounded(new Date().toISOString(), limit),
  });
}

export async function POST(request: Request): Promise<Response> {
  return runtimeRoute()(request);
}
