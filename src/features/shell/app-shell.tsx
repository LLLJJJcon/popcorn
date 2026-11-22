import Link from "next/link";
import { Suspense } from "react";

import { AppNavigation } from "./app-navigation";
import { GatewayNotice } from "./gateway-notice";
import styles from "./app-shell.module.css";

export type AppShellAccount = { readonly email?: string };

export function AppShell({
  account,
  children,
}: {
  readonly account: AppShellAccount;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <div className={styles.shell}>
        <aside className={styles.rail} aria-label="Popcorn workspace">
          {/* eslint-disable-next-line @next/next/no-img-element -- local vector brand mark. */}
          <Link className={styles.brand} href="/home"><img src="/brand/popcorn.svg" width="36" height="36" alt="" />Popcorn</Link>
          <Suspense fallback={<div className={styles.navigationFallback} aria-hidden="true" />}>
            <AppNavigation />
          </Suspense>
          <div className={styles.account}>
            <p className={styles.accountLabel}>Signed in</p>
            <p className={styles.accountName}>{account.email ?? "Popcorn account"}</p>
            <form action="/auth/sign-out" method="post" aria-label="Sign out of Popcorn">
              <button type="submit">Sign out</button>
            </form>
          </div>
        </aside>
        <div className={styles.workspace} data-workspace-scroll>
          <GatewayNotice />
          <div className={styles.content} id="main-content">{children}</div>
        </div>
      </div>
    </>
  );
}
