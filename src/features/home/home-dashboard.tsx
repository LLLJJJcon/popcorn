import Link from "next/link";

import type { HomeView } from "@/features/home/home-view";
import { NextAction, selectNextAction } from "@/features/home/next-action";
import { ProcessingState } from "@/features/saved/processing-state";
import styles from "./home-dashboard.module.css";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function HomeDashboard({ view }: { readonly view: HomeView }) {
  const mastery = [
    ["Tried", view.masteryDistribution.tried],
    ["Reused", view.masteryDistribution.reused],
    ["Owned", view.masteryDistribution.owned],
  ] as const;

  return (
    <main className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Your learning workspace</p>
        <h1>Home</h1>
        <p>Keep turning moments from the Chinese YouTube videos you watch into language you can use.</p>
      </header>

      <section className={styles.actionCard} aria-labelledby="next-action-heading">
        <p className={styles.cardEyebrow}>Most useful now</p>
        <h2 id="next-action-heading">Next action</h2>
        <NextAction action={selectNextAction(view)} className={styles.primaryAction} />
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
          <h2 id="recent-saved-heading">Recent Saved video</h2>
          {view.recentVideo ? (
            <article className={styles.recentVideo} aria-label="Most recently saved video">
              {/* eslint-disable-next-line @next/next/no-img-element -- persisted YouTube thumbnail URL is constrained by the accepted Saved summary contract. */}
              <img
                className={styles.thumbnail}
                src={view.recentVideo.thumbnailUrl}
                alt={`${view.recentVideo.title} thumbnail`}
                width={480}
                height={270}
              />
              <div>
                <h3>
                  <Link href={`/saved/${view.recentVideo.sourceId}`}>{view.recentVideo.title}</Link>
                </h3>
                <p className={styles.videoMeta}>{view.recentVideo.channel}</p>
                <p className={styles.videoMeta}>
                  {view.recentVideo.savedCount} saved {view.recentVideo.savedCount === 1 ? "moment" : "moments"}
                </p>
                <p className={styles.videoMeta}>
                  Latest activity {dateFormatter.format(new Date(view.recentVideo.latestSavedAt))}
                </p>
                <ProcessingState state={view.recentVideo.processingState} />
              </div>
            </article>
          ) : (
            <div className={styles.emptySaved}>
              <h3>Your next save starts on YouTube</h3>
              <p>Use the Popcorn extension to capture a useful moment, then return here to keep learning.</p>
              <Link className={styles.secondaryLink} href="/saved">Open Saved</Link>
            </div>
          )}
          {view.recentVideo ? (
            <Link className={styles.secondaryLink} href="/saved">View all Saved videos</Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
