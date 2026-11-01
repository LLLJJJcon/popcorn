"use client";
import { useRef, useState, type ReactNode } from "react";
import type { PracticeMaterialView } from "./material-schema";
import { DisclosureButton } from "./practice-controls";
import styles from "./practice-workspace.module.css";
const settingLabels = { casual_chat: "Casual chat", daily_errands: "Daily errands", work_school: "Work & school", formal_writing: "Formal writing & speeches", online_social: "Online posts" };
function timestamp(seconds: number) { const n = Math.max(0, Math.floor(seconds)); return n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2,"0")}:${String(n % 60).padStart(2,"0")}` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2,"0")}`; }
export function PracticeMaterial({ material, onExamplesOpen, onExamplesPendingChange, examplesOpened, sessionStatus, navigation, headingLevel = 1, children }: {
  readonly headingLevel?: 1 | 2; readonly material: PracticeMaterialView; readonly onHintUsed?: () => void; readonly onExamplesOpen?: () => Promise<void>; readonly onExamplesPendingChange?: (pending: boolean) => void; readonly examplesOpened?: boolean; readonly sessionStatus?: ReactNode; readonly navigation?: ReactNode; readonly children: ReactNode;
}) {
  const [about, setAbout] = useState(false), [english, setEnglish] = useState(false);
  const [opened, setOpened] = useState(Boolean(examplesOpened ?? material.roundState?.examplesOpened ?? material.examplesOpened));
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const card = material.learningCard, situation = material.task.situation, due = material.task.kind === "due_practice";
  const visible = opened || Boolean(examplesOpened);
  async function revealExamples() {
    if (inFlight.current || visible || !onExamplesOpen) return;
    inFlight.current = true; setPending(true); setFailed(false); onExamplesPendingChange?.(true);
    try { await onExamplesOpen(); setOpened(true); } catch { setFailed(true); }
    finally { inFlight.current = false; setPending(false); onExamplesPendingChange?.(false); }
  }
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const roundNumber = material.roundState?.roundNumber ?? 1;
  const phaseLabel = due ? `Current mastery: ${material.masteryState}` : material.roundState?.promotion ? "In your Vault" : roundNumber > 1 ? `Round ${roundNumber} · Not in your Vault yet` : "New · Not in your Vault yet";
  return <article className={headingLevel === 2 ? styles.embeddedWorkspace : styles.workspace}>
    {navigation}
    <header className={styles.practiceHeader}><Heading lang="zh-CN">{material.task.targetExpression}</Heading><p className={styles.meaning}>{card?.meaningHere ?? material.expression.englishMeaning}</p><div className={styles.metaRow}><span className={styles.mastery}>{phaseLabel}</span>{sessionStatus}</div></header>
    <section className={styles.materialGrid} aria-label="Practice context"><div className={styles.paperCard}>
      {situation ? <><p>You&apos;re talking to: {situation.interlocutor} · {settingLabels[situation.targetSetting]}</p><div className={styles.segmented} aria-label="Situation language"><button type="button" aria-pressed={!english} onClick={() => setEnglish(false)}>中文</button><button type="button" aria-pressed={english} onClick={() => setEnglish(true)}>EN</button></div></> : null}
      <p className={styles.prompt} lang="zh-CN">{situation?.situationZh ?? material.task.promptChinese}</p>
      {english && situation ? <p lang="en">{situation.situationEn}</p> : null}<p>{situation?.taskEn ?? material.task.instructionsEnglish}</p>
    </div><aside className={styles.sourceCard}><a className={styles.sourceLink} href={material.source.youtubeUrl} target="_blank" rel="noreferrer">{material.source.videoTitle} · {timestamp(material.source.startSeconds)} <span aria-hidden="true">↗</span></a></aside></section>
    <section className={styles.responseCard} aria-label="Your answer workspace"><div className={styles.helpControls}>
      <DisclosureButton expanded={about} onClick={() => setAbout(!about)}>About this expression</DisclosureButton>
      {about ? <div className={styles.hintPanel}><dl><div><dt>How it fits</dt><dd>{card?.howItFits ?? material.expression.englishExplanation}</dd></div><div><dt>Tone &amp; who</dt><dd>{card?.toneAndWho ?? `${material.expression.tone} · ${material.expression.register}`}</dd></div>{card?.watchOut ? <div><dt>Watch out</dt><dd>{card.watchOut}</dd></div> : null}</dl></div> : null}
      <button className={styles.tertiaryButton} type="button" aria-expanded={visible} disabled={pending || visible} onClick={() => void revealExamples()}><span aria-hidden="true">▤</span>{pending ? "Opening examples…" : "Show examples"}</button>
      {!material.roundState?.firstAnswer ? <p className={styles.muted}>{due ? "Seeing an example helps, but this review won't move your progress." : "Seeing an example helps, but this round won't go into your Vault."}</p> : null}
      {failed ? <p role="alert" className={styles.alert}>Examples couldn&apos;t open. Try again.</p> : null}
      {visible ? <div className={styles.hintPanel}>{card?.examples?.map((example, i) => <div key={i}><p lang="zh-CN">{example.zh}</p><p lang="en">{example.en}</p></div>)}<blockquote lang="zh-CN">{material.source.evidenceText}</blockquote></div> : null}
    </div>{children}</section>
  </article>;
}
