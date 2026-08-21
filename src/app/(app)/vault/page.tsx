import { redirect } from "next/navigation";

import { VaultList } from "@/features/vault/vault-list";
import { VaultSearch } from "@/features/vault/vault-search";
import { createLearningMemoryRuntime } from "@/server/repositories/review-task-repository";

export default async function VaultPage() {
  const runtime = await createLearningMemoryRuntime();
  const session = await runtime.authenticate(new Request(runtime.appUrl));
  if (!session.ok) redirect("/sign-in");
  const cards = await runtime.repository.listVault(session.userId);
  return <main><h1>Vault</h1><VaultSearch /><VaultList cards={cards} /></main>;
}
