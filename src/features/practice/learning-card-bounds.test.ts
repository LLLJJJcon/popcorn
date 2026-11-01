// @vitest-environment node
import { PracticeTaskSchema, AttemptRecordedSchema, PracticeCoachingSchema } from "@/contracts/practice";
import { PracticeMaterialViewSchema } from "./material-schema";
import { ExpressionSearchResultSchema } from "@/features/vault/search-schema";
import { normalizePracticeEvaluationWire } from "@/server/ai/prompts/evaluate.v1";
import { createOpenAiCompatibleStructuredJsonClient } from "@/server/ai/openai-compatible-provider";

const id = "11111111-1111-4111-8111-111111111111";
const now = "2026-11-01T00:00:00Z";
const dimensions = { accuracy: { score: 5, englishFeedback: "Accurate." }, naturalness: { score: 5, englishFeedback: "Natural." }, contextualFit: { score: 5, englishFeedback: "Fits." } };
const task = { id, userId: id, userExpressionId: id, kind: "use_it_now", nativeLanguage: "en", targetLanguage: "zh-CN", targetExpression: "汉".repeat(300), promptChinese: "朋友请你解释一下。", instructionsEnglish: "Respond naturally.", goalEnglish: "Use this expression.", dueAt: null, createdAt: now };

test("accepted learning-card text stays readable through practice materials and Vault", () => {
  expect(PracticeTaskSchema.safeParse(task).success).toBe(true);
  const { userId: _owner, ...publicTask } = task; void _owner;
  expect(PracticeMaterialViewSchema.safeParse({ task: publicTask, masteryState: "tried", source: { videoTitle: "中文视频", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", evidenceText: "汉".repeat(3000), startSeconds: 0 }, expression: { englishMeaning: "Meaning.", englishExplanation: "Explanation.", tone: "Casual.", communicativeFunction: "Explain.", register: "Casual." } }).success).toBe(true);
  expect(ExpressionSearchResultSchema.safeParse({ userExpressionId: id, expressionSenseId: id, expressionText: task.targetExpression, englishMeaning: "English " + "meaning".repeat(100), communicativeFunction: "Explain.", register: "Casual.", masteryState: "tried", sourceCount: 1, updatedAt: now, matchReason: "recent" }).success).toBe(true);
  expect(PracticeTaskSchema.safeParse({ ...task, targetExpression: "汉".repeat(10000) }).success).toBe(true);
  expect(PracticeTaskSchema.safeParse({ ...task, targetExpression: "汉".repeat(10001) }).success).toBe(false);
});

test("a 6000-character response and optional correction survive their public contracts", () => {
  const responseChinese = "汉".repeat(6000);
  expect(AttemptRecordedSchema.safeParse({ id, userId: id, practiceTaskId: id, userExpressionId: id, responseChinese, evaluation: { ...dimensions, passed: true, independentUse: true, assistanceLevel: "none" }, submittedAt: now, createdAt: now }).success).toBe(true);
  expect(PracticeCoachingSchema.safeParse({ naturalRevisionChinese: responseChinese }).success).toBe(true);
  expect(normalizePracticeEvaluationWire({ ...dimensions, naturalRevisionChinese: responseChinese })).toMatchObject({ success: true, data: { naturalRevisionChinese: responseChinese } });
});

test("bounded model transport accepts two 10k Chinese inputs plus the existing scene and rubric", async () => {
  const fetchImpl = vi.fn(async () => Response.json({ choices: [{ message: { role: "assistant", content: '{"result":"valid"}' } }] }));
  const client = createOpenAiCompatibleStructuredJsonClient({ config: { adapterKind: "openai-compatible", canonicalOrigin: "https://model.example", basePath: "/v1", model: "fixture", revision: 1, configFingerprint: "a".repeat(64), apiKey: "fixture-key" }, fetchImpl });
  const userPrompt = JSON.stringify({ targetExpression: "汉".repeat(10000), learnerResponse: "汉".repeat(10000), promptChinese: "汉".repeat(2000) });
  expect(new TextEncoder().encode(userPrompt).byteLength).toBeGreaterThan(65536);
  await expect(client.complete("evaluate-practice-v4", userPrompt, { systemPrompt: "Evaluate the response.", timeoutMs: 30000, maxTokens: 700, normalize: value => ({ success: true, data: value }) })).resolves.toMatchObject({ result: "valid" });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
