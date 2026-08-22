export function SignInForm() {
  return (
    <form aria-label="Email and password sign in" action="/auth/sign-in" method="post">
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
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        minLength={6}
        maxLength={128}
        required
      />
      <button type="submit" name="intent" value="sign-in">Sign in</button>
      <button type="submit" name="intent" value="sign-up">Create account</button>
    </form>
  );
}
