"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TODAY_PRACTICE_GROUPS, type TodayPracticeResponse, type TodayPracticeItem, type TodaySessionResult } from "@/contracts/today-practice";
import { activateTodayCandidate } from "./today-api";
import { LocalPracticeDate } from "./practice-controls";
import { PracticeOpenError } from "./practice-open-error";
import { readSession } from "./session-storage";
import { SessionSummary } from "./session-summary";
import { practiceTaskHref } from "./return-target";
import styles from "./practice-workspace.module.css";
export function TodayPractice({ userId, initialData }: {
  readonly userId: string;
  readonly initialData: TodayPracticeResponse;
}) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false), [opening, setOpening] = useState<string | null>(null), [slow, setSlow] = useState(false), [error, setError] = useState<unknown>(null), [results, setResults] = useState<TodaySessionResult[]>([]);
  const retry = useRef<() => void>(() => { });
  const inFlight = useRef(false);
  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => {
      if (mounted)
        setResults(readSession(userId).results);
    });
    return () => {
      mounted = false;
    };
  }, [userId]);
  const { summary, items } = initialData;
  const total = summary.reviewCount + summary.secondTryCount + summary.newCount;
  async function open(item: TodayPracticeItem) {
    if (inFlight.current)
      return;
    inFlight.current = true;
    setOpening(item.id);
    setError(null);
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 8000);
    retry.current = () => void open(item);
    try {
      const result = await activateTodayCandidate(item);
      router.push("redirect" in result ? result.redirect : practiceTaskHref(result.taskId, "/practice"));
    }
    catch (e) {
      setError(e);
    }
    finally {
      clearTimeout(timer);
      inFlight.current = false;
      setOpening(null);
      setSlow(false);
    }
  }
  return <section className={styles.workspace}><header className={styles.landingHeader}><h1>Today&apos;s practice</h1><p>Reviews, second tries and new expressions, in one place.</p></header>{results.length ? <SessionSummary results={results} nextPracticeAt={summary.nextPracticeAt}/> : null}{error ? <PracticeOpenError error={error} onRetry={() => retry.current()}/> : null}{opening ? <p role="status">{slow ? "Your configured model is still working. Your practice is still here." : "Opening your practice item…"}</p> : null}{total ? <><section className={styles.sessionCard}><p className={styles.sessionSummary}>{summary.reviewCount} {summary.reviewCount === 1 ? "review" : "reviews"} · {summary.secondTryCount} {summary.secondTryCount === 1 ? "second try" : "second tries"} · {summary.newCount} new · about {summary.estimatedMinutes} min</p><Link className={styles.primaryButton} href="/practice/session">Start</Link></section>{TODAY_PRACTICE_GROUPS.map(group => {
        const all = items.filter(item => item.kind === group.kind);
        if (!all.length)
          return null;
        const visible = group.kind === "new" && !showAll ? all.slice(0, 10) : all;
        return <section className={styles.sessionCard} id={group.id} key={group.kind}><h2>{group.label} ({all.length})</h2><p>{group.description}</p><ul className={styles.queue}>{visible.map(item => <li key={item.id}><div>{item.kind === "review" ? <Link className={styles.textLink} href={`/practice/review/${item.reviewTaskId}?returnTo=%2Fpractice`} lang="zh-CN">{item.expression}</Link> : <button className={styles.itemButton} type="button" disabled={opening !== null} onClick={() => void open(item)} lang="zh-CN">{item.expression}</button>}<p className={styles.queueMeaning}>{item.meaningHere}</p></div><span className={styles.mastery}>{item.kind === "review" ? item.overdueDays > 0 ? `Overdue ${item.overdueDays} ${item.overdueDays === 1 ? "day" : "days"}` : item.mastery : item.kind === "second_try" ? `Round ${item.roundNumber}` : item.sourceVideoTitle}</span></li>)}</ul>{group.kind === "new" && all.length > 10 && !showAll ? <button type="button" className={styles.secondaryButton} onClick={() => setShowAll(true)}>Show all {all.length}</button> : null}</section>;
      })}</> : <section className={styles.emptyCard}><h2>You&apos;re all caught up.</h2>{summary.nextPracticeAt ? <p>Next practice: {<LocalPracticeDate value={summary.nextPracticeAt}/>}</p> : null}<Link className={styles.primaryButton} href={summary.needsAnalysisCount ? "/saved?filter=needs-analysis" : "https://www.youtube.com/"}>{summary.needsAnalysisCount ? "Analyze your saves" : "Watch something on YouTube"}</Link></section>}</section>;
}
