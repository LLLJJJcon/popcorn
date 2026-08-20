import { createLearningArtifactProviderResolver } from "@/server/ai/model-gateway";
import { createAnalyzeSavedItemFixtureGateway } from "@/server/ai/prompts/analyze-saved-item.v1";
import { createStructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import { ServerEnvSchema } from "@/server/env";
import {
  MAX_PROCESS_BATCH_SIZE,
  createInternalProcessRoute,
  createJobProcessor,
  createProcessorHandlers,
  createServiceJobClient,
  createSupabaseDurableJobStore,
} from "@/server/jobs/process-jobs";
import { createProcessorScopedGatewayResolver } from "@/server/jobs/provider-cache";
import { createSupabaseModelGatewayRuntimeResolver } from "@/server/model-gateway/runtime-resolver";
import { createSupadataTranscriptProvider } from "@/server/transcript/supadata-provider";

const ProcessorEnvSchema = ServerEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
  SUPADATA_API_KEY: true,
  INTERNAL_JOB_SECRET: true,
});

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
