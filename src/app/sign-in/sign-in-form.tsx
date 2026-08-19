export function SignInForm() {
  return (
    <form aria-label="Email sign in" action="/auth/sign-in" method="post">
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        required
      />
      <button type="submit">Send magic link</button>
    </form>
  );
}
