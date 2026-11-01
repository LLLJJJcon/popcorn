import { z } from 'zod';
import { StableSegmentIdSchema, TargetChineseTextSchema } from './source';
export const HighlightStatusSchema = z.enum(['pending', 'ready', 'unavailable']);
export const HighlightSelectionSchema = z.strictObject({
  startSegmentId: StableSegmentIdSchema,
  startOffset: z.number().int().min(0).max(100000),
  endSegmentId: StableSegmentIdSchema,
  endOffset: z.number().int().min(0).max(100000)
});
export const SavedHighlightSchema = HighlightSelectionSchema.extend({
  id: z.string().uuid(),
  savedItemId: z.string().uuid(),
  text: TargetChineseTextSchema,
  origin: z.enum(['model', 'user']),
  reasonEn: z.string().nullable(),
  status: z.enum(['active', 'removed'])
});
export const SavedTargetSegmentSchema = z.object({
  id: StableSegmentIdSchema,
  text: z.string(),
  startSeconds: z.number().finite().min(0),
  endSeconds: z.number().finite().min(0)
});
export type SavedHighlight = z.infer<typeof SavedHighlightSchema>;
export type HighlightSelection = z.infer<typeof HighlightSelectionSchema>;
export type HighlightStatus = z.infer<typeof HighlightStatusSchema>;
export type SavedTargetSegment = z.infer<typeof SavedTargetSegmentSchema>;
