import { SignInForm } from "./sign-in-form";
import styles from "./sign-in.module.css";

export default function SignInPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <aside className={styles.purpose} aria-labelledby="popcorn-purpose-title">
          <p className={styles.brand}>Popcorn</p>
          <h1 id="popcorn-purpose-title">Turn the YouTube videos you watch into Mandarin practice.</h1>
          <p>Build a learning habit around the videos you already enjoy.</p>
        </aside>
        <section className={styles.account} aria-label="Local Popcorn account">
          <p className={styles.eyebrow}>Local Popcorn account</p>
          <h2 id="sign-in-title">Sign in to your learning settings</h2>
          <p>Use the email and password for your local Popcorn account.</p>
          <SignInForm />
        </section>
      </section>
    </main>
  );
}
