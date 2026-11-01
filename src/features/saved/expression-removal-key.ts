import type { CandidateExpression } from "@/contracts/knowledge";
/** Matches the database removal function; keep artifact indices unchanged. */
export function expressionRemovalKey(candidate: CandidateExpression): string {
  return candidate.highlightKey ?? `legacy:${candidate.expression}`;
}
