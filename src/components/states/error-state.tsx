"use client";

type ErrorRecovery =
  | { kind: "link"; href: string }
  | { kind: "button"; onRetry: () => void };

export function ErrorState({
  requestId,
  recovery,
}: {
  requestId: string;
  recovery: ErrorRecovery;
}) {
  return (
    <section role="alert" aria-labelledby="popcorn-error-title">
      <h2 id="popcorn-error-title">Something went wrong</h2>
      <p>Popcorn could not finish that request. Please try again.</p>
      <p>
        Request ID: <code>{requestId}</code>
      </p>
      {recovery.kind === "link" ? (
        <a href={recovery.href}>Try again</a>
      ) : (
        <button type="button" onClick={recovery.onRetry}>Try again</button>
      )}
    </section>
  );
}
