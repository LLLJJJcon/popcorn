import { z } from "zod";
import type { LearningCardFields } from "@/contracts/knowledge";
import { learningCardOutputTokens } from "@/server/ai/output-budgets";
import { ModelGatewayError } from "@/server/ai/provider";
import { completeWithFormatRetries, type StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import { ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION, buildAnalyzeMarkedExpressionsPrompt, normalizeLearningCard, normalizeMarkedAnalysisWire } from "@/server/ai/prompts/analyze-saved-item.v3";
import { LegacyUpgradeError, LegacyUpgradeErrorCodeSchema, LegacyUpgradePageInputSchema, LegacyUpgradeRequestSchema, type LegacyLearningCardUpgradeDependencies, type LegacyUpgradeErrorCode, type LegacyUpgradeOutcome, type LegacyUpgradePageInput, type LegacyUpgradePublication, type LegacyUpgradePlanPage, type LegacyUpgradeRequest, type LegacyUpgradeTarget } from "@/server/contracts/legacy-learning-card-upgrade";
import { FORMAT_RETRY_MAX } from "./learning-config";
import { buildLegacyUpgradePromptInput, planLegacyLearningCardUpgrade } from "./legacy-learning-card-upgrade-source";

const uuid = z.string().uuid();
function safeCode(error: unknown): LegacyUpgradeErrorCode {
  if (error instanceof LegacyUpgradeError || error instanceof ModelGatewayError) return error.code;
  const parsed = LegacyUpgradeErrorCodeSchema.safeParse(typeof error === "object" && error !== null && "code" in error ? error.code : null);
  return parsed.success ? parsed.data : "INTERNAL_ERROR";
}
function sameTarget(target: LegacyUpgradeTarget, request: LegacyUpgradeRequest): boolean {
  if (target.senseId !== request.senseId || target.expectedBeforeHash !== request.expectedBeforeHash || target.expectedEvidenceHash !== request.expectedEvidenceHash) return false;
  const a = target.source, b = request.source;
  return a.kind === "existing_card" && b.kind === "existing_card"
    ? a.artifactId === b.artifactId && a.candidateKey === b.candidateKey && a.candidateIndex === b.candidateIndex
    : a.kind === "source_occurrence" && b.kind === "source_occurrence" && a.sourceId === b.sourceId && a.snapshotId === b.snapshotId && a.occurrenceId === b.occurrenceId;
}

/** Same v3 per-card normalization and shared format/card attempt policy as marked analysis. */
async function generateCard(gateway: StructuredJsonGateway, input: ReturnType<typeof buildLegacyUpgradePromptInput>): Promise<LearningCardFields> {
  const prompt = buildAnalyzeMarkedExpressionsPrompt(input);
  let lastExamplesOnly: Record<string, unknown> | undefined;
  let failure: unknown = new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema");
  for (let attempt = 0; attempt <= FORMAT_RETRY_MAX; attempt += 1) {
    try {
      const wire = await completeWithFormatRetries(() => gateway.complete(ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION, prompt.userPrompt, { systemPrompt: prompt.systemPrompt, timeoutMs: 30_000, maxTokens: learningCardOutputTokens(1), normalize: normalizeMarkedAnalysisWire }), undefined, 0);
      // Independently check envelopes for adapters/fixtures as well as real transports.
      const decoded = normalizeMarkedAnalysisWire(wire as unknown as Record<string, unknown>);
      if (!decoded.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema", decoded.fieldPath);
      const cards = decoded.data.cards;
      if (cards.some(card => card.id !== "h1") || cards.length > 1) continue;
      if (cards.length !== 1) { lastExamplesOnly = undefined; continue; }
      const normalized = normalizeLearningCard(cards[0], input.highlights[0]!.text);
      if (normalized.success) return normalized.data;
      lastExamplesOnly = normalized.examplesOnly ? cards[0] : undefined;
    } catch (error) {
      failure = error;
      if (!(error instanceof ModelGatewayError) || !["json_extract", "wire_schema", "grounding"].includes(error.stage)) break;
    }
  }
  if (lastExamplesOnly) {
    const fallback = normalizeLearningCard(lastExamplesOnly, input.highlights[0]!.text, true);
    if (fallback.success) return fallback.data;
  }
  throw failure;
}

/** Explicit metadata-only workflow; the repository alone owns publication/CAS guards. */
export function createLegacyLearningCardUpgradeService(dependencies: LegacyLearningCardUpgradeDependencies) {
  const { repository } = dependencies;
  const pending = (input: LegacyUpgradeRequest): LegacyUpgradeOutcome => ({ status: "in_progress", requestId: input.requestId, senseId: input.senseId, retryAfterMs: 1000 });
  return {
    async plan(ownerId: string, page: LegacyUpgradePageInput): Promise<LegacyUpgradePlanPage> {
      const decoded = LegacyUpgradePageInputSchema.safeParse(page);
      if (!uuid.safeParse(ownerId).success || !decoded.success) throw new LegacyUpgradeError("VALIDATION_FAILED");
      const result = await repository.pageContexts(ownerId, decoded.data);
      if (result.items.some(context => context.ownerId !== ownerId)) throw new LegacyUpgradeError("NOT_FOUND");
      return { items: result.items.map(planLegacyLearningCardUpgrade), nextCursor: result.nextCursor };
    },
    async upgrade(ownerId: string, value: LegacyUpgradeRequest): Promise<LegacyUpgradeOutcome> {
      const decoded = LegacyUpgradeRequestSchema.safeParse(value);
      if (!uuid.safeParse(ownerId).success || !decoded.success) throw new LegacyUpgradeError("VALIDATION_FAILED");
      const input = decoded.data;
      // Exact-signature receipts precede all current material/configuration reads.
      const previous = await repository.lookup(ownerId, input, dependencies.now());
      if (previous) return previous;
      const context = await repository.readContext(ownerId, input.senseId);
      if (!context || context.ownerId !== ownerId || context.senseId !== input.senseId) throw new LegacyUpgradeError("NOT_FOUND");
      const plan = planLegacyLearningCardUpgrade(context);
      if (plan.status === "already_modern") return { status: "already_modern", requestId: input.requestId, senseId: input.senseId };
      if (plan.status === "blocked") return { status: "blocked", reason: plan.reason, requestId: input.requestId, senseId: input.senseId };
      if (!sameTarget(plan.target, input)) throw new LegacyUpgradeError("STALE_PLAN");
      const promptInput = input.source.kind === "source_occurrence" ? buildLegacyUpgradePromptInput(context, input) : null;
      let pin = null;
      let gateway: StructuredJsonGateway | null = null;
      if (promptInput) {
        if (dependencies.ci) gateway = dependencies.fixtureGateway;
        else {
          pin = await repository.resolveActiveGatewayPin(ownerId);
          if (!pin) throw new LegacyUpgradeError("GATEWAY_REQUIRED");
          try { gateway = await dependencies.gatewayResolver.resolve(ownerId, pin); }
          catch (error) { throw new LegacyUpgradeError(safeCode(error), true); }
        }
      }
      const claim = await repository.claim(ownerId, input, pin, dependencies.now());
      if (claim.kind === "outcome") return claim.outcome;
      try {
        const publication: LegacyUpgradePublication = gateway && promptInput
          ? { origin: "model" as const, card: await generateCard(gateway, promptInput), promptVersion: ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION, model: gateway.model, pin }
          : { origin: "existing_card" as const, card: context.existingCard!.card };
        return await repository.publish(ownerId, input, claim.token, publication, dependencies.now());
      } catch (error) {
        const code = safeCode(error);
        // A committed publication can lose its response. Recover it before failing.
        const published = await repository.lookup(ownerId, input, dependencies.now()).catch(() => null);
        if (published && published.status !== "in_progress") return published;
        let failed = false;
        try { failed = await repository.fail(ownerId, input, claim.token, code, dependencies.now()); }
        catch { /* Unconfirmed writes retain this request ID and cannot authorize a new cycle. */ }
        if (failed) return { status: "failed", code, requestId: input.requestId, senseId: input.senseId };
        return await repository.lookup(ownerId, input, dependencies.now()).catch(() => null) ?? pending(input);
      }
    },
  };
}
