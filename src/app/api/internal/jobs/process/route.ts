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
import { createReviewPracticeServices } from "@/server/review-practice-runtime";
import type { TranscriptProvider } from "@/server/transcript/provider";

const ProcessorEnvSchema = ServerEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
  INTERNAL_JOB_SECRET: true,
});

function runtimeRoute() {
  const environment = ProcessorEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    INTERNAL_JOB_SECRET: process.env.INTERNAL_JOB_SECRET,
  });
  const service = createServiceJobClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
  );
  const store = createSupabaseDurableJobStore(service);
  // Resolve transcript credentials only for a transcript job, so Review jobs
  // can run with their own model configuration and no unrelated provider key.
  const transcript = () => createSupadataTranscriptProvider({apiKey:process.env.SUPADATA_API_KEY??""});
  const transcriptProvider:TranscriptProvider = {
    request:videoId=>transcript().request(videoId),
    poll:jobId=>transcript().poll(jobId),
  };
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
      reviewPracticeService:createReviewPracticeServices(service,process.env.CI==="true").service,
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
