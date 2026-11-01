"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PracticeMaterialView } from "./material-schema";
import { DisclosureButton } from "./practice-controls";
import styles from "./practice-workspace.module.css";
const settingLabels = { casual_chat: "Casual chat", daily_errands: "Daily errands", work_school: "Work & school", formal_writing: "Formal writing & speeches", online_social: "Online posts" };
function timestamp(seconds: number) { const n = Math.max(0, Math.floor(seconds)); return n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2,"0")}:${String(n % 60).padStart(2,"0")}` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2,"0")}`; }
export function PracticeMaterial({ material, onExamplesOpen, onExamplesPendingChange, examplesOpened, expressionHidden = false, onExpressionReveal, onExpressionPendingChange, actionsDisabled = false, sessionStatus, navigation, headingLevel = 1, children }: {
  readonly headingLevel?: 1 | 2; readonly material: PracticeMaterialView; readonly onHintUsed?: () => void; readonly onExamplesOpen?: () => Promise<void>; readonly onExamplesPendingChange?: (pending: boolean) => void; readonly examplesOpened?: boolean; readonly expressionHidden?: boolean; readonly onExpressionReveal?: () => Promise<void>; readonly onExpressionPendingChange?: (pending: boolean) => void; readonly actionsDisabled?: boolean; readonly sessionStatus?: ReactNode; readonly navigation?: ReactNode; readonly children: ReactNode;
}) {
  const [about, setAbout] = useState(false), [english, setEnglish] = useState(false);
  const [opened, setOpened] = useState(Boolean(examplesOpened ?? material.roundState?.examplesOpened ?? material.examplesOpened));
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false);
  const [revealed, setRevealed] = useState(false), [revealPending, setRevealPending] = useState(false), [revealFailed, setRevealFailed] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const card = material.learningCard, situation = material.task.situation, due = material.task.kind === "due_practice";
  const visible = opened || Boolean(examplesOpened);
  const hidden = expressionHidden && !revealed && !visible;
  const blocks = "▢".repeat(Array.from(material.task.targetExpression).length);
  const display = (value: string) => hidden ? value.split(material.task.targetExpression).join(blocks) : value;
  async function revealExpression() {
    if (inFlight.current || actionsDisabled || !hidden || !onExpressionReveal) return;
    inFlight.current = true; setRevealPending(true); setRevealFailed(false); onExpressionPendingChange?.(true);
    try { await onExpressionReveal(); if (mounted.current) setRevealed(true); }
    catch { if (mounted.current) setRevealFailed(true); }
    finally { inFlight.current = false; if (mounted.current) { setRevealPending(false); onExpressionPendingChange?.(false); } }
  }
  async function revealExamples() {
    if (inFlight.current || actionsDisabled || visible || !onExamplesOpen) return;
    inFlight.current = true; setPending(true); setFailed(false); onExamplesPendingChange?.(true);
    try { await onExamplesOpen(); if (mounted.current) setOpened(true); } catch { if (mounted.current) setFailed(true); }
    finally { inFlight.current = false; if (mounted.current) { setPending(false); onExamplesPendingChange?.(false); } }
  }
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const roundNumber = material.roundState?.roundNumber ?? 1;
  const phaseLabel = due ? `Current mastery: ${material.masteryState}` : material.roundState?.promotion ? "In your Vault" : roundNumber > 1 ? `Round ${roundNumber} · Not in your Vault yet` : "New · Not in your Vault yet";
  return <article className={headingLevel === 2 ? styles.embeddedWorkspace : styles.workspace}>
    {navigation}
    <header className={styles.practiceHeader}><Heading lang="zh-CN">{display(material.task.targetExpression)}</Heading>{hidden && onExpressionReveal ? <button className={styles.tertiaryButton} type="button" disabled={actionsDisabled || revealPending || pending} onClick={() => void revealExpression()}>{revealPending ? "Showing the expression…" : "Show the expression"}</button> : null}{revealFailed ? <p role="alert">The expression couldn&apos;t open. Try again.</p> : null}<p className={styles.meaning}>{display(card?.meaningHere ?? material.expression.englishMeaning)}</p><div className={styles.metaRow}><span className={styles.mastery}>{phaseLabel}</span>{sessionStatus}</div></header>
    <section className={styles.materialGrid} aria-label="Practice context"><div className={styles.paperCard}>
      {situation ? <><p>You&apos;re talking to: {display(situation.interlocutor)} · {settingLabels[situation.targetSetting]}</p><div className={styles.segmented} aria-label="Situation language"><button type="button" aria-pressed={!english} onClick={() => setEnglish(false)}>中文</button><button type="button" aria-pressed={english} onClick={() => setEnglish(true)}>EN</button></div></> : null}
      <p className={styles.prompt} lang="zh-CN">{display(situation?.situationZh ?? material.task.promptChinese)}</p>
      {english && situation ? <p lang="en">{display(situation.situationEn)}</p> : null}<p>{display(situation?.taskEn ?? material.task.instructionsEnglish)}</p>
    </div><aside className={styles.sourceCard}><a className={styles.sourceLink} href={material.source.youtubeUrl} target="_blank" rel="noreferrer">{display(material.source.videoTitle)} · {timestamp(material.source.startSeconds)} <span aria-hidden="true">↗</span></a></aside></section>
    <section className={styles.responseCard} aria-label="Your answer workspace"><div className={styles.helpControls}>
      <DisclosureButton expanded={about} onClick={() => setAbout(!about)}>About this expression</DisclosureButton>
      {about ? <div className={styles.hintPanel}><dl><div><dt>How it fits</dt><dd>{display(card?.howItFits ?? material.expression.englishExplanation)}</dd></div><div><dt>Tone &amp; who</dt><dd>{display(card?.toneAndWho ?? `${material.expression.tone} · ${material.expression.register}`)}</dd></div>{card?.watchOut ? <div><dt>Watch out</dt><dd>{display(card.watchOut)}</dd></div> : null}</dl></div> : null}
      <button className={styles.tertiaryButton} type="button" aria-expanded={visible} disabled={actionsDisabled || pending || revealPending || visible} onClick={() => void revealExamples()}><span aria-hidden="true">▤</span>{pending ? "Opening examples…" : "Show examples"}</button>
      {!material.roundState?.firstAnswer ? <p className={styles.muted}>{due ? "Seeing an example helps, but this review won't move your progress." : "Seeing an example helps, but this round won't go into your Vault."}</p> : null}
      {failed ? <p role="alert" className={styles.alert}>Examples couldn&apos;t open. Try again.</p> : null}
      {visible ? <div className={styles.hintPanel}>{card?.examples?.map((example, i) => <div key={i}><p lang="zh-CN">{example.zh}</p><p lang="en">{example.en}</p></div>)}<blockquote lang="zh-CN">{material.source.evidenceText}</blockquote></div> : null}
    </div>{children}</section>
  </article>;
}
