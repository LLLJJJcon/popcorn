import { z } from "zod";

const CountSchema = z.number().int().nonnegative();

export const ProgressSummarySchema = z.strictObject({
  week: z.strictObject({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  }),
  weeklyAttemptCount: CountSchema,
  dueCompletionCount: CountSchema,
  independentReuseCount: CountSchema,
  duePracticeCount: CountSchema,
  masteryDistribution: z.strictObject({
    tried: CountSchema,
    reused: CountSchema,
    owned: CountSchema,
  }),
});

export type ProgressSummary = z.infer<typeof ProgressSummarySchema>;
