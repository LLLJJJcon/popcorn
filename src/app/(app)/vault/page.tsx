import { redirect } from "next/navigation";

import { VaultList } from "@/features/vault/vault-list";
import { VaultSearch } from "@/features/vault/vault-search";
import styles from "@/features/vault/vault-workspace.module.css";
import { createLearningMemoryRuntime } from "@/server/repositories/review-task-repository";

export default async function VaultPage() {
  const runtime = await createLearningMemoryRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");
  const cards = await runtime.repository.listVault(session.userId);
  return <main className={styles.workspace}>
    <header className={styles.pageHeader}>
      <p className={styles.eyebrow}>Expressions backed by your own attempts</p>
      <h1>Vault</h1>
      <p>Return to Mandarin you have genuinely practised, with the evidence that made it yours.</p>
    </header>
    <VaultSearch />
    <VaultList cards={cards} />
  </main>;
}
