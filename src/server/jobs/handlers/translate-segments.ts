import type { z } from "zod";

import {
  TranslationJobInputSchema,
  validateTranslationContent,
  type LearningArtifactProviderResolver,
} from "@/server/ai/provider";
import { createLearningArtifactHandler } from "@/server/jobs/handlers/generate-overview";
import type { DurableJobStore, JobHandler } from "@/server/jobs/process-jobs";
import type { Json } from "@/types/database.generated";

export function createTranslateSegmentsHandler({
  store,
  providerResolver,
}: {
  readonly store: DurableJobStore;
  readonly providerResolver: LearningArtifactProviderResolver;
}): JobHandler {
  return createLearningArtifactHandler<z.infer<typeof TranslationJobInputSchema>>({
    store,
    providerResolver,
    jobType: "translate_segments",
    artifactType: "segment_translation",
    inputSchema: TranslationJobInputSchema,
    segmentIds: (input) => input.segmentIds,
    invoke: (activeProvider, evidence, input) => activeProvider.translateSegments(evidence, input.segmentIds),
    validate: (value, _evidence, input) => validateTranslationContent(value, input.segmentIds) as Json,
    terminalOnFirstFailure: true,
  });
}
