"use client";

import { useState, type ReactNode } from "react";

import type { PracticeMaterialView } from "@/features/practice/material-schema";
import styles from "@/features/practice/practice-workspace.module.css";

function timestamp(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3_600);
  const minutes = Math.floor((whole % 3_600) / 60);
  const remainder = whole % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function PracticeMaterial({
  material,
  onHintUsed,
  sessionStatus,
  children,
}: {
  readonly material: PracticeMaterialView;
  readonly onHintUsed: () => void;
  readonly sessionStatus?: ReactNode;
  readonly children: ReactNode;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

  function revealHint() {
    if (!hintOpen) onHintUsed();
    setHintOpen((open) => !open);
  }

  return (
    <article className={styles.workspace}>
      <header className={styles.practiceHeader}>
        <p className={styles.eyebrow}>Focused Mandarin practice</p>
        <h1 lang="zh-CN">{material.task.targetExpression}</h1>
        <p className={styles.meaning}>{material.expression.englishMeaning}</p>
        <div className={styles.metaRow}>
          <span className={styles.mastery}>Current mastery: {material.masteryState}</span>
          {sessionStatus ? <span>{sessionStatus}</span> : null}
        </div>
      </header>

      <section className={styles.materialGrid} aria-label="Practice context">
        <div className={styles.paperCard}>
          <p className={styles.cardEyebrow}>New situation</p>
          <h2>Respond in your own words</h2>
          <p className={styles.prompt} lang="zh-CN">{material.task.promptChinese}</p>
          <p>{material.task.instructionsEnglish}</p>
          <p className={styles.goal}>{material.task.goalEnglish}</p>
        </div>

        <aside className={styles.sourceCard} aria-labelledby="practice-source-heading">
          <p className={styles.cardEyebrow}>From your Saved moment</p>
          <h2 id="practice-source-heading">Source</h2>
          <a className={styles.sourceLink} href={material.source.youtubeUrl} target="_blank" rel="noreferrer">
            {material.source.videoTitle} · {timestamp(material.source.startSeconds)}
          </a>
          <button
            className={styles.disclosureButton}
            type="button"
            aria-expanded={evidenceOpen}
            onClick={() => setEvidenceOpen((open) => !open)}
          >
            {evidenceOpen ? "Hide original evidence" : "Show original evidence"}
          </button>
          {evidenceOpen ? <blockquote lang="zh-CN">{material.source.evidenceText}</blockquote> : null}
        </aside>
      </section>

      <section className={styles.responseCard} aria-labelledby="practice-response-heading">
        <h2 id="practice-response-heading">Your response</h2>
        <button
          className={styles.hintButton}
          type="button"
          aria-expanded={hintOpen}
          onClick={revealHint}
        >
          Need a hint?
        </button>
        {hintOpen ? (
          <div className={styles.hintPanel}>
            <p>{material.expression.englishExplanation}</p>
            <dl>
              <div><dt>Function</dt><dd>{material.expression.communicativeFunction}</dd></div>
              <div><dt>Tone</dt><dd>{material.expression.tone}</dd></div>
              <div><dt>Register</dt><dd>{material.expression.register}</dd></div>
            </dl>
          </div>
        ) : null}
        {children}
      </section>
    </article>
  );
}
