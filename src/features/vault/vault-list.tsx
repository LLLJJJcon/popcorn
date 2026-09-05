import Link from "next/link";

import { ExpressionCard } from "@/features/vault/expression-card";
import styles from "@/features/vault/vault-workspace.module.css";
import type { ExpressionCardView } from "@/server/repositories/review-task-repository";

export function VaultList({ cards }: { readonly cards: readonly ExpressionCardView[] }) {
  if (cards.length === 0) {
    return <section className={styles.emptyState}>
      <h2>Your practiced expressions will appear here</h2>
      <p>No expressions in your Vault yet. Pass an original Practice response to add one.</p>
      <Link className={styles.textLink} href="/saved">Find something to practise in Saved</Link>
    </section>;
  }
  return <div className={styles.expressionGrid}>{cards.map((card) => <ExpressionCard key={card.userExpressionId} card={card} />)}</div>;
}
