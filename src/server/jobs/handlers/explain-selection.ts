import type { z } from "zod";

import {
  ExplanationJobInputSchema,
  validateExplanationContent,
  validateLearningArtifactSelectionEvidence,
  type LearningArtifactProviderResolver,
} from "@/server/ai/provider";
import { createLearningArtifactHandler } from "@/server/jobs/handlers/generate-overview";
import type { DurableJobStore, JobHandler } from "@/server/jobs/process-jobs";
import type { Json } from "@/types/database.generated";

export function createExplainSelectionHandler({
  store,
  providerResolver,
}: {
  readonly store: DurableJobStore;
  readonly providerResolver: LearningArtifactProviderResolver;
}): JobHandler {
  return createLearningArtifactHandler<z.infer<typeof ExplanationJobInputSchema>>({
    store,
    providerResolver,
    jobType: "explain_selection",
    artifactType: "selection_explanation",
    inputSchema: ExplanationJobInputSchema,
    segmentIds: (input) => input.segmentIds,
    validateEvidence: (evidence, input) => validateLearningArtifactSelectionEvidence(evidence, input),
    invoke: (activeProvider, evidence, input) => activeProvider.explainSelection(evidence, {
      selectedChinese: input.selectedChinese,
      segmentIds: input.segmentIds,
      utf16Start: input.utf16Start,
      utf16End: input.utf16End,
      startSeconds: input.startSeconds,
      endSeconds: input.endSeconds,
      context: input.context,
    }),
    validate: (value, _evidence, input) => validateExplanationContent(value, input.selectedChinese) as Json,
    terminalOnFirstFailure: true,
  });
}
