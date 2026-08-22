import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <main>
      <section aria-labelledby="sign-in-title">
        <p>Popcorn</p>
        <h1 id="sign-in-title">Sign in to your learning settings</h1>
        <p>Use the email and password for your local Popcorn account.</p>
        <SignInForm />
      </section>
    </main>
  );
}
