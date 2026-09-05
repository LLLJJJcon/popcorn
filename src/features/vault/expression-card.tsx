import Link from "next/link";

import type { ExpressionCardView } from "@/server/repositories/review-task-repository";
import styles from "@/features/vault/vault-workspace.module.css";

export function ExpressionCard({ card }: { readonly card: ExpressionCardView }) {
  return (
    <article className={styles.expressionCard}>
      <h2><Link className={styles.expressionLink} href={`/vault/${card.userExpressionId}`} lang="zh-CN">
        {card.expression}
      </Link></h2>
      <p className={styles.meaning}>{card.englishMeaning}</p>
      <div className={styles.summaryMeta}>
        <span className={styles.mastery}>{card.masteryState}</span>
        <span>{card.communicativeFunction}</span>
        <span>{card.register}</span>
      </div>
      <p className={styles.sourceSummary}>
        {card.sourceDeleted ? "Source deleted" : (card.sourceTitle ?? "YouTube source")}
      </p>
    </article>
  );
}
