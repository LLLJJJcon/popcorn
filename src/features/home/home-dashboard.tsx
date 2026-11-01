import Link from "next/link";

import { TODAY_PRACTICE_GROUPS } from "@/contracts/today-practice";
import type { HomeView } from "@/features/home/home-view";
import { LocalDate } from "@/features/home/local-date";
import { NextAction, selectNextAction } from "@/features/home/next-action";
import styles from "./home-dashboard.module.css";

export function HomeDashboard({ view }: { readonly view: HomeView }) {
  const action = selectNextAction(view);
  const counts = { review: view.summary.reviewCount, second_try: view.summary.secondTryCount, new: view.summary.newCount };
  const mastery = [
    ["Tried", view.masteryDistribution.tried],
    ["Reused", view.masteryDistribution.reused],
    ["Owned", view.masteryDistribution.owned],
  ] as const;

  return (
    <main className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <h1>Home</h1>
        <p>Keep turning moments from the Chinese YouTube videos you watch into language you can use.</p>
      </header>

      <section className={styles.actionCard} aria-labelledby="next-action-heading">
        <h2 id="next-action-heading">Next action</h2>
        <NextAction action={action} className={styles.primaryAction} />
        {action.kind === "practice" ? <p className={styles.actionDetail}>about {action.estimatedMinutes} min</p> : null}
        {action.kind === "youtube" && view.summary.nextPracticeAt ? <p className={styles.actionDetail}>Next practice: <LocalDate instant={view.summary.nextPracticeAt} /></p> : null}
        <ul className={styles.practiceCounts} aria-label="Today's practice">
          {TODAY_PRACTICE_GROUPS.map(({ kind, id, label, description }) => (
            <li key={kind} className={counts[kind] === 0 ? styles.emptyCount : undefined}>
              <Link href={`/practice#${id}`}><span>{label}</span><strong>{counts[kind]}</strong><p>{description}</p></Link>
            </li>
          ))}
        </ul>
        {view.summary.processingCount > 0 ? <p className={styles.processingNotice}>{view.summary.processingCount} saves are still processing</p> : null}
      </section>

      <div className={styles.supportGrid}>
        <section className={styles.paperCard} aria-labelledby="mastery-snapshot-heading">
          <h2 id="mastery-snapshot-heading">Mastery snapshot</h2>
          <p>Your strongest demonstrated evidence for each expression.</p>
          <ul className={styles.masteryList} aria-label="Mastery snapshot">
            {mastery.map(([label, count]) => (
              <li key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
          <Link className={styles.secondaryLink} href="/progress">View Progress</Link>
        </section>

        <section className={styles.paperCard} aria-labelledby="recent-saved-heading">
          <h2 id="recent-saved-heading">Recent Saved videos</h2>
          {view.recentVideos.length > 0 ? (
            <ul className={styles.recentVideos} aria-label="Recent Saved videos">{view.recentVideos.map((video) => <li key={video.sourceId} className={styles.recentVideo}>
              {/* eslint-disable-next-line @next/next/no-img-element -- persisted YouTube thumbnail URL is constrained by the accepted Saved summary contract. */}
              <img
                className={styles.thumbnail}
                src={video.thumbnailUrl}
                alt={`${video.title} thumbnail`}
                width={480}
                height={270}
              />
              <div>
                <h3>
                  <Link href={`/saved/${video.sourceId}`}>{video.title}</Link>
                </h3>
                <p className={styles.videoMeta}>{video.channel}</p>
                <p className={styles.videoMeta}>
                  {video.practiceCount > 0 ? `${video.practiceCount} ready to practice` : video.needsAnalysisCount > 0 ? `${video.needsAnalysisCount} ${video.needsAnalysisCount === 1 ? "save needs" : "saves need"} analysis` : `${video.savedCount} saved ${video.savedCount === 1 ? "moment" : "moments"}`}
                </p>
                <p className={styles.videoMeta}>
                  Latest activity <LocalDate instant={video.latestSavedAt} />
                </p>
              </div>
            </li>)}</ul>
          ) : (
            <div className={styles.emptySaved}>
              <h3>Your next save starts on YouTube</h3>
              <p>Use the Popcorn extension to capture a useful moment, then return here to keep learning.</p>
            </div>
          )}
          <Link className={styles.secondaryLink} href="/saved">View all Saved videos</Link>
        </section>
      </div>
    </main>
  );
}
