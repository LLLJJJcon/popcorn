import { z } from "zod";

const OptionalFilterSchema = (maximum: number) => z.string().trim().min(1).max(maximum).optional();
const IsoInstantSchema = z.string().datetime({ offset: true });

export const ExpressionSearchMatchReasonSchema = z.enum([
  "exact",
  "prefix",
  "substring",
  "trigram",
  "english_meaning",
  "communicative_function",
  "register",
  "recent",
]);

export const ExpressionSearchQuerySchema = z.strictObject({
  query: z.string().max(200).default(""),
  communicativeFunction: OptionalFilterSchema(300),
  register: OptionalFilterSchema(200),
  videoSourceId: z.string().uuid().optional(),
  masteryState: z.enum(["tried", "reused", "owned"]).optional(),
  createdFrom: IsoInstantSchema.optional(),
  createdBefore: IsoInstantSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
}).superRefine((value, context) => {
  if (
    value.createdFrom && value.createdBefore &&
    Date.parse(value.createdFrom) >= Date.parse(value.createdBefore)
  ) {
    context.addIssue({
      code: "custom",
      path: ["createdBefore"],
      message: "createdBefore must be later than createdFrom",
    });
  }
});

export const ExpressionSearchResultSchema = z.strictObject({
  userExpressionId: z.string().uuid(),
  expressionSenseId: z.string().uuid(),
  expressionText: z.string().min(1).max(200),
  englishMeaning: z.string().min(1).max(500),
  communicativeFunction: z.string().min(1).max(300),
  register: z.string().min(1).max(200),
  masteryState: z.enum(["tried", "reused", "owned"]),
  sourceCount: z.number().int().nonnegative(),
  updatedAt: IsoInstantSchema,
  matchReason: ExpressionSearchMatchReasonSchema,
});

export const ExpressionSearchResultsSchema = z.array(ExpressionSearchResultSchema).max(50);

export const ExpressionSearchApiSuccessSchema = z.strictObject({
  ok: z.literal(true),
  data: ExpressionSearchResultsSchema,
  requestId: z.string().min(1),
});

export type ExpressionSearchQuery = z.infer<typeof ExpressionSearchQuerySchema>;
export type ExpressionSearchQueryInput = z.input<typeof ExpressionSearchQuerySchema>;
export type ExpressionSearchResult = z.infer<typeof ExpressionSearchResultSchema>;

function optional(searchParams: URLSearchParams, name: string): string | undefined {
  const value = searchParams.get(name);
  return value === null || value === "" ? undefined : value;
}

export function expressionSearchQueryFromUrl(searchParams: URLSearchParams): ExpressionSearchQuery {
  const rawLimit = optional(searchParams, "limit");
  return ExpressionSearchQuerySchema.parse({
    query: searchParams.get("q") ?? "",
    communicativeFunction: optional(searchParams, "function"),
    register: optional(searchParams, "register"),
    videoSourceId: optional(searchParams, "source"),
    masteryState: optional(searchParams, "mastery"),
    createdFrom: optional(searchParams, "from"),
    createdBefore: optional(searchParams, "before"),
    limit: rawLimit === undefined || !/^\d+$/.test(rawLimit)
      ? (rawLimit === undefined ? 20 : Number.NaN)
      : Number(rawLimit),
  });
}
