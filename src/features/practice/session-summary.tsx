"use client";
import type { TodaySessionResult } from "@/contracts/today-practice";
import { formatPracticeDate } from "./practice-controls";
import styles from "./practice-workspace.module.css";
const title = (value: string | null) => value ? value[0]!.toUpperCase() + value.slice(1) : "";
export function sessionResultLabel(result: TodaySessionResult): string {
  switch (result.outcome) {
    case "added": return "Added to your Vault";
    case "moved_up": return `${title(result.priorMastery)} → ${title(result.newMastery)}`;
    case "practice_again_tomorrow": return "Practice again tomorrow";
    case "removed": return "Removed";
    case "maintained": return `Nice — still ${result.newMastery}.${result.nextPracticeAt ? ` Next practice ${formatPracticeDate(result.nextPracticeAt)}` : ""}`;
  }
}
export function SessionSummary({ results, nextPracticeAt }: {
  readonly results: readonly TodaySessionResult[];
  readonly nextPracticeAt: string | null;
}) {
  return <section className={styles.sessionCard} aria-label="Your session summary"><h2>Your session summary</h2><ul className={styles.queue}>{results.map(result => <li key={result.id}><span lang="zh-CN">{result.expression}</span><span>{sessionResultLabel(result)}</span></li>)}</ul><p>{results.filter(r => r.outcome === "added").length} added to your Vault · {results.filter(r => r.outcome === "moved_up" && r.priorMastery !== r.newMastery).length} moved up</p>{nextPracticeAt ? <p>Next practice: {formatPracticeDate(nextPracticeAt)}</p> : null}</section>;
}
