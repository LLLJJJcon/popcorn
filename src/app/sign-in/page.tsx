import { cookies } from "next/headers";

import { createWebAuthFlowHandlers } from "@/server/auth/web-auth-flow";
import { getModelGatewaySettingsEnv } from "@/server/env";

import { SignInForm } from "./sign-in-form";
import styles from "./sign-in.module.css";

export default async function SignInPage() {
  const environment = getModelGatewaySettingsEnv();
  const account = await createWebAuthFlowHandlers({
    appUrl: environment.APP_URL,
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieStore: await cookies(),
  }).getPageAccount();

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <aside className={styles.purpose} aria-labelledby="popcorn-purpose-title">
          <p className={styles.brand}>Popcorn</p>
          <h1 id="popcorn-purpose-title">Turn the YouTube videos you watch into Mandarin practice.</h1>
          <p>Build a learning habit around the videos you already enjoy.</p>
        </aside>
        <section className={styles.account} aria-label="Local Popcorn account">
          {account.authenticated ? (
            <>
              <p className={styles.eyebrow}>Local Popcorn account</p>
              <h2 id="sign-in-title">You&apos;re signed in</h2>
              <p>Signed in as {account.email ?? "Popcorn account"}.</p>
              <div className={styles.accountActions}>
                <a className={styles.primaryAction} href="/home">Continue to Popcorn</a>
                <form action="/auth/sign-out" method="post" aria-label="Sign out of Popcorn">
                  <button className={styles.secondaryAction} type="submit">Sign out</button>
                </form>
              </div>
            </>
          ) : (
            <>
              <p className={styles.eyebrow}>Local Popcorn account</p>
              <h2 id="sign-in-title">Sign in to your learning settings</h2>
              <p>Use the email and password for your local Popcorn account.</p>
              <SignInForm />
            </>
          )}
        </section>
      </section>
    </main>
  );
}
