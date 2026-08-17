import { getServerEnv } from "@/server/env";
import { createResolveSnapshotHandler } from "@/server/jobs/handlers/resolve-snapshot";
import {
  MAX_PROCESS_BATCH_SIZE,
  createInternalProcessRoute,
  createJobProcessor,
  createServiceJobClient,
  createSupabaseDurableJobStore,
} from "@/server/jobs/process-jobs";
import { createSupadataTranscriptProvider } from "@/server/transcript/supadata-provider";

function runtimeRoute() {
  const environment = getServerEnv();
  const store = createSupabaseDurableJobStore(
    createServiceJobClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.SUPABASE_SERVICE_ROLE_KEY,
    ),
  );
  const provider = createSupadataTranscriptProvider({
    apiKey: environment.SUPADATA_API_KEY,
  });
  const processor = createJobProcessor({
    store,
    handlers: {
      resolve_snapshot: createResolveSnapshotHandler({ store, provider }),
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
