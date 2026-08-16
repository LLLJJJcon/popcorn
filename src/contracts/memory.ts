import { z } from "zod";

export const MasteryStateSchema = z.enum(["tried", "reused", "owned"]);
export const ReviewTaskStatusSchema = z.enum(["pending", "completed", "cancelled"]);

export const ReviewTaskSchema = z.strictObject({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userExpressionId: z.string().uuid(),
  masteryState: MasteryStateSchema,
  status: ReviewTaskStatusSchema,
  dueAt: z.string().datetime({ offset: true }),
  intervalDays: z.number().int().min(1).max(365),
  consecutiveSuccesses: z.number().int().min(0).max(1_000),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type MasteryState = z.infer<typeof MasteryStateSchema>;
export type ReviewTaskStatus = z.infer<typeof ReviewTaskStatusSchema>;
export type ReviewTask = z.infer<typeof ReviewTaskSchema>;
