import Link from "next/link";
import { PracticeRequestError } from "./api";
import styles from "./practice-workspace.module.css";
export function PracticeOpenError({ error, onRetry }: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  return <div role="alert" className={styles.alert}>{error instanceof PracticeRequestError && error.code === "MODEL_GATEWAY_CONFIGURATION_REQUIRED" ? <><p>Connect a model to continue.</p><Link className={styles.primaryButton} href="/settings/model-gateway">Set up model gateway</Link></> : <><p>Practice couldn&apos;t open.</p><button className={styles.secondaryButton} type="button" onClick={onRetry}>Try again</button></>}</div>;
}
