import { ExpressionCard } from "@/features/vault/expression-card";
import type { ExpressionCardView } from "@/server/repositories/review-task-repository";

export function VaultList({ cards }: { readonly cards: readonly ExpressionCardView[] }) {
  if (cards.length === 0) {
    return <p>No expressions in your Vault yet. Pass an original Practice response to add one.</p>;
  }
  return <div>{cards.map((card) => <ExpressionCard key={card.userExpressionId} card={card} />)}</div>;
}
