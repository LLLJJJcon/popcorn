import type { MasteryState } from "@/contracts/memory";

export type MasteryEvidence =
  | { readonly kind: "valid_original_attempt" }
  | { readonly kind: "successful_independent_transfer" }
  | {
      readonly kind: "owned_threshold_met";
      readonly distinctContexts: number;
      readonly distinctUtcDates: number;
      readonly includesDuePractice: boolean;
    }
  | { readonly kind: "saved_item_created" }
  | {
      readonly kind: "content_viewed";
      readonly surface: "translation" | "overview" | "explanation";
    }
  | { readonly kind: "failed_or_assisted_reuse" };

export function advanceMastery(
  current: MasteryState | null,
  evidence: MasteryEvidence,
): MasteryState | null {
  if (current === "owned") {
    return current;
  }

  if (current === null) {
    return evidence.kind === "valid_original_attempt" ? "tried" : current;
  }

  if (current === "tried") {
    return evidence.kind === "successful_independent_transfer" ? "reused" : current;
  }

  if (
    evidence.kind === "owned_threshold_met" &&
    evidence.distinctContexts >= 2 &&
    evidence.distinctUtcDates >= 2 &&
    evidence.includesDuePractice
  ) {
    return "owned";
  }

  return current;
}
