import { createLearningArtifactProviderResolver } from "@/server/ai/model-gateway";
import { ServerEnvSchema } from "@/server/env";
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
  const provider = createSupadataTranscriptProvider({
    apiKey: environment.SUPADATA_API_KEY,
  });
  const providerResolver = createLearningArtifactProviderResolver({
    ci: process.env.CI === "true",
    createRuntimeResolver: () => createSupabaseModelGatewayRuntimeResolver(service),
  });
  const processor = createJobProcessor({
    store,
    handlers: {
      resolve_snapshot: createResolveSnapshotHandler({ store, provider }),
      generate_overview: createGenerateOverviewHandler({ store, providerResolver }),
      translate_segments: createTranslateSegmentsHandler({ store, providerResolver }),
      explain_selection: createExplainSelectionHandler({ store, providerResolver }),
    },
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
