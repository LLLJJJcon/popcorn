"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PracticeRoundState } from "@/contracts/practice";
import type { TodayPracticeItem, TodaySessionResult } from "@/contracts/today-practice";
import { PracticeRequestError, restorePractice } from "./api";
import { activateTodayCandidate, getNextPractice, getTaskMaterial, getTodayPractice } from "./today-api";
import { PracticeSession, type PracticeRemoval } from "./practice-session";
import { ReviewPractice } from "./review-practice";
import type { Completion } from "./review-schema";
import type { PracticeMaterialView } from "./material-schema";
import { PracticeOpenError } from "./practice-open-error";
import { readSession, writeSession, upsertSessionResult, type SessionDisplay } from "./session-storage";
import { SessionSummary } from "./session-summary";
import styles from "./practice-workspace.module.css";
type Current = {
  item: TodayPracticeItem;
  material: PracticeMaterialView | null;
};
type Undo = {
  item: TodayPracticeItem;
  receipt: PracticeRemoval;
  previous: TodaySessionResult | undefined;
};
export function TodaySession({ userId }: {
  readonly userId: string;
}) {
  const [display, setDisplay] = useState<SessionDisplay>({ results: [], current: null }), [current, setCurrent] = useState<Current | null>(null), [left, setLeft] = useState(0), [nextDate, setNextDate] = useState<string | null>(null), [ready, setReady] = useState(false), [busy, setBusy] = useState(true), [slow, setSlow] = useState(false), [error, setError] = useState<unknown>(null), [undo, setUndo] = useState<Undo | null>(null);
  const state = useRef<SessionDisplay>({ results: [], current: null }), active = useRef<Current | null>(null), sequence = useRef(0), alive = useRef(true), undoBusy = useRef(false), retry = useRef<() => void>(() => { });
  function persist(value: SessionDisplay) {
    if (!alive.current)
      return;
    state.current = value;
    setDisplay(value);
    writeSession(userId, value);
  }
  function setActive(value: Current | null) {
    active.current = value;
    setCurrent(value);
  }
  function refreshAfterExternalPromotion() {
    persist({ ...state.current, current: null });
    setActive(null);
    void next();
  }
  async function next(resume = false) {
    const token = ++sequence.current;
    setBusy(true);
    setError(null);
    setSlow(false);
    retry.current = () => void next(resume);
    const timer = setTimeout(() => {
      if (alive.current)
        setSlow(true);
    }, 8000);
    try {
      if (resume && state.current.finished) {
        const today = await getTodayPractice();
        if (!alive.current || token !== sequence.current)
          return;
        if (today.items.length)
          persist({ results: [], current: null, finished: false });
      }
      const result = await getNextPractice(state.current.results, resume ? state.current.current : null);
      if (!alive.current || token !== sequence.current)
        return;
      setNextDate(result.summary.nextPracticeAt);
      setLeft(result.remainingCount);
      setReady(true);
      const item = result.item;
      if (!item) {
        setActive(null);
        persist({ ...state.current, current: null, finished: true });
        return;
      }
      if (item.kind === "review") {
        setActive({ item, material: null });
        persist({ ...state.current, current: null });
        return;
      }
      const activation = await activateTodayCandidate(item);
      if (!alive.current || token !== sequence.current)
        return;
      if ("redirect" in activation) {
        refreshAfterExternalPromotion();
        return;
      }
      persist({ ...state.current, current: { currentItemId: item.id, currentTaskId: activation.taskId } });
      const material = await getTaskMaterial(activation.taskId);
      if (!alive.current || token !== sequence.current)
        return;
      if (material.task.id !== activation.taskId || material.task.kind !== "use_it_now")
        throw Error("Practice identity mismatch");
      if (material.roundState && (material.roundState.status !== "open" || material.roundState.firstAnswer))
        throw Error("Practice changed in another tab");
      setActive({ item, material });
    }
    catch (e) {
      if (alive.current && token === sequence.current) {
        if (e instanceof PracticeRequestError && e.userExpressionId) {
          refreshAfterExternalPromotion();
          return;
        }
        setError(e);
      }
    }
    finally {
      clearTimeout(timer);
      if (alive.current && token === sequence.current) {
        setBusy(false);
        setSlow(false);
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    let mounted = true;
    void Promise.resolve().then(() => {
      if (!mounted)
        return;
      const saved = readSession(userId);
      state.current = saved;
      setDisplay(saved);
      void next(true);
    });
    return () => {
      mounted = false;
      alive.current = false;
    };
    // Owner changes remount the authenticated session; every explicit Next reads fresh server state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  useEffect(() => {
    if (!undo)
      return;
    const timer = setTimeout(() => setUndo(null), Math.max(0, Date.parse(undo.receipt.undoUntil) - Date.now()));
    return () => clearTimeout(timer);
  }, [undo]);
  function advance(originItemId: string, originTaskId?: string) {
    const value = active.current;
    if (!alive.current || value?.item.id !== originItemId || (originTaskId && value.material?.task.id !== originTaskId))
      return;
    void next();
  }
  function promotedElsewhere(originItemId: string, originTaskId: string) {
    const value = active.current;
    if (!alive.current || value?.item.id !== originItemId || value.material?.task.id !== originTaskId)
      return;
    refreshAfterExternalPromotion();
  }
  async function reviewUnavailable(originItemId: string, reviewTaskId: string): Promise<boolean> {
    const value = active.current;
    if (!alive.current || value?.item.id !== originItemId || value.item.kind !== "review" || value.item.reviewTaskId !== reviewTaskId)
      return true;
    const token = sequence.current;
    try {
      const today = await getTodayPractice();
      const latest = active.current;
      if (!alive.current || sequence.current !== token || latest?.item.id !== originItemId || latest.item.kind !== "review" || latest.item.reviewTaskId !== reviewTaskId)
        return true;
      if (today.items.some(item => item.kind === "review" && item.reviewTaskId === reviewTaskId))
        return false;
      persist({ ...state.current, current: null });
      setActive(null);
      void next();
      return true;
    }
    catch {
      return false;
    }
  }
  function record(result: TodaySessionResult) {
    persist({ ...state.current, results: upsertSessionResult(state.current.results, result) });
  }
  function completed(originItemId: string, originTaskId: string, round: PracticeRoundState) {
    const item = active.current?.item;
    if (!alive.current || !item || item.id !== originItemId || active.current?.material?.task.id !== originTaskId || !round.firstAnswer)
      return;
    record({ id: item.id, kind: item.kind, expression: item.expression, outcome: round.promotion ? "added" : "practice_again_tomorrow", priorMastery: null, newMastery: round.promotion ? "tried" : null, nextPracticeAt: round.promotion?.nextDueAt ?? round.retryDueAt });
  }
  function reviewed(originItemId: string, result: Completion) {
    const item = active.current?.item;
    if (!alive.current || !item || item.id !== originItemId || item.kind !== "review" || item.reviewTaskId !== result.reviewTaskId)
      return;
    record({ id: item.id, kind: item.kind, expression: item.expression, outcome: !result.evaluation.passed || !result.evaluation.independentUse ? "practice_again_tomorrow" : result.priorState !== result.newState ? "moved_up" : "maintained", priorMastery: result.priorState, newMastery: result.newState, nextPracticeAt: result.nextDueAt });
  }
  async function roundCreated(originItemId: string, originTaskId: string, taskId: string) {
    const value = active.current;
    if (!alive.current || !value || value.item.id !== originItemId || value.material?.task.id !== originTaskId)
      return;
    const token = sequence.current;
    persist({ ...state.current, current: { currentItemId: value.item.id, currentTaskId: taskId } });
    setBusy(true);
    setError(null);
    retry.current = () => void roundCreated(originItemId, originTaskId, taskId);
    try {
      const material = await getTaskMaterial(taskId);
      if (!alive.current || sequence.current !== token || active.current?.item.id !== originItemId || active.current.material?.task.id !== originTaskId)
        return;
      if (material.task.id !== taskId || material.task.kind !== "use_it_now")
        throw Error("Practice identity mismatch");
      if (material.roundState && (material.roundState.status !== "open" || material.roundState.firstAnswer)) {
        retry.current = () => void next(true);
        throw Error("Practice changed in another tab");
      }
      if (active.current?.item.id === value.item.id)
        setActive({ item: value.item, material });
    }
    catch (e) {
      if (alive.current && sequence.current === token && active.current?.item.id === originItemId)
        setError(e);
    }
    finally {
      if (alive.current && sequence.current === token)
        setBusy(false);
    }
  }
  function removed(originItemId: string, receipt: PracticeRemoval) {
    const item = active.current?.item;
    if (!alive.current || !item || item.id !== originItemId || active.current?.material?.task.id !== receipt.taskId)
      return;
    const previous = state.current.results.find(r => r.id === item.id);
    setUndo({ item, receipt, previous });
    record({ id: item.id, kind: item.kind, expression: item.expression, outcome: "removed", priorMastery: null, newMastery: null, nextPracticeAt: null });
    persist({ ...state.current, current: null });
    setActive(null);
    void next();
  }
  async function restore() {
    if (!undo || undoBusy.current)
      return;
    undoBusy.current = true;
    const pending = undo;
    try {
      await restorePractice(pending.receipt.taskId);
      if (!alive.current)
        return;
      let results = state.current.results.filter(r => r.id !== pending.item.id);
      if (pending.previous)
        results = upsertSessionResult(results, pending.previous);
      persist({ ...state.current, results, finished: false });
      setUndo(null);
      if (!active.current)
        await next();
      else {
        const today = await getTodayPractice();
        if (!alive.current)
          return;
        setNextDate(today.summary.nextPracticeAt);
        const completed = new Set(state.current.results.map(r => r.id));
        const eligible = today.items.filter(i => !completed.has(i.id));
        setLeft(eligible.length + (active.current && !eligible.some(i => i.id === active.current!.item.id) ? 1 : 0));
      }
    }
    catch (e) {
      setError(e);
      retry.current = () => void restore();
    }
    finally {
      undoBusy.current = false;
    }
  }
  const completedCount = display.results.length, total = completedCount + Math.max(0, left - (current && display.results.some(r => r.id === current.item.id) ? 1 : 0));
  return <section className={styles.workspace}><header className={styles.landingHeader}><p className={styles.sessionNavigation}><Link className={`${styles.textLink} ${styles.sessionExit}`} href="/practice">← Exit session</Link></p><h1>Today&apos;s practice · {left} left</h1><progress className={styles.sessionProgress} aria-label="Session progress" max={Math.max(1, total)} value={completedCount}/></header>{undo ? <div className={styles.undoToast} role="status"><span>Removed {undo.item.expression} from practice.</span><button className={styles.secondaryButton} type="button" onClick={() => void restore()}>Undo</button></div> : null}{error ? <PracticeOpenError error={error} onRetry={() => retry.current()}/> : null}{busy ? <p role="status">{slow ? "Your configured model is still working. Your practice is still here." : "Opening your next practice item…"}</p> : null}{!busy && current ? (current.item.kind === "review" ? <ReviewPractice key={current.item.id} reviewTaskId={current.item.reviewTaskId} mode="session" nextLabel={left <= 1 ? "Finish" : "Next"} onNext={() => advance(current.item.id)} onCompleted={result => reviewed(current.item.id, result)} onUnavailable={() => reviewUnavailable(current.item.id, current.item.kind === "review" ? current.item.reviewTaskId : "")}/> : current.material ? <PracticeSession key={current.material.task.id} material={current.material} savedReturnTarget="/practice" mode="session" nextLabel={left <= 1 ? "Finish" : "Next"} onNext={() => advance(current.item.id, current.material!.task.id)} onCompleted={round => completed(current.item.id, current.material!.task.id, round)} onRoundCreated={taskId => void roundCreated(current.item.id, current.material!.task.id, taskId)} onRemoved={receipt => removed(current.item.id, receipt)} onPromotedElsewhere={() => promotedElsewhere(current.item.id, current.material!.task.id)}/> : null) : null}{ready && !busy && !error && !current ? <><h2>All done for today</h2><SessionSummary results={display.results} nextPracticeAt={nextDate}/><div className={styles.buttonRow}><Link className={styles.primaryButton} href="/home">Back to Home</Link><Link className={styles.secondaryButton} href="https://www.youtube.com/">Watch something on YouTube</Link></div></> : null}</section>;
}
